"use client";

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Copy, ExternalLink, History, Loader2, Plane, XCircle } from 'lucide-react';
import type { Run, Quote } from './live-collection-types';

export function engineLabel(engine?: string): string {
  return engine === 'CRAWL4AI' ? 'Playwright (Crawl4AI)' : engine === 'PLAYWRIGHT' ? 'Playwright' : engine ?? 'Awaiting configuration';
}
export function isActiveRun(run: Run): boolean {
  return ['QUEUED', 'RUNNING'].includes(run.status) || ['QUEUED', 'RUNNING'].includes(run.metadata?.ingestion_state ?? '') || !!run.pipelines?.some(p => ['QUEUED', 'RUNNING'].includes(p.status));
}
export function displayTimestamp(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric', hour12: false }).format(new Date(value)) + ' IST';
}
export function StatusChip({ status }: { status: string }) {
  const running = ['RUNNING', 'QUEUED', 'SUBMITTING', 'LOADING'].includes(status);
  const complete = status === 'COMPLETED';
  const failure = ['FAILED', 'BLOCKED', 'CAPTCHA_DETECTED'].includes(status);
  const caution = ['PARTIAL', 'RATE_LIMITED', 'NO_AVAILABILITY', 'SKIPPED'].includes(status);
  const color = complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : failure ? 'border-red-200 bg-red-50 text-red-800' : running ? 'border-blue-200 bg-blue-50 text-blue-800' : caution ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600';
  const Icon = complete ? CheckCircle2 : failure ? XCircle : running ? Loader2 : Circle;
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${color}`}><Icon aria-hidden className={`h-3 w-3 shrink-0 ${running ? 'animate-spin motion-reduce:animate-none' : ''}`} /><span className="break-words">{status}</span></span>;
}
export function LoadingPanel({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="space-y-4 p-5"><p className="text-xs text-slate-500">{label}…</p>{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />)}</div>;
}
const sourceName = (source?: string) => source === 'happyfares' ? 'HappyFares' : source === 'yatra' ? 'Yatra' : source ?? '—';

export function RunHistory({ runs, loading, error, refreshing, selectedId, disabled, onSelect }: {
  runs?: Run[]; loading: boolean; error: boolean; refreshing: boolean; selectedId?: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const total = runs?.length ?? 0;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const visible = runs?.slice(currentPage * pageSize, (currentPage + 1) * pageSize) ?? [];
  return <section aria-labelledby="collection-history" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 p-5"><div className="flex items-center justify-between gap-3"><h2 id="collection-history" className="flex items-center gap-2 text-sm font-semibold"><History aria-hidden className="h-4 w-4 text-blue-600" />Recent runs</h2>{refreshing && <span role="status" className="text-xs text-slate-500">Refreshing…</span>}</div><p className="mt-1.5 text-xs text-slate-500">Select a run to view detailed results</p>
      <select aria-label="Recent runs" className="mt-4 h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-60" value={selectedId ?? ''} disabled={disabled || loading || !total} onChange={e => onSelect(e.target.value)}><option value="" disabled>{loading ? 'Loading runs…' : 'No runs yet'}</option>{runs?.map(r => <option key={r.id} value={r.id}>{r.metadata?.request?.origin ?? '—'} → {r.metadata?.request?.destination ?? '—'} · {r.metadata?.request?.departure_date ?? '—'} · {displayTimestamp(r.started_at ?? r.created_at)} · {r.status} · {r.quotes_received} fares</option>)}</select>
    </div>
    {loading ? <LoadingPanel label="Loading stored collection history" /> : error && !runs ? <p role="alert" className="p-5 text-sm text-red-700">Collection history could not be loaded.</p> : !total ? <div className="px-5 py-14 text-center"><History aria-hidden className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-medium">No collection runs yet</p><p className="mt-1 text-xs text-slate-500">Collect live fares to create your first run.</p></div> : <>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="px-5 py-3 text-left text-xs font-semibold text-slate-600">Collection Run History <span className="ml-1 font-normal text-slate-400">· {total} stored runs</span></caption><thead className="border-y border-slate-100 bg-slate-50 text-[10px] text-slate-500"><tr>{['Corridor / departure', 'Source', 'Status', 'Quotes', 'Started', 'Completed'].map(h => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.id} aria-selected={selectedId === r.id} className={`border-b border-slate-100 last:border-0 ${selectedId === r.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}><td className="px-4 py-3"><button type="button" aria-label={`Open collection run ${r.id}`} disabled={disabled} onClick={() => onSelect(r.id)} className="whitespace-nowrap rounded text-left font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{r.metadata?.request?.origin ?? '—'} → {r.metadata?.request?.destination ?? '—'}<span className="mt-1 block text-[10px] font-normal text-slate-500">{r.metadata?.request?.departure_date ?? '—'}</span></button></td><td className="px-4 py-3">{sourceName(r.metadata?.request?.source)}</td><td className="px-4 py-3"><StatusChip status={r.status} /></td><td className="px-4 py-3 font-semibold tabular-nums">{r.quotes_received}</td><td className="min-w-28 px-4 py-3 text-[10px] leading-relaxed text-slate-500">{displayTimestamp(r.started_at)}</td><td className="min-w-28 px-4 py-3 text-[10px] leading-relaxed text-slate-500">{displayTimestamp(r.finished_at)}</td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500"><span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, total)} of {total} returned runs</span><div className="flex gap-2"><button aria-label="Previous history page" disabled={currentPage === 0} className="rounded border p-1.5 focus-visible:outline-2 disabled:opacity-30" onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-3.5 w-3.5" /></button><button aria-label="Next history page" disabled={(currentPage + 1) * pageSize >= total} className="rounded border p-1.5 focus-visible:outline-2 disabled:opacity-30" onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-3.5 w-3.5" /></button></div></div>
    </>}
  </section>;
}

function observedTotal(q: Quote): string {
  return q.gross_total != null && Number.isFinite(q.gross_total) && q.gross_total > 0 ? `${q.currency ?? ''} ${q.gross_total.toLocaleString('en-IN')}`.trim() : 'Unavailable';
}

export function RunInspector({ run, ingestionLabel, refreshing }: { run: Run; ingestionLabel: string; refreshing: boolean }) {
  const [copyStatus, setCopyStatus] = useState('');
  const copyId = async () => { try { await navigator.clipboard.writeText(run.id); setCopyStatus('Run ID copied'); } catch { setCopyStatus('Copy unavailable. Select the run ID to copy it.'); } };
  const sourceUrl = run.metadata?.result?.source_url;
  const safeUrl = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : undefined;
  return <div className="space-y-5 p-5">
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium">Collection</span><StatusChip status={run.status} /><span className="text-slate-400">·</span><span className="font-medium">Ingestion</span><StatusChip status={ingestionLabel} /></div><p className="mt-3 text-xs font-medium">{run.metadata?.request?.origin ?? '—'} → {run.metadata?.request?.destination ?? '—'} <span className="font-normal text-slate-500">· {run.metadata?.request?.departure_date ?? '—'} · {sourceName(run.metadata?.request?.source)}</span></p><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><span className="shrink-0">Run ID</span><code className="min-w-0 break-all select-all">{run.id}</code><button type="button" title="Copy run ID" aria-label="Copy run ID" className="shrink-0 rounded p-1 hover:bg-white focus-visible:outline-2" onClick={() => void copyId()}><Copy aria-hidden className="h-3.5 w-3.5" /></button></div>{copyStatus && <p role="status" className="mt-1 text-[10px] text-slate-500">{copyStatus}</p>}</div>
    {refreshing && <p role="status" className="text-xs text-slate-500">Refreshing saved run details…</p>}
    {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2"><ExternalLink aria-hidden className="h-3.5 w-3.5" />Open original search for this run’s departure date</a>}
    {run.metadata?.result?.failure_stage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800"><p className="font-semibold">{run.metadata.result.failure_stage}</p><p className="mt-1 break-words">{run.metadata.result.failure_reason}</p></div>}
    {run.pipelines?.map(p => <div key={p.id} className="text-xs"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{p.pipeline_type}:</span><StatusChip status={p.status} /></div>{p.error_summary && <p role="alert" className="mt-2 break-words text-red-700">{p.error_summary}</p>}</div>)}
    <section aria-label="Stage output summary"><h3 className="text-xs font-semibold">Stage output summary</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{run.stages?.map((s, index) => <div key={s.id} className="min-w-0 rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span>{String(index + 1).padStart(2, '0')}</span><span className="text-base font-semibold tabular-nums text-slate-900">{s.records_output ?? '—'}</span></div><p className="mt-2 break-words font-mono text-[9px] font-medium text-slate-700">{s.step_name}</p><div className="mt-2"><StatusChip status={s.status} /></div>{s.message && <p className="mt-2 break-words text-[10px] leading-relaxed text-slate-500">{s.message}</p>}</div>)}</div>{!run.stages?.length && <p className="mt-2 text-xs text-slate-500">No stage outputs recorded yet.</p>}</section>
    <section aria-label="Extracted fares"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-semibold"><Plane aria-hidden className="h-4 w-4 text-blue-600" />Extracted fares</h3><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">{run.quotes?.length ?? 0} fares</span></div>
      {run.quotes?.length ? <><div className="divide-y divide-slate-100 rounded-lg border border-slate-200 md:hidden">{run.quotes.map(({ id, raw_payload: q }) => <article key={id} className="p-3"><div className="flex items-start justify-between gap-3 text-xs"><div><p className="font-semibold">{q.carrier ?? '—'}</p><p className="mt-1 text-slate-500">{q.flight_number ?? '—'}</p></div><p className="font-semibold tabular-nums">{observedTotal(q)}</p></div><dl className="mt-3 space-y-2 text-[10px]"><div className="flex justify-between gap-3"><dt className="text-slate-500">Departure</dt><dd>{q.departure_date ?? '—'} {q.departure_time ?? '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Observed at</dt><dd className="text-right">{displayTimestamp(q.provenance?.observed_at)}</dd></div></dl></article>)}</div><div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-500"><tr>{['Airline / flight', 'Departure', 'Observed total', 'Observed at'].map(h => <th scope="col" key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr></thead><tbody>{run.quotes.map(({ id, raw_payload: q }) => <tr key={id} className="border-t border-slate-100"><td className="px-3 py-3 font-medium">{q.carrier ?? '—'}<span className="mt-1 block text-[10px] font-normal text-slate-500">{q.flight_number ?? '—'}</span></td><td className="px-3 py-3 text-[11px]">{q.departure_date ?? '—'}<span className="mt-1 block text-slate-500">{q.departure_time ?? '—'}</span></td><td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{observedTotal(q)}</td><td className="min-w-28 px-3 py-3 text-[10px] leading-relaxed text-slate-500">{displayTimestamp(q.provenance?.observed_at)}</td></tr>)}</tbody></table></div></> : <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No fares were extracted for this run.<p className="mt-1">Recorded collection status: {run.status}</p></div>}
    </section>
    {run.metadata?.processing && <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><p>Validated: {run.metadata.processing.records_processed} · FareGuard: {run.metadata.processing.fareguard_scored} · PriceGuard: {run.metadata.processing.priceguard_scored} · SHAP: {run.metadata.processing.shap_count}</p><p className="mt-1">APIx: {run.metadata.processing.index.index_value?.toFixed(2) ?? run.metadata.processing.index.status} {run.metadata.processing.index.reason}</p></div>}
  </div>;
}
