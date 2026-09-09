"use client";

import { CheckCircle2, Circle, Clock3, Loader2, XCircle } from "lucide-react";

export type CollectionStep = { stage?: string; step_name?: string; status: string; detail?: string; message?: string };
export type CollectionProgress = { stage: string; status: string; engine?: string; updated_at?: string; stages?: CollectionStep[] };
const steps = [
  ["POLICY_CHECK", "Policy check", "Source permissions and robots.txt"],
  ["BROWSER_LAUNCH", "Engine initialization", "Start an isolated browser"],
  ["NAVIGATION", "Navigate to search", "Open the requested route and date"],
  ["RESULT_DETECTION", "Render and detect results", "Check access and wait for flight cards"],
  ["EXTRACT_VALIDATE", "Parse and check observations", "Verify route, date and observed prices"],
  ["RAW_STORAGE", "Collection staging", "Save raw evidence and observation hashes"],
] as const;

export default function LiveCollectionTelemetry({ status, engine, progress, recordedSteps, startedAt, now, count = 0 }: {
  status: string; engine: string; progress?: CollectionProgress; recordedSteps?: CollectionStep[];
  startedAt?: string; now: number; count?: number;
}) {
  const active = ["SUBMITTING", "QUEUED", "RUNNING", "LOADING"].includes(status);
  const terminal = ["COMPLETED", "PARTIAL", "FAILED"].includes(status);
  const observed = terminal && recordedSteps?.length ? recordedSteps : progress?.stages ?? [];
  const resolved = steps.map(([key, label, description]) => {
    const record = observed.find(s => (s.stage ?? s.step_name) === key);
    let state = record?.status ?? "PENDING";
    // Worker interruption can leave its last progress event marked RUNNING.
    if (terminal && state === "RUNNING") state = status === "FAILED" ? "FAILED" : "COMPLETED";
    if (status === "FAILED" && state === "PENDING") state = "NOT_RUN";
    return { key, label, description, state, detail: record?.detail ?? record?.message };
  });
  const completed = resolved.filter(s => s.state === "COMPLETED").length;
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const seconds = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : null;
  const current = resolved.find(s => s.state === "RUNNING");
  const summary = status === "SUBMITTING" ? "Submitting collection request…" : status === "QUEUED" ? "Queued — waiting for the collection worker" : status === "LOADING" ? "Loading run telemetry…" : status === "RUNNING" ? current?.label ?? "Worker is running — waiting for stage telemetry" : status === "FAILED" ? "Collection stopped. Review the recorded failure below." : terminal ? `${count} observed fares staged for review` : "Ready to collect";
  return <section aria-label="Live collection telemetry" aria-busy={active} className="rounded-lg border border-slate-200 bg-white p-5 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Live Pipeline Telemetry</h2>
      <div className="flex items-center gap-3 text-xs font-medium"><span className="rounded border border-slate-200 px-2 py-1">ENGINE: {progress?.engine ?? engine}</span><span className={status === "FAILED" ? "text-red-700" : active ? "text-blue-700" : "text-emerald-700"}>{status}</span></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="flex items-center gap-2 text-sm font-medium">{active && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{summary}</p>
      {active && seconds !== null && <span className="flex items-center gap-1 text-xs tabular-nums text-slate-600"><Clock3 aria-hidden className="h-3.5 w-3.5" />Elapsed {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}
    </div>
    <progress aria-label="Reported collection stages completed" className="mt-4 h-2 w-full accent-blue-600" max={steps.length} value={completed} />
    <p className="mt-1 text-xs text-slate-600">{completed} of {steps.length} stages confirmed complete · Stage durations vary</p>
    <ol className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
      {resolved.map((step, index) => <li key={step.key} aria-current={step.state === "RUNNING" ? "step" : undefined} className={`flex gap-3 border-t py-4 ${step.state === "RUNNING" ? "border-blue-300" : "border-slate-100"}`}>
        <span className="pt-0.5 text-xs tabular-nums text-slate-500">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{step.label}</h3>{step.state === "COMPLETED" ? <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-700" /> : step.state === "FAILED" ? <XCircle aria-hidden className="h-4 w-4 shrink-0 text-red-700" /> : step.state === "RUNNING" ? <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-blue-700 motion-reduce:animate-none" /> : <Circle aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />}</div><p className="mt-1 text-xs text-slate-600">{step.description}</p><p className={`mt-1 text-xs ${step.state === "FAILED" ? "text-red-700" : step.state === "RUNNING" ? "text-blue-700" : "text-slate-500"}`}>{step.state.replaceAll("_", " ")}</p></div>
      </li>)}
    </ol>
    <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">Normalization, deduplication, FareGuard, PriceGuard and APIx start only after Send to ingestion.</p>
  </section>;
}
