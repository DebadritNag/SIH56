const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { jsPDF } = require('jspdf');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('./')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks);
    return original(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return m.exports;
}
const corridors = load('lib/supported-corridors.ts');
assert.deepEqual(corridors.SUPPORTED_CORRIDORS.map(c => c.id), ['DEL-BOM', 'DEL-CCU', 'BOM-BLR']);
const backendConfig = fs.readFileSync(path.resolve(root, '../../airpulse-api/app/collectors/corridors.py'), 'utf8');
assert.deepEqual([...backendConfig.matchAll(/'id': '([^']+)'/g)].map(m => m[1]), corridors.SUPPORTED_CORRIDORS.map(c => c.id));
for (const file of ['components/LiveCollection.tsx', 'components/data/ObservedRoute.tsx', 'components/layout/GlobalFilterBar.tsx', 'components/layout/CommandPalette.tsx']) {
  assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes('SUPPORTED_CORRIDORS'));
}

for (const bad of [null, 'DEL-BLR', 'HYD-DEL', 'BOM-GOI', 'BLR-PNQ', 'CCU-GAU', 'BLR-HYD', 'MAA-DEL']) {
  assert.equal(corridors.supportedCorridor(bad), 'DEL-BOM');
}
let urlRoute = null, requested, exportRoute, mode = 'real';
const stub = () => null;
const mocks = {
  '@/lib/supported-corridors': corridors,
  '@/lib/providers/DataModeProvider': { useDataMode: () => ({ mode }) },
  '@tanstack/react-query': { useQuery: options => {
    options.queryFn();
    return { data: { current_median_fare: 4321, booking_window_breakdown: { 'T+7': 4321 } } };
  } },
  '@/lib/api/client': { getData: url => { requested = url; } },
  'next/navigation': { useRouter: () => ({ push: stub }), useSearchParams: () => ({ get: () => urlRoute }) },
  'next/link': stub,
  'lucide-react': new Proxy({}, { get: () => stub }),
  '@/lib/mock-data/dashboard': load('lib/mock-data/dashboard.ts'),
  '@/lib/hooks/useLiveModeContext': {},
  '@/components/data/LiveModeBadge': {},
  '@/lib/formatters': { formatINR: n => `INR ${n}`, formatPercent: n => `${n}%` },
  '@/components/charts/EChartWrapper': { EChartWrapper: stub },
  '@/components/charts/RouteAdvancePurchaseChart': { RouteAdvancePurchaseChart: stub },
  '@/components/ui/Badge': { MarketPressureBadge: stub },
  '@/components/dialogs/ExportDialog': { ExportDialog: props => { exportRoute = props.filters.route; return null; } },
};
const Page = load('app/(dashboard)/routes/page.tsx', mocks).default;
for (const dataMode of ['real', 'mock']) {
 mode = dataMode;
 for (const code of [null, 'DEL-BOM', 'DEL-CCU', 'BOM-BLR', 'DEL-BLR']) {
  urlRoute = code;
  const selected = corridors.supportedCorridor(code);
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.equal((html.match(/<option /g) || []).length, 3);
  assert.ok(html.includes(`value="${selected}" selected=""`));
  assert.equal(requested, `/routes/${selected}/insights`);
  assert.equal(exportRoute, selected);
  if (mode === 'real') assert.ok(html.includes('INR 4321'));
 }
}
console.log('PASS corridor options, defaults, unsupported URL and each route query/export rendering');

// Reproduce the exact original error using the installed library.
assert.throws(() => new jsPDF().setTextColor([52, 211, 153]), /jsPDF.f3/);
const pdf = load('lib/export-generators/anomaly-pdf.ts');
assert.equal(pdf.formatPdfFare(null), 'Unavailable');
assert.equal(pdf.formatPdfFare(NaN), 'Unavailable');
assert.equal(pdf.formatPdfPercent(null), '-');
assert.equal(pdf.formatPdfPercent(-31.5), '-31.5%');
assert.equal(pdf.formatPdfPercent(31.5), '+31.5%');
assert.equal(pdf.safeText('₹7,715'), 'INR 7,715');
assert.equal(pdf.safeText(undefined), '-');
const row = { code: 'ANM-TEST', severity: 'HIGH', route: 'DEL → BOM', actual_fare: 7715,
  expected_fare: null, deviation_pct: -31.5, percentile: null, source: 'Goibibo', status: 'open' };
const job = { id: 'test', export_type: 'ANOMALIES', parameters: { data_mode: 'real', anomaly_data_context: 'IMPORTED', anomaly_rows: [row] } };
for (const count of [1, 300]) {
  const doc = new jsPDF();
  for (const method of ['text', 'rect', 'line', 'setFontSize', 'setLineWidth']) {
    const original = doc[method].bind(doc);
    doc[method] = (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), method);
      if (method === 'text') assert.ok(typeof args[0] === 'string' || Array.isArray(args[0]));
      return original(...args);
    };
  }
  pdf.renderObservedAnomalies(doc, { ...job, parameters: { ...job.parameters, anomaly_rows: Array(count).fill(row) } });
  assert.ok(doc.output().startsWith('%PDF-'));
  assert.ok(doc.output().includes('INR 7,715'));
  assert.ok(doc.output().includes('Unavailable'));
  if (count > 1) assert.ok(doc.getNumberOfPages() > 1);
}
assert.throws(() => pdf.renderObservedAnomalies(new jsPDF(), { parameters: { anomaly_rows: [] } }), /No anomalies/);
(async () => {
  const report = load('lib/export-generators/client-pdf.ts');
  const blob = await report.generateClientReportPdf(job);
  assert.equal(blob.type, 'application/pdf');
  assert.ok((await blob.text()).startsWith('%PDF-'));
  console.log('PASS real jsPDF/AutoTable integration, null fields, signed deviations, INR, empty and multipage export');
})().catch(error => { console.error(error); process.exitCode = 1; });
