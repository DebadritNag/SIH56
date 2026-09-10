"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LiveCollectionTelemetry, { type CollectionProgress } from "./LiveCollectionTelemetry";
import { Clock3, Loader2 } from "lucide-react";
import { getData, postData } from "@/lib/api/client";

type Quote = { carrier?: string; flight_number?: string; departure_date?: string; departure_time?: string; gross_total?: number; currency?: string; provenance?: { observed_at?: string } };
type Run = { id: string; status: string; started_at?: string; finished_at?: string; created_at: string; quotes_received: number; metadata?: { progress?: CollectionProgress; request?: { source?: string; origin?: string; destination?: string; departure_date?: string }; ingestion_state?: string; result?: { failure_stage?: string; failure_reason?: string; collection_engine?: string; engine?: string; stop_reason?: string; source_url?: string }; processing?: { fareguard_scored: number; priceguard_scored: number; shap_count: number; records_processed: number; index: { status: string; index_value?: number; reason?: string } } }; pipelines?: { id: string; pipeline_type: string; status: string; error_summary?: string }[]; stages?: { id: string; step_name: string; status: string; records_output: number; message?: string }[]; quotes?: { id: string; raw_payload: Quote }[] };

export default function LiveCollection() {
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState("happyfares");
  const [corridorId, setCorridorId] = useState("DEL-BOM");
  const submitLock = useRef(false);
  const [refreshingIngestion, setRefreshingIngestion] = useState(false);
  const [departure, setDeparture] = useState(() => new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [limit, setLimit] = useState(5);
  const config = useQuery({ queryKey: ["live-config", source], queryFn: () => getData<{ corridors: { id: string; origin: string; destination: string; label: string }[]; server_now?: string; cooldown_until?: string | null; enabled: boolean; worker_enabled: boolean; browser_available?: boolean | null; engine?: string; browser_message?: string; message: string }>("/live/config", { source }), refetchInterval: 15000 });
  const corridor = config.data?.corridors?.find(c => c.id === corridorId);
  const origin = corridor?.origin;
  const destination = corridor?.destination;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const recent = useQuery({ queryKey: ["live-runs"], queryFn: () => getData<Run[]>("/live/runs"), refetchInterval: 5000 });
  const runId = selected ?? recent.data?.[0]?.id;
  const detail = useQuery({ queryKey: ["live-run", runId], queryFn: () => getData<Run>(`/live/runs/${runId}`), enabled: !!runId, refetchInterval: q => q.state.data?.pipelines?.some(p => ["QUEUED", "RUNNING"].includes(p.status)) ? 2000 : 5000 });
  const collect = useMutation({ mutationFn: () => postData<{ collection_run_id: string }>("/live/runs", { source, origin, destination, departure_date: departure, max_results: limit, engine: source === "happyfares" ? "CRAWL4AI" : "AUTO" }), onSuccess: data => { setSelected(data.collection_run_id); cache.invalidateQueries({ queryKey: ["live-runs"] }); cache.invalidateQueries({ queryKey: ["live-config", source] }); }, onError: () => { cache.invalidateQueries({ queryKey: ["live-config", source] }); }, onSettled: () => { submitLock.current = false; } });
  const ingest = useMutation({ mutationFn: () => postData(`/live/runs/${runId}/ingest`), onSuccess: () => cache.invalidateQueries({ queryKey: ["live-run", runId] }) });
  const run = detail.data;
  const state = run?.metadata?.ingestion_state;
  const ingestionFailed = run?.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED");
  const ingestionBusy = ingest.isPending || refreshingIngestion || ["QUEUED", "RUNNING"].includes(state ?? "") || !!run?.pipelines?.some(p => p.pipeline_type === "live_ingestion" && ["QUEUED", "RUNNING"].includes(p.status));
  const ingestionLabel = state === "FAILED" && !ingestionFailed ? "NOT STARTED" : state ?? "PENDING";
  useEffect(() => {
    if (["COMPLETED", "PARTIAL"].includes(state ?? "")) {
      setRefreshingIngestion(true);
      void cache.invalidateQueries().finally(() => setRefreshingIngestion(false));
    }
  }, [state, runId, cache]);
  useEffect(() => {
    if (run?.status === "FAILED" || run?.status === "COMPLETED") {
      void cache.invalidateQueries({ queryKey: ["live-config"] });
      void cache.invalidateQueries({ queryKey: ["live-runs"] });
    }
  }, [run?.status, run?.id, cache]);
  const cooldownSeconds = config.data?.cooldown_until && config.data.server_now
    ? Math.max(0, Math.ceil((Date.parse(config.data.cooldown_until) - Date.parse(config.data.server_now) - Math.max(0, now - config.dataUpdatedAt)) / 1000)) : 0;
  const cooldownLabel = `${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, "0")}`;
  const error = collect.error || ingest.error || detail.error || recent.error || config.error;
  const busy = collect.isPending || ["QUEUED", "RUNNING"].includes(run?.status ?? "") || recent.data?.some(r => ["QUEUED", "RUNNING"].includes(r.status));
  const activeRequest = collect.isPending ? { origin, destination, departure_date: departure } : (run?.status === "RUNNING" || run?.status === "QUEUED" ? run : recent.data?.find(r => ["RUNNING", "QUEUED"].includes(r.status)))?.metadata?.request;
  const inputClass = "rounded border border-slate-300 bg-white p-2 text-slate-900";
  return <main className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Live collection</h1><p className="mt-2 text-sm text-slate-500">Collect observed OTA fares, review raw results, then send them through the ingestion pipeline.</p></div>
    <label className="flex items-center gap-3">Source<select className={inputClass} value={source} disabled={!!busy} onChange={e => { setSource(e.target.value); collect.reset(); }}><option value="yatra">Yatra</option><option value="happyfares">HappyFares (prototype)</option></select></label>
    {config.data && !config.data.enabled && <p role="alert" className="rounded border border-amber-400 p-4">{source} is disabled. Configure {source.toUpperCase()}_PROTOTYPE_ENABLED and {source.toUpperCase()}_REVIEW_NOTES after manual review{source === "happyfares" ? ", and enable CRAWL4AI_ENABLED on the API and worker" : ""}.</p>}
    {config.data && !config.data.worker_enabled && <p role="alert">The backend live worker is disabled.</p>}
    {config.data?.browser_available === false && <p role="alert" className="rounded border border-amber-400 p-4">{config.data.browser_message}</p>}
    {cooldownSeconds > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-center gap-2"><Clock3 aria-hidden className="h-5 w-5" /><div><p className="text-sm font-semibold">Source cooldown</p><p className="text-xs">The previous attempt stopped. Collection unlocks automatically; it will not retry on its own.</p></div></div><span className="text-xl font-semibold tabular-nums" aria-label={`Cooldown remaining ${cooldownSeconds} seconds`}>{cooldownLabel}</span></div>}
    <form className="flex flex-wrap items-end gap-4 rounded border p-4" onSubmit={e => { e.preventDefault(); if (!busy && !cooldownSeconds && corridor && !submitLock.current) { submitLock.current = true; collect.mutate(); } }}>
      <label className="grid min-w-0 gap-1 text-sm">Corridor<select className={inputClass} value={corridorId} disabled={!!busy || !config.data} onChange={e => setCorridorId(e.target.value)}>{config.data?.corridors?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Departure<input className={inputClass} type="date" min={today} disabled={!!busy} required value={departure} onChange={e => setDeparture(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Maximum fares<input className={inputClass} type="number" disabled={!!busy} min={1} max={15} required value={limit} onChange={e => setLimit(Number(e.target.value))} /></label>
      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40" disabled={!!busy || !corridor || cooldownSeconds > 0 || !config.data?.enabled || !config.data.worker_enabled || config.data.browser_available === false}>{busy ? <span className="flex items-center gap-2"><Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />Collecting…</span> : cooldownSeconds > 0 ? `Available in ${cooldownLabel}` : "Collect live fares"}</button>
    </form>
    <p className="text-sm text-slate-500">Engine: {source === "happyfares" ? "Crawl4AI with headless Chromium · Economy · 1 adult · three configured corridors" : "Playwright with installed Chrome"}. Challenges stop the run. Imported datasets remain available in Data Ingestion.</p>
    {error && <p role="alert" className="rounded border border-red-400 p-4">{error instanceof Error ? error.message : "Unable to load live collection"}</p>}
    {busy && <p role="status" className="text-sm font-medium text-blue-700">Scraping live fares… {activeRequest?.origin} → {activeRequest?.destination} · {activeRequest?.departure_date}</p>}
    <LiveCollectionTelemetry status={collect.isPending ? "SUBMITTING" : run?.status ?? (runId ? "LOADING" : "READY")} engine={run?.metadata?.result?.collection_engine ?? (run?.metadata?.request?.source === "happyfares" ? "CRAWL4AI" : run?.metadata?.request?.source === "yatra" ? "PLAYWRIGHT" : config.data?.engine ?? "AUTO")} progress={collect.isPending ? undefined : run?.metadata?.progress} recordedSteps={run?.stages} startedAt={run?.started_at ?? run?.created_at} now={now} count={run?.quotes_received} />
    <label className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">Recent runs<select className={`${inputClass} min-w-0 max-w-full flex-1`} value={runId ?? ""} disabled={!!busy || ingestionBusy} onChange={e => setSelected(e.target.value)}><option value="" disabled>No runs yet</option>{recent.data?.map(r => <option key={r.id} value={r.id}>{r.metadata?.request?.origin} → {r.metadata?.request?.destination} · {r.metadata?.request?.departure_date} · {new Date(r.created_at).toLocaleString()} · {r.status} · {r.quotes_received} fares</option>)}</select></label>
    {!!recent.data?.length && <div className="overflow-x-auto rounded border"><table className="w-full text-left text-xs"><caption className="p-3 text-left font-semibold">Collection run history</caption><thead><tr>{["Corridor / departure", "Source", "Status", "Quotes", "Started", "Completed"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{recent.data.map(r => <tr key={r.id} className="border-t"><td className="p-3"><button className="text-blue-700 underline disabled:opacity-50" disabled={!!busy || ingestionBusy} onClick={() => setSelected(r.id)}>{r.metadata?.request?.origin ?? "—"} → {r.metadata?.request?.destination ?? "—"}<br />{r.metadata?.request?.departure_date ?? "—"}</button></td><td className="p-3">{r.metadata?.request?.source ?? "—"}</td><td className="p-3">{r.status}</td><td className="p-3">{r.quotes_received}</td><td className="p-3">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td><td className="p-3">{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</td></tr>)}</tbody></table></div>}
    {run && <section className="space-y-4 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Collection {run.status} · Ingestion {ingestionLabel}</h2><p className="mt-1 text-sm">{run.metadata?.request?.origin} → {run.metadata?.request?.destination} · {run.metadata?.request?.departure_date} · {run.metadata?.request?.source}</p><p className="text-xs text-slate-500">Run {run.id}</p></div><button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-40" disabled={!(state === "READY_FOR_INGESTION" || (state === "FAILED" && run.quotes_received > 0 && run.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED"))) || ingestionBusy} onClick={() => ingest.mutate()}>{ingestionBusy ? <span className="flex items-center gap-2"><Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />{refreshingIngestion ? "Refreshing ingested data…" : "Sending to Data Ingestion…"}</span> : ingestionFailed ? "Retry ingestion" : "Send to ingestion"}</button></div>
      {ingestionBusy && <p role="status" className="text-sm text-blue-700">{refreshingIngestion ? "Refreshing affected dashboard queries and history…" : "Ingestion queued or processing. Waiting for committed pipeline results…"}</p>}
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
