'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getData, getPaginated } from '@/lib/api/client';

type Run = { id: string; status: string; started_at?: string; created_at?: string; duration_ms?: number; quotes_received?: number; quotes_validated?: number };
type Pipeline = { id: string; pipeline_type: string; status: string; error_summary?: string; steps: { id: string; step_name: string; status: string; records_output: number; message?: string }[] };
const tone = (status: string) => /FAILED/i.test(status) ? 'bg-red-50 text-red-700' : /RUNNING|QUEUED/i.test(status) ? 'bg-blue-50 text-blue-700' : /COMPLETED/i.test(status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800';

export default function LivePipelineMonitor() {
  const [selected, setSelected] = useState<string>();
  const runs = useQuery({ queryKey: ['pipeline-monitor-runs'], queryFn: () => getPaginated<Run>('/ingestion/runs', { page_size: 30 }), refetchInterval: 5000 });
  const runId = selected ?? runs.data?.items[0]?.id;
  const detail = useQuery({ queryKey: ['pipeline-monitor-detail', runId], queryFn: () => getData<{ pipeline_runs: Pipeline[] }>(`/ingestion/runs/${runId}`), enabled: !!runId, refetchInterval: 3000 });
  const items = runs.data?.items ?? [];
  const error = runs.error || detail.error;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Pipeline Monitor</h1><p className="mt-1 text-sm text-slate-500">Recorded collection and processing runs · refreshed every 5 seconds</p></div><Link className="rounded-lg border bg-white px-4 py-2 text-sm text-blue-700" href="/ingestion">Open Data Ingestion</Link></header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Recent runs', items.length], ['Queued / running', items.filter(r => /^(QUEUED|RUNNING)$/i.test(r.status)).length], ['Failed', items.filter(r => /^FAILED$/i.test(r.status)).length], ['Completed / partial', items.filter(r => /^(COMPLETED|PARTIAL)$/i.test(r.status)).length]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{runs.isPending || runs.isError ? '—' : value}</p></div>)}</div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error.message}<button className="ml-3 underline" onClick={() => { void runs.refetch(); if (runId) void detail.refetch(); }}>Retry</button></div>}
    {runs.isPending && <p role="status">Loading recorded pipeline runs…</p>}
    {!runs.isPending && !runs.isError && !items.length && <div className="rounded-xl border bg-white p-8 text-center">No pipeline runs recorded. Start a collection from Data Ingestion or Live Collection.</div>}
    {!!items.length && <section className="space-y-4 rounded-xl border bg-white p-5"><label className="grid gap-2 text-sm font-semibold">Inspect run<select className="w-full rounded-lg border p-2 font-normal" value={runId} onChange={e => setSelected(e.target.value)}>{items.map(r => <option key={r.id} value={r.id}>{r.started_at || r.created_at ? new Date(r.started_at || r.created_at!).toLocaleString() : 'Time unavailable'} · {r.status} · {r.id.slice(0, 8)}</option>)}</select></label>
      {detail.isPending && <p role="status">Loading stage telemetry…</p>}
      {detail.data?.pipeline_runs.map(p => <div key={p.id} className="space-y-3 border-t pt-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{p.pipeline_type.replaceAll('_', ' ')}</h2><span className={`rounded px-2 py-1 text-xs ${tone(p.status)}`}>{p.status}</span></div>{p.error_summary && <p role="alert" className="text-sm text-red-700">{p.error_summary}</p>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{p.steps.map((s, index) => <div key={s.id} className="rounded-lg border p-3"><p className="text-xs text-slate-500">Stage {index + 1}</p><h3 className="mt-1 text-sm font-semibold">{s.step_name}</h3><span className={`my-2 inline-block rounded px-2 py-1 text-xs ${tone(s.status)}`}>{s.status}</span><p className="text-sm">{s.records_output ?? 0} output records</p><p className="mt-2 text-xs text-slate-500">{s.message || 'No stage message recorded.'}</p></div>)}</div>{!p.steps.length && <p className="text-sm text-slate-500">No stages recorded yet.</p>}</div>)}
      {detail.data && !detail.data.pipeline_runs.length && <p className="text-sm text-slate-500">No pipeline telemetry recorded for this run.</p>}
    </section>}
  </div>;
}
