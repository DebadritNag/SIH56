"use client";

import { SUPPORTED_CORRIDORS } from '@/lib/supported-corridors';

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LiveCollectionTelemetry from "./LiveCollectionTelemetry";
import { Clock3, Loader2, PlaneTakeoff, ArrowRight, Database, Cpu, MapPin, Activity, ShieldCheck } from "lucide-react";
import { getData, postData } from "@/lib/api/client";
import { invalidateAfterCollection, invalidateAfterIngestion } from "@/lib/queryInvalidation";

import type { Run } from "./live-collection-types";
import { RunHistory, RunInspector, LoadingPanel, engineLabel, isActiveRun } from "./live-collection-ui";

export default function LiveCollection() {
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const source = "happyfares";
  const [corridorId, setCorridorId] = useState("DEL-BOM");
  const submitLock = useRef(false);
  const [refreshingIngestion, setRefreshingIngestion] = useState(false);
  const [departure, setDeparture] = useState(() => new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [limit, setLimit] = useState(5);
  const config = useQuery({ queryKey: ["live-config", source], queryFn: () => getData<{ corridors: { id: string; origin: string; destination: string; label: string }[]; server_now?: string; cooldown_until?: string | null; enabled: boolean; worker_enabled: boolean; browser_available?: boolean | null; engine?: string; browser_message?: string; message: string }>("/live/config", { source }), refetchInterval: q => q.state.data?.cooldown_until && Date.parse(q.state.data.cooldown_until) > Date.now() ? 15000 : false });
  const corridors = SUPPORTED_CORRIDORS.filter(c => config.data?.corridors?.some(allowed => allowed.id === c.id));
  const corridor = corridors.find(c => c.id === corridorId);
  const origin = corridor?.origin;
  const destination = corridor?.destination;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const recent = useQuery({ queryKey: ["live-runs"], queryFn: () => getData<Run[]>("/live/runs"), refetchInterval: q => q.state.data?.some(isActiveRun) ? 5000 : false });
  const runId = selected ?? recent.data?.[0]?.id;
  const detail = useQuery({ queryKey: ["live-run", runId], queryFn: () => getData<Run>(`/live/runs/${runId}`), enabled: !!runId, refetchInterval: q => q.state.data && isActiveRun(q.state.data) ? 2000 : false });
  const collect = useMutation({ mutationFn: () => postData<{ collection_run_id: string }>("/live/runs", { source, origin, destination, departure_date: departure, max_results: limit, engine: source === "happyfares" ? "CRAWL4AI" : "AUTO" }), onSuccess: async data => { setSelected(data.collection_run_id); await invalidateAfterCollection(cache); }, onError: () => { cache.invalidateQueries({ queryKey: ["live-config", source] }); }, onSettled: () => { submitLock.current = false; } });
  const ingest = useMutation({ mutationFn: () => postData(`/live/runs/${runId}/ingest`), onSuccess: () => cache.invalidateQueries({ queryKey: ["live-run", runId] }) });
  const run = detail.data;
  const state = run?.metadata?.ingestion_state;
  const ingestionFailed = run?.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED");
  const ingestionBusy = ingest.isPending || refreshingIngestion || ["QUEUED", "RUNNING"].includes(state ?? "") || !!run?.pipelines?.some(p => p.pipeline_type === "live_ingestion" && ["QUEUED", "RUNNING"].includes(p.status));
  const ingestionLabel = state === "FAILED" && !ingestionFailed ? "NOT STARTED" : state ?? "PENDING";
  useEffect(() => {
    if (["COMPLETED", "PARTIAL"].includes(state ?? "")) {
      setRefreshingIngestion(true);
      void invalidateAfterIngestion(cache).finally(() => setRefreshingIngestion(false));
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
  const inputClass = "h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const currentEngine = config.data?.engine ?? "CRAWL4AI";
  const runEngine = run?.metadata?.result?.collection_engine ?? run?.metadata?.result?.engine ?? (run?.metadata?.request?.source === "happyfares" ? "CRAWL4AI" : run?.metadata?.request?.source === "yatra" ? "PLAYWRIGHT" : currentEngine);
  const canIngest = !!run && (state === "READY_FOR_INGESTION" || (state === "FAILED" && run.quotes_received > 0 && !!run.pipelines?.some(p => p.pipeline_type === "live_ingestion" && p.status === "FAILED")));
  const disabledReason = !run ? "Select a collection run" : !run.quotes_received ? "No extracted observations" : ingestionBusy ? "Ingestion is processing" : !canIngest ? "This run is not ready for ingestion" : undefined;
  const engineHealth = !config.data ? "Awaiting configuration" : !config.data.enabled ? "Source disabled" : !config.data.worker_enabled ? "Worker disabled" : config.data.browser_available === false ? "Browser unavailable" : "Configured · checked when collection starts";
  return <div className="space-y-5 py-4 text-slate-900 selection:bg-blue-100">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight"><PlaneTakeoff aria-hidden className="h-6 w-6 text-blue-600" />Live collection</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Collect observed OTA fares, review raw results, then send them through the ingestion pipeline.</p></div>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-xs"><div><dt className="text-slate-500">Engine</dt><dd className="mt-1 font-semibold">{engineLabel(currentEngine)}</dd></div><div><dt className="text-slate-500">Search profile</dt><dd className="mt-1 font-semibold">Economy · 1 adult</dd></div><div><dt className="text-slate-500">Configured corridors</dt><dd className="mt-1 font-semibold">{config.data ? `${corridors.length} routes` : "Loading…"}</dd></div></dl>
    </header>

    <section aria-labelledby="scrape-controls" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><div className="rounded-lg bg-blue-50 p-2 text-blue-600"><PlaneTakeoff aria-hidden className="h-4 w-4" /></div><div><h2 id="scrape-controls" className="text-sm font-semibold">Scraping Control Panel</h2><p className="mt-1 text-xs text-slate-500">Configure your search, then collect live fares from the selected OTA source.</p></div></div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5">
          <form className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => { e.preventDefault(); if (!busy && !cooldownSeconds && corridor && !submitLock.current) { submitLock.current = true; collect.mutate(); } }}>
            <label className="grid gap-2 text-xs font-medium text-slate-600">Source<select className={inputClass} value={source} disabled><option value="happyfares">HappyFares</option></select></label>
            <label className="grid gap-2 text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-1">Corridor<select className={inputClass} value={corridorId} disabled={!!busy || !config.data} onChange={e => setCorridorId(e.target.value)}>{!config.data && <option value={corridorId}>Loading corridors…</option>}{corridors.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="grid gap-2 text-xs font-medium text-slate-600">Departure date<input className={inputClass} type="date" min={today} disabled={!!busy} required value={departure} onChange={e => setDeparture(e.target.value)} /></label>
            <label className="grid gap-2 text-xs font-medium text-slate-600">Maximum fares<input className={inputClass} type="number" disabled={!!busy} min={1} max={15} required value={limit} onChange={e => setLimit(Number(e.target.value))} /></label>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4"><p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck aria-hidden className="h-4 w-4 text-teal-600" />Observed fares only. Collection is staged for review.</p><button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={!!busy || !corridor || cooldownSeconds > 0 || !config.data?.enabled || !config.data.worker_enabled || config.data.browser_available === false}>{busy ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />Collecting live fares…</> : cooldownSeconds > 0 ? `Available in ${cooldownLabel}` : <>Collect live fares<ArrowRight aria-hidden className="h-4 w-4" /></>}</button></div>
          </form>
        </div>
        <aside className="border-t border-slate-100 bg-slate-50/80 p-5 xl:border-l xl:border-t-0"><h3 className="flex items-center gap-2 text-xs font-semibold"><Cpu aria-hidden className="h-4 w-4 text-blue-600" />Live Scraping Configuration</h3><p className="mt-3 text-xs font-medium">{engineLabel(currentEngine)} with headless Chromium</p><p className="mt-2 text-xs text-slate-500">Economy · 1 adult · {config.data ? `${corridors.length} configured corridors` : "Loading configuration…"}</p><div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500"><p>Challenges stop the run.</p><p>Imported datasets remain available in Data Ingestion.</p></div></aside>
      </div>
    </section>
    {config.data && !config.data.enabled && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">HappyFares is disabled. Configure HAPPYFARES_PROTOTYPE_ENABLED and HAPPYFARES_REVIEW_NOTES after manual review, and enable CRAWL4AI_ENABLED on the API and worker.</p>}
    {config.data && !config.data.worker_enabled && <p role="alert" className="text-sm text-amber-800">The backend live worker is disabled.</p>}
    {config.data?.browser_available === false && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{config.data.browser_message}</p>}
    {cooldownSeconds > 0 && <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="flex items-center gap-3"><Clock3 aria-hidden className="h-5 w-5" /><div><p className="text-sm font-semibold">Source cooldown</p><p className="mt-1 text-xs">Collection unlocks automatically. The previous attempt will not retry on its own.</p></div></div><span className="text-xl font-semibold tabular-nums" aria-label={`Cooldown remaining ${cooldownSeconds} seconds`}>{cooldownLabel}</span></div>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="min-w-0 break-words">{error instanceof Error ? error.message : "Unable to load live collection"}</p><button type="button" className="rounded border border-red-300 px-3 py-1.5 font-medium focus-visible:outline-2" onClick={() => { void config.refetch(); void recent.refetch(); if (runId) void detail.refetch(); }}>Refresh data</button></div>}

    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Observed fares staged", value: run ? run.quotes_received : "—", note: run ? "Selected collection run" : "Select a run to review", icon: Database }, { label: "Active engine", value: engineLabel(currentEngine), note: engineHealth, icon: Cpu }, { label: "Last run status", value: recent.data?.[0]?.status ?? "—", note: recent.data?.[0] ? `${recent.data[0].quotes_received} fares collected` : "No collection runs yet", icon: Activity }, { label: "Configured corridors", value: config.data ? corridors.length : "—", note: corridors.map(c => c.id).join(" · ") || "Awaiting configuration", icon: MapPin }].map(({ label, value, note, icon: Icon }) => <div key={label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-slate-50 p-2 text-blue-600"><Icon aria-hidden className="h-4 w-4" /></span><div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{note}</p></div></div>)}
    </dl>
    {busy && <p role="status" className="text-sm font-medium text-blue-700">Scraping live fares… {activeRequest?.origin} → {activeRequest?.destination} · {activeRequest?.departure_date}</p>}
    <LiveCollectionTelemetry status={collect.isPending ? "SUBMITTING" : run?.status ?? (runId ? "LOADING" : "READY")} engine={collect.isPending ? currentEngine : runEngine} progress={collect.isPending ? undefined : run?.metadata?.progress} recordedSteps={collect.isPending ? undefined : run?.stages} startedAt={collect.isPending ? undefined : run?.started_at ?? run?.created_at} now={now} count={collect.isPending ? undefined : run?.quotes_received} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <RunHistory runs={recent.data} loading={recent.isPending} error={recent.isError} refreshing={recent.isFetching && !recent.isPending} selectedId={runId} disabled={!!busy || ingestionBusy} onSelect={setSelected} />
      <section aria-label="Selected run details" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-sm font-semibold">Run details</h2><p className="mt-1 text-xs text-slate-500">View stage outputs and raw observed fares</p></div><button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canIngest || ingestionBusy} title={disabledReason} onClick={() => ingest.mutate()}>{ingestionBusy ? <><Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />{refreshingIngestion ? "Refreshing ingested data…" : "Sending to ingestion…"}</> : ingestionFailed ? "Retry ingestion" : <>Send to ingestion<ArrowRight aria-hidden className="h-3.5 w-3.5" /></>}</button></div>
        {ingestionBusy && <p role="status" className="border-b bg-blue-50 px-5 py-3 text-xs text-blue-700">{refreshingIngestion ? "Refreshing affected dashboard queries and history…" : "Waiting for committed ingestion results…"}</p>}
        {runId && detail.isPending ? <LoadingPanel label="Loading selected run, stages and fares" /> : detail.isError && !run ? <p role="alert" className="p-5 text-sm text-red-700">Unable to load this run. Use Refresh data to try again.</p> : run ? <RunInspector key={run.id} run={run} ingestionLabel={ingestionLabel} refreshing={detail.isFetching} /> : <div className="px-5 py-14 text-center"><Database aria-hidden className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-medium">Select a collection run</p><p className="mt-1 text-xs text-slate-500">Its saved stages, evidence and observed fares will appear here.</p></div>}
        {run && disabledReason && !ingestionBusy && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{disabledReason}</p>}
      </section>
    </div>
  </div>;
}
