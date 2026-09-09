"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, postData } from "@/lib/api/client";

type Quote = { carrier?: string; flight_number?: string; departure_date?: string; departure_time?: string; gross_total?: number; currency?: string; provenance?: { observed_at?: string } };
type Run = { id: string; status: string; created_at: string; quotes_received: number; metadata?: { ingestion_state?: string; result?: { failure_stage?: string; failure_reason?: string; collection_engine?: string; engine?: string; stop_reason?: string; source_url?: string }; processing?: { fareguard_scored: number; priceguard_scored: number; shap_count: number; records_processed: number; index: { status: string; index_value?: number; reason?: string } } }; pipelines?: { id: string; pipeline_type: string; status: string; error_summary?: string }[]; stages?: { id: string; step_name: string; status: string; records_output: number; message?: string }[]; quotes?: { id: string; raw_payload: Quote }[] };

export default function LiveCollection() {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState("happyfares");
  const [origin, setOrigin] = useState("DEL");
  const [destination, setDestination] = useState("BOM");
  const [departure, setDeparture] = useState(() => new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [limit, setLimit] = useState(5);
  const config = useQuery({ queryKey: ["live-config", source], queryFn: () => getData<{ enabled: boolean; worker_enabled: boolean; browser_available?: boolean | null; engine?: string; browser_message?: string; message: string }>("/live/config", { source }), refetchInterval: 30000 });
  const recent = useQuery({ queryKey: ["live-runs"], queryFn: () => getData<Run[]>("/live/runs"), refetchInterval: 5000 });
  const runId = selected ?? recent.data?.[0]?.id;
  const detail = useQuery({ queryKey: ["live-run", runId], queryFn: () => getData<Run>(`/live/runs/${runId}`), enabled: !!runId, refetchInterval: q => q.state.data?.pipelines?.some(p => ["QUEUED", "RUNNING"].includes(p.status)) ? 2000 : 5000 });
  const collect = useMutation({ mutationFn: () => postData<{ collection_run_id: string }>("/live/runs", { source, origin, destination, departure_date: departure, max_results: limit, engine: source === "happyfares" ? "CRAWL4AI" : "AUTO" }), onSuccess: data => { setSelected(data.collection_run_id); cache.invalidateQueries({ queryKey: ["live-runs"] }); } });
  const ingest = useMutation({ mutationFn: () => postData(`/live/runs/${runId}/ingest`), onSuccess: () => cache.invalidateQueries({ queryKey: ["live-run", runId] }) });
  const run = detail.data;
  const state = run?.metadata?.ingestion_state;
  const ingestionFailed = run?.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED");
  const ingestionLabel = state === "FAILED" && !ingestionFailed ? "NOT STARTED" : state ?? "PENDING";
  useEffect(() => {
    if (["COMPLETED", "PARTIAL"].includes(state ?? "")) {
      void cache.invalidateQueries();
    }
  }, [state, runId, cache]);
  const error = collect.error || ingest.error || detail.error || recent.error || config.error;
  const busy = collect.isPending || recent.data?.some(r => ["QUEUED", "RUNNING"].includes(r.status));
  const inputClass = "rounded border border-slate-300 bg-white p-2 text-slate-900";
  return <main className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Live collection</h1><p className="mt-2 text-sm text-slate-500">Collect observed OTA fares, review raw results, then send them through the ingestion pipeline.</p></div>
    <label className="flex items-center gap-3">Source<select className={inputClass} value={source} onChange={e => setSource(e.target.value)}><option value="yatra">Yatra</option><option value="happyfares">HappyFares (prototype)</option></select></label>
    {config.data && !config.data.enabled && <p role="alert" className="rounded border border-amber-400 p-4">{source} is disabled. Configure {source.toUpperCase()}_PROTOTYPE_ENABLED and {source.toUpperCase()}_REVIEW_NOTES after manual review{source === "happyfares" ? ", and enable CRAWL4AI_ENABLED on the API and worker" : ""}.</p>}
    {config.data && !config.data.worker_enabled && <p role="alert">The backend live worker is disabled.</p>}
    {config.data?.browser_available === false && <p role="alert" className="rounded border border-amber-400 p-4">{config.data.browser_message}</p>}
    <form className="flex flex-wrap items-end gap-4 rounded border p-4" onSubmit={e => { e.preventDefault(); collect.mutate(); }}>
      <label className="grid gap-1 text-sm">Origin<input className={inputClass} value={origin} maxLength={3} pattern="[A-Z]{3}" required onChange={e => setOrigin(e.target.value.toUpperCase())} /></label>
      <label className="grid gap-1 text-sm">Destination<input className={inputClass} value={destination} maxLength={3} pattern="[A-Z]{3}" required onChange={e => setDestination(e.target.value.toUpperCase())} /></label>
      <label className="grid gap-1 text-sm">Departure<input className={inputClass} type="date" required value={departure} onChange={e => setDeparture(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Maximum fares<input className={inputClass} type="number" min={1} max={15} required value={limit} onChange={e => setLimit(Number(e.target.value))} /></label>
      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40" disabled={!!busy || !config.data?.enabled || !config.data.worker_enabled || config.data.browser_available === false}>Collect live fares</button>
    </form>
    <p className="text-sm text-slate-500">Engine: {source === "happyfares" ? "Crawl4AI with headless Chromium · Economy · 1 adult · DEL/BOM prototype" : "Playwright with installed Chrome"}. Challenges stop the run. Imported datasets remain available in Data Ingestion.</p>
    {error && <p role="alert" className="rounded border border-red-400 p-4">{error instanceof Error ? error.message : "Unable to load live collection"}</p>}
    <label className="flex items-center gap-3">Recent runs<select className={inputClass} value={runId ?? ""} onChange={e => setSelected(e.target.value)}><option value="" disabled>No runs yet</option>{recent.data?.map(r => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString()} · {r.status} · {r.quotes_received} fares</option>)}</select></label>
    {run && <section className="space-y-4 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Collection {run.status} · Ingestion {ingestionLabel}</h2><p className="text-xs text-slate-500">Run {run.id}</p></div><button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-40" disabled={!(state === "READY_FOR_INGESTION" || (state === "FAILED" && run.quotes_received > 0 && run.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED"))) || ingest.isPending} onClick={() => ingest.mutate()}>{ingestionFailed ? "Retry ingestion" : "Send to ingestion"}</button></div>
      {run.metadata?.result?.failure_stage && <p role="alert" className="text-red-600">{run.metadata.result.failure_stage}: {run.metadata.result.failure_reason}</p>}
      {run.metadata?.result?.source_url && <a className="text-sm text-blue-700 underline" href={run.metadata.result.source_url} target="_blank" rel="noopener noreferrer">Open original search for this run’s departure date</a>}
      {run.pipelines?.map(p => <div key={p.id} className="text-sm">{p.pipeline_type}: {p.status}{p.error_summary && <p role="alert">{p.error_summary}</p>}</div>)}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Stage</th><th>Status</th><th>Output</th><th>Detail</th></tr></thead><tbody>{run.stages?.map(s => <tr key={s.id} className="border-t"><td className="p-2">{s.step_name}</td><td>{s.status}</td><td>{s.records_output}</td><td>{s.message}</td></tr>)}</tbody></table></div>
      <h3 className="font-semibold">Raw observed fares ({run.quotes?.length ?? 0})</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Airline / flight</th><th>Departure</th><th>Observed total</th><th>Observed at</th></tr></thead><tbody>{run.quotes?.map(({ id, raw_payload: q }) => <tr key={id} className="border-t"><td className="py-2">{q.carrier ?? "Unknown"} {q.flight_number}</td><td>{q.departure_date} {q.departure_time}</td><td>{q.currency} {q.gross_total?.toLocaleString()}</td><td>{q.provenance?.observed_at}</td></tr>)}</tbody></table></div>
      {!run.quotes?.length && <p className="text-sm text-slate-500">No observed fares stored for this run.</p>}
      {run.metadata?.processing && <div className="rounded bg-slate-100 p-4 text-slate-900"><p>Validated: {run.metadata.processing.records_processed} · FareGuard: {run.metadata.processing.fareguard_scored} · PriceGuard: {run.metadata.processing.priceguard_scored} · SHAP: {run.metadata.processing.shap_count}</p><p>APIx: {run.metadata.processing.index.index_value?.toFixed(2) ?? run.metadata.processing.index.status} {run.metadata.processing.index.reason}</p></div>}
    </section>}
  </main>;
}
