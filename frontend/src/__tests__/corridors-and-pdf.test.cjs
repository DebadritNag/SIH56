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
    if (name.startsWith('./')) {
      const base = path.resolve(path.dirname(filename), name);
      return load(path.relative(root, fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx'), mocks);
    }
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
const routeUi = load('components/route-intelligence-ui.tsx', { '@/lib/formatters': { formatINR: n => `INR ${n}` } });
let routeResult = { data: { current_median_fare: 4321, booking_window_breakdown: { 'T+7': 4321 } } };
const mocks = {
  '@/components/route-intelligence-ui': routeUi,
  '@/lib/supported-corridors': corridors,
  '@/lib/providers/DataModeProvider': { useDataMode: () => ({ mode }) },
  '@tanstack/react-query': { useQuery: options => {
    options.queryFn();
    return routeResult;
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
assert.equal(routeUi.fareText(null), 'Unavailable');
assert.equal(routeUi.fareText(NaN), 'Unavailable');
assert.equal(routeUi.routeContext({ live_count: 0, imported_count: 8 }), 'IMPORTED fallback');
assert.equal(routeUi.routeContext({ live_count: 3, imported_count: 8 }), 'Hybrid LIVE + IMPORTED');
assert.equal(routeUi.routeContext({ live_count: 3, imported_count: 0 }), 'LIVE observations');
assert.equal(routeUi.routeContext({ live_count: 0, imported_count: 0 }), 'No eligible observations');
const curve = routeUi.observedCurve({ T7: 4000, T19: 6000 }, [1, 7, 15, 30, 45]);
assert.deepEqual(curve, [{ day: 45, fare: null }, { day: 30, fare: null }, { day: 19, fare: 6000 }, { day: 7, fare: 4000 }, { day: 1, fare: null }]);
assert.deepEqual(routeUi.observedCurve({ T7: 4000, T19: 6000 }, [7]), [{ day: 7, fare: 4000 }]);
assert.equal(routeUi.observedCurveOption(curve).series[0].connectNulls, false);
assert.equal(routeUi.observedCurveOption(curve).series[0].name, 'Stored observed mean fare');
mode = 'real'; urlRoute = 'DEL-CCU';
routeResult = { isPending: true };
const loadingRoute = renderToStaticMarkup(React.createElement(Page));
assert.ok(loadingRoute.includes('Loading representative fare'));
assert.ok(!loadingRoute.includes('INR 0'));
assert.ok(!loadingRoute.includes('0 stored observations'));
routeResult = { data: { live_count: 0, imported_count: 0, observation_count: 0, booking_window_breakdown: {} } };
const emptyRoute = renderToStaticMarkup(React.createElement(Page));
assert.ok(emptyRoute.includes('No eligible stored observations'));
assert.ok(emptyRoute.includes('Insufficient observations for advance-purchase curve'));
routeResult = { isError: true, error: new Error('Connection failed') };
assert.ok(renderToStaticMarkup(React.createElement(Page)).includes('Unable to load route intelligence.'));
console.log('PASS route provenance, missing-window gaps, filter grouping, loading, empty and error states');

const mutations = [], requests = [];
const LiveCollection = load('components/LiveCollection.tsx', {
  '@/lib/supported-corridors': corridors,
  './LiveCollectionTelemetry': { __esModule: true, default: stub },
  'lucide-react': require('lucide-react'),
  '@/lib/queryInvalidation': { invalidateAfterCollection: stub, invalidateAfterIngestion: stub },
  '@/lib/api/client': {
    getData: (url, params) => { requests.push({ url, params }); },
    postData: (url, payload) => { requests.push({ url, payload }); },
  },
  '@tanstack/react-query': {
    useQueryClient: () => ({ invalidateQueries: stub }),
    useMutation: options => { mutations.push(options); return { isPending: false }; },
    useQuery: options => {
      options.queryFn();
      if (options.queryKey[0] === 'live-config') return { data: {
        corridors: corridors.SUPPORTED_CORRIDORS, enabled: true, worker_enabled: true,
      } };
      if (options.queryKey[0] === 'live-runs') return { data: [{
        id: 'historical-yatra', created_at: '2026-09-06T12:00:00Z', status: 'FAILED', quotes_received: 0,
        metadata: { request: { source: 'yatra', origin: 'DEL', destination: 'BOM' } },
      }] };
      return {};
    },
  },
}).default;
const collectionHtml = renderToStaticMarkup(React.createElement(LiveCollection));
const sourceSelector = collectionHtml.match(/Source<select[^>]*>(.*?)<\/select>/)[1];
assert.equal(sourceSelector, '<option value="happyfares" selected="">HappyFares</option>');
assert.ok(!sourceSelector.toLowerCase().includes('yatra'));
assert.ok(!collectionHtml.includes('HappyFares (prototype)'));
assert.ok(collectionHtml.includes('historical-yatra'));
assert.ok(collectionHtml.includes('>Yatra</td>')); // Historical provenance is still rendered.
assert.deepEqual(requests.find(r => r.url === '/live/config').params, { source: 'happyfares' });
mutations[0].mutationFn();
const collectionRequest = requests.find(r => r.payload);
assert.equal(collectionRequest.url, '/live/runs');
assert.equal(collectionRequest.payload.source, 'happyfares');
assert.equal(collectionRequest.payload.engine, 'CRAWL4AI');
assert.equal(collectionRequest.payload.origin, 'DEL');
assert.equal(collectionRequest.payload.destination, 'BOM');
assert.equal(collectionRequest.payload.max_results, 5);
assert.match(collectionRequest.payload.departure_date, /^\d{4}-\d{2}-\d{2}$/);
console.log('PASS HappyFares-only selector, unchanged collection payload and preserved Yatra history');

const liveUi = load('components/live-collection-ui.tsx');
assert.equal(liveUi.engineLabel('CRAWL4AI'), 'Playwright (Crawl4AI)');
assert.equal(liveUi.isActiveRun({ status: 'COMPLETED' }), false);
assert.equal(liveUi.isActiveRun({ status: 'FAILED' }), false);
assert.equal(liveUi.isActiveRun({ status: 'RUNNING' }), true);
assert.equal(liveUi.isActiveRun({ status: 'COMPLETED', metadata: { ingestion_state: 'RUNNING' } }), true);
const Telemetry = load('components/LiveCollectionTelemetry.tsx').default;
const telemetryHtml = renderToStaticMarkup(React.createElement(Telemetry, {
  status: 'COMPLETED', engine: 'CRAWL4AI', now: Date.now(), count: 2,
  recordedSteps: [{ step_name: 'POLICY_CHECK', status: 'COMPLETED', records_output: 0 }, { step_name: 'RAW_STORAGE', status: 'RUNNING' }],
}));
assert.match(telemetryHtml, /max="6" value="1"/); // Run completion never fabricates stage completion.
assert.ok(telemetryHtml.includes('Playwright (Crawl4AI)'));
for (const status of ['BLOCKED', 'RATE_LIMITED', 'CAPTCHA_DETECTED', 'NO_AVAILABILITY', 'PARTIAL']) {
  assert.ok(renderToStaticMarkup(React.createElement(liveUi.StatusChip, { status })).includes(status));
}
const inspector = renderToStaticMarkup(React.createElement(liveUi.RunInspector, {
  run: { id: 'real-stored-id', status: 'PARTIAL', quotes_received: 1,
    quotes: [{ id: 'stored-quote', raw_payload: { carrier: 'Observed carrier', gross_total: null } }] },
  ingestionLabel: 'READY_FOR_INGESTION', refreshing: false,
}));
assert.ok(inspector.includes('Observed carrier'));
assert.ok(inspector.includes('Unavailable'));
assert.ok(inspector.includes('real-stored-id'));
assert.ok(!inspector.includes('href='));
const emptyHistory = renderToStaticMarkup(React.createElement(liveUi.RunHistory, { runs: [], onSelect: stub }));
assert.ok(emptyHistory.includes('No collection runs yet'));
console.log('PASS backend-authoritative stages, terminal polling, distinct statuses, missing fares and empty history');

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

module.exports = { load, root };
