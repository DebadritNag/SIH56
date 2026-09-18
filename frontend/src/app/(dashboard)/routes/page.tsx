'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Download, Info, Layers, TrendingUp, Database, RefreshCw, ArrowRight } from 'lucide-react';
import { SUPPORTED_CORRIDORS, supportedCorridor } from '@/lib/supported-corridors';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { getData } from '@/lib/api/client';
import { getMockRouteDetail } from '@/lib/mock-data/dashboard';
import { EChartWrapper } from '@/components/charts/EChartWrapper';
import { RouteAdvancePurchaseChart } from '@/components/charts/RouteAdvancePurchaseChart';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { MarketPressureBadge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/formatters';
import { WINDOWS, observedCurve, observedCurveOption, fareText, knownNumber, observationTime, routeContext, Unavailable, RouteSkeleton, FareRange, type RouteObservations } from '@/components/route-intelligence-ui';

export default function RoutesPage() {
  const { mode } = useDataMode();
  return <RouteIntelligence key={mode} live={mode === 'real'} />;
}
function RouteIntelligence({ live }: { live: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRoute = searchParams.get('route');

  const [selectedRouteCode, setSelectedRouteCode] = useState(supportedCorridor(urlRoute));
  const [selectedWindows, setSelectedWindows] = useState<number[]>([1, 7, 15, 30, 45]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (supportedCorridor(urlRoute) !== selectedRouteCode) {
      setSelectedRouteCode(supportedCorridor(urlRoute));
    }
  }, [urlRoute]);

  const handleRouteChange = (newCode: string) => {
    newCode = supportedCorridor(newCode);
    setSelectedRouteCode(newCode);
    router.push(`/routes?route=${newCode}`, { scroll: false });
  };

  const observed = useQuery({
    queryKey: ['route-layout-observations', selectedRouteCode],
    queryFn: () => getData<RouteObservations>(`/routes/${selectedRouteCode}/insights`),
    enabled: live,
  });
  const loading = live && observed.isPending && !observed.data;
  const refreshing = live && observed.isFetching && !!observed.data;
  const data = live ? observed.data : undefined;
  const demo = live ? undefined : getMockRouteDetail(selectedRouteCode);
  const corridor = SUPPORTED_CORRIDORS.find(c => c.id === selectedRouteCode)!;
  const routeName = corridor.label.match(/\((.*)\)/)?.[1].replace(' - ', ' → ') ?? selectedRouteCode;
  const median = live ? data?.current_median_fare : demo?.current_median_fare;
  const distance = live ? data?.distance_km : demo?.distance_km;
  const points = observedCurve(data?.booking_window_breakdown ?? {}, selectedWindows);
  const validPoints = points.filter(p => p.fare != null);
  const sourceRows = demo?.sources_comparison ?? [];
  const metrics = [
    ['7-Day Velocity', demo ? `${demo.change_7d_pct > 0 ? '+' : ''}${demo.change_7d_pct}%` : null],
    ['30-Day Velocity', demo ? `${demo.change_30d_pct > 0 ? '+' : ''}${demo.change_30d_pct}%` : null],
    ['Base Reference Fare', demo ? formatINR(Math.round(demo.current_median_fare / (1 + demo.change_30d_pct / 100))) : null],
    ['Current Route Relative', demo ? (100 + demo.change_30d_pct).toFixed(2) : null],
    ['APIx Contribution', demo ? `${((demo.change_7d_pct * demo.traffic_weight_pct) / 100).toFixed(2)} pts` : null],
    ['Route Weight', demo ? `${demo.traffic_weight_pct}% · DEMO` : null],
  ];
  return <div className="space-y-5 py-4 text-slate-900 selection:bg-blue-100">
    <section aria-label="Route data context" className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5"><Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs"><strong className="text-blue-900">{live ? 'Live Mode' : 'Demo Mode · SYNTHETIC'}</strong><span className="text-blue-700">{live ? routeContext(data) : 'Illustrative route analytics'}</span></div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">{live ? 'Stored eligible route observations. The curve shows observed mean fares by lead time; historical comparisons require matching reference history.' : 'Demonstration values are separate from stored LIVE and IMPORTED observations.'}</p></div></section>
    {live && observed.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><div><p className="font-medium">Unable to load route intelligence.</p><p className="mt-1 text-xs">{observed.error.message}</p></div><button onClick={() => void observed.refetch()} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold focus-visible:outline-2">Retry</button></div>}
    {live && <dl aria-label="Route data summary" className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_1.7fr]">{[
      ['LIVE', data?.live_count], ['IMPORTED', data?.imported_count], ['TOTAL ELIGIBLE', data?.observation_count], ['MEAN FARE', fareText(data?.average_fare)], ['MINIMUM', fareText(data?.min_fare)], ['MAXIMUM', fareText(data?.max_fare)], ['LATEST OBSERVATION', observationTime(data?.latest_observation)],
    ].map(([label, value]) => <div key={label} className={`min-w-0 border-b border-r border-slate-100 px-4 py-3.5 last:border-r-0 ${label === 'LATEST OBSERVATION' ? 'col-span-2 sm:col-span-3 xl:col-span-1' : ''}`}><dt className="text-[10px] font-medium tracking-wide text-slate-500">{label}</dt><dd className="mt-2 text-sm font-semibold tabular-nums">{loading ? <span aria-label="Loading statistic" className="block h-5 w-16 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /> : value ?? 'Unavailable'}</dd></div>)}</dl>}

    <section aria-label="Route selection and metadata" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><MapPin aria-hidden className="h-5 w-5 text-blue-600" />{corridor.origin}<ArrowRight aria-hidden className="h-5 w-5 text-slate-400" />{corridor.destination}</h1>{demo && <MarketPressureBadge pressure={demo.market_status} />}{refreshing && <span role="status" className="flex items-center gap-1.5 text-xs text-blue-600"><RefreshCw aria-hidden className="h-3 w-3 animate-spin motion-reduce:animate-none" />Refreshing…</span>}</div><p className="mt-2 text-sm text-slate-500">{routeName}</p></div>
      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-end lg:w-auto"><label className="grid min-w-0 flex-1 gap-1.5 text-[11px] font-medium text-slate-500">Select Route<select aria-label="Select Route" value={selectedRouteCode} onChange={e => handleRouteChange(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-200 lg:min-w-[250px]">{SUPPORTED_CORRIDORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><button onClick={() => setShowExport(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Download aria-hidden className="h-4 w-4" />Export Route Report</button></div></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4"><dl className="flex flex-wrap gap-2 text-[10px]">{[['Flight distance', knownNumber(distance) ? `${distance.toLocaleString('en-IN')} km` : 'Unavailable'], ['DGCA Passenger Traffic Weight', demo ? `${demo.traffic_weight_pct}% · DEMO` : 'Unavailable'], ['Statistical Confidence', demo ? `${demo.data_confidence_pct}% · DEMO` : 'Not calculated']].map(([label, value]) => <div key={label} className="flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-2"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{loading ? <span className="inline-block h-3 w-12 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /> : value}</dd></div>)}</dl>
      <div role="group" aria-label="Booking-window filters" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">{WINDOWS.map(w => <button key={w} type="button" aria-pressed={selectedWindows.includes(w)} title={`Toggle T+${w} window`} onClick={() => { if (selectedWindows.includes(w)) { if (selectedWindows.length > 1) setSelectedWindows(selectedWindows.filter(x => x !== w)); } else setSelectedWindows([...selectedWindows, w].sort((a, b) => a - b)); }} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 ${selectedWindows.includes(w) ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white'}`}>T+{w}</button>)}</div></div>
    </section>

    <ExportDialog open={showExport} onClose={() => setShowExport(false)} exportType="ROUTE_INTELLIGENCE" defaultFormat="PDF" title={`Corridor Performance Report (${selectedRouteCode})`} filters={{ route: selectedRouteCode }} filterSummary={[{ label: 'Corridor', value: selectedRouteCode }, { label: 'DGCA Passenger Traffic Weight', value: demo ? `${demo.traffic_weight_pct}% · DEMO` : 'Unavailable' }, { label: 'Market Status', value: demo?.market_status ?? 'UNKNOWN' }]} />

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)]">
      <section aria-labelledby="representative-fare" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-2"><h2 id="representative-fare" className="text-sm font-semibold">Current Representative Fare</h2><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">Median</span></div>
      {loading ? <div className="mt-4"><RouteSkeleton label="Loading representative fare" /></div> : <><p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{fareText(median)}</p><p className="mt-2 text-xs text-slate-500">{live ? `${data?.source_coverage_count ?? '—'} sources · ${data?.observation_count ?? '—'} stored observations` : `${sourceRows.length} demo source channels`}</p>{live && data?.observation_count === 0 && <p className="mt-3 text-xs text-amber-800">No eligible stored observations for this route.</p>}<FareRange min={data?.min_fare} median={median} max={data?.max_fare} /></>}
      <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100">{metrics.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-xs"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold tabular-nums">{loading ? <span className="block h-4 w-16 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /> : value != null ? value : <Unavailable />}</dd></div>)}</dl>{live && <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Historical comparisons, official weights and index relatives are shown only when supplied by the statistical pipeline.</p>}</section>
      <section aria-labelledby="advance-purchase" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-2"><div><h2 id="advance-purchase" className="flex items-center gap-2 text-sm font-semibold"><TrendingUp aria-hidden className="h-4 w-4 text-blue-600" />Advance Purchase Curve</h2><p className="mt-1.5 text-xs text-slate-500">{live ? 'Observed mean fare by advance-purchase lead time.' : 'Demo representative fare and historical comparison by lead time.'}</p></div><span title="Shows how observed fares vary with proximity to departure; it is not a calculated score." className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500">Lead Time Compression</span></div>
      <div className="px-4 py-2" aria-label="Advance-purchase fare chart">{loading ? <RouteSkeleton tall label="Loading advance-purchase curve" /> : live ? validPoints.length ? <EChartWrapper option={observedCurveOption(points)} style={{ height: 350 }} /> : <div className="flex min-h-[290px] flex-col items-center justify-center gap-3 p-6 text-center"><TrendingUp aria-hidden className="h-7 w-7 text-slate-300" /><p className="text-sm text-slate-600">Insufficient observations for advance-purchase curve.</p><p className="text-xs text-slate-500">No observed fares match the selected windows.</p></div> : <RouteAdvancePurchaseChart curveData={demo!.advance_purchase_curve} selectedWindows={selectedWindows} />}</div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[11px] text-slate-500"><span>Coverage <strong className="ml-1 font-medium text-slate-800">{loading ? 'Loading…' : live ? `${validPoints.length} observed lead-time points` : `${demo!.advance_purchase_curve.filter(p => selectedWindows.includes(p.days_prior)).length} demo points`}</strong></span><span>Sources <strong className="ml-1 font-medium text-slate-800">{loading ? 'Loading…' : live ? data?.source_coverage_count ?? 'Unavailable' : sourceRows.length}</strong></span>{live && <span>Latest <strong className="ml-1 font-medium text-slate-800">{loading ? 'Loading…' : observationTime(data?.latest_observation)}</strong></span>}</div>
      {live && validPoints.length > 0 && <details className="border-t border-slate-100 px-5 py-3 text-xs"><summary className="cursor-pointer rounded text-blue-700 focus-visible:outline-2">View observed curve values</summary><table className="mt-3 w-full text-left"><thead><tr><th className="py-2 font-medium">Lead time</th><th className="py-2 font-medium">Observed mean fare</th></tr></thead><tbody>{points.map(p => <tr key={p.day} className="border-t border-slate-100"><td className="py-2">T+{p.day}</td><td className="py-2 tabular-nums">{fareText(p.fare)}</td></tr>)}</tbody></table></details>}</section>
    </div>

    <section aria-labelledby="source-comparison" className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h2 id="source-comparison" className="flex items-center gap-2 text-sm font-semibold"><Layers aria-hidden className="h-4 w-4 text-blue-600" />Cross-Channel Source Comparison</h2><p className="mt-1.5 text-xs text-slate-500">Evaluate multi-source price convergence between airline-direct portals and Online Travel Aggregators.</p></div><Unavailable>Source agreement: Not calculated</Unavailable></div>
      {loading ? <div className="p-5 pt-0"><RouteSkeleton label="Loading source comparison" /></div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50 text-[10px] text-slate-500"><tr>{['Source Channel', 'Channel Type', 'Median Fare', 'Lowest Observed', 'Observations Today', 'Freshness', 'Agreement State', 'Reliability Rating'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{sourceRows.map((src, idx) => <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-4 py-3 font-medium">{src.source_name}</td><td className="px-4 py-3 text-slate-500">{src.source_type}</td><td className="px-4 py-3 font-semibold tabular-nums">{fareText(src.median_fare)}</td><td className="px-4 py-3 tabular-nums">{fareText(src.min_fare)}</td><td className="px-4 py-3 tabular-nums">{src.observations}</td><td className="px-4 py-3 text-slate-500">{src.freshness}</td><td className="px-4 py-3">{src.agreement_status}</td><td className="px-4 py-3 tabular-nums">{knownNumber(src.reliability_score) ? `${(src.reliability_score * 100).toFixed(1)}%` : 'Unavailable'}</td></tr>)}</tbody></table>{!sourceRows.length && <div className="flex flex-col items-center gap-3 px-5 py-10 text-center"><Database aria-hidden className="h-7 w-7 text-slate-300" /><p className="text-sm font-medium text-slate-600">Per-source comparison statistics are not yet available for this route.</p><p className="max-w-xl text-xs leading-relaxed text-slate-500">Available source coverage is shown above. Source-level fare comparisons will appear when available.</p></div>}</div>}
    </section>
  </div>;
}
