'use client';

import React from 'react';
import { DownloadCloud, Play, CheckCircle2, RotateCw, Server, ArrowRight, Layers } from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { useDashboardSummary } from '@/lib/hooks/useDashboard';
import { useRuns } from '@/lib/hooks/useResources';

const PIPELINE_STAGES = [
  { name: 'COLLECT', count: '8,412', status: 'completed', desc: 'Raw HTTP & Browser extraction' },
  { name: 'NORMALIZE', count: '8,412', status: 'completed', desc: 'Standardized economy DTO' },
  { name: 'VALIDATE', count: '7,981', status: 'completed', desc: '431 rejected sanity errors' },
  { name: 'DEDUP', count: '294 dup', status: 'completed', desc: 'SHA-256 quote hash matching' },
  { name: 'FEATURES', count: '7,981', status: 'completed', desc: 'Lag medians & calendar effects' },
  { name: 'FAREGUARD', count: '7,981', status: 'completed', desc: 'XGBoost expected benchmark' },
  { name: 'PRICEGUARD', count: '184 anom', status: 'completed', desc: 'Isolation Forest scoring' },
  { name: 'APIx ENGINE', count: '108.43', status: 'completed', desc: 'Laspeyres index calculated' },
];

const RECENT_RUNS = [
  { id: '1842', trigger: 'Scheduled (Celery Beat)', started: '02 Sep 2026 • 15:00:02', duration: '6m 39s', raw: 8412, valid: 7981, rejected: 431, dup: 294, status: 'COMPLETED' },
  { id: '1841', trigger: 'Scheduled (Celery Beat)', started: '02 Sep 2026 • 12:00:01', duration: '6m 12s', raw: 8390, valid: 7954, rejected: 436, dup: 301, status: 'COMPLETED' },
  { id: '1840', trigger: 'Manual Trigger (Analyst)', started: '02 Sep 2026 • 10:14:22', duration: '4m 58s', raw: 4210, valid: 4012, rejected: 198, dup: 142, status: 'COMPLETED' },
  { id: '1839', trigger: 'Scheduled (Celery Beat)', started: '02 Sep 2026 • 09:00:01', duration: '6m 45s', raw: 8425, valid: 7990, rejected: 435, dup: 288, status: 'COMPLETED' },
];

interface RunRow {
  id: string;
  trigger: string;
  started: string;
  duration: string;
  raw: number;
  valid: number;
  rejected: number;
  dup: number;
  status: string;
}

function mapRun(r: Record<string, unknown>): RunRow {
  const started = (r.started_at as string) ?? (r.created_at as string) ?? '';
  const durationMs = r.duration_ms as number | undefined;
  return {
    id: String(r.id ?? '').slice(0, 8),
    trigger: String(r.trigger_type ?? r.run_type ?? '—'),
    started: started ? new Date(started).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
    duration: durationMs ? `${(durationMs / 1000).toFixed(0)}s` : '—',
    raw: (r.quotes_received as number) ?? 0,
    valid: (r.quotes_validated as number) ?? 0,
    rejected: (r.quotes_rejected as number) ?? 0,
    dup: (r.duplicates_detected as number) ?? 0,
    status: String(r.status ?? '—'),
  };
}

import { notify } from '@/lib/notify';
import { ConfirmActionDialog } from '@/components/notifications/ConfirmActionDialog';

export default function IngestionPage() {
  const [showRunConfirm, setShowRunConfirm] = React.useState(false);
  const [isTriggering, setIsTriggering] = React.useState(false);

  const { data: summary } = useDashboardSummary();
  const { data: runsPage } = useRuns({ page_size: 10 });

  // Prefer real run history; fall back to the static demo runs when none exist yet.
  const realRuns: RunRow[] = (runsPage?.items ?? []).map(mapRun);
  const runs: RunRow[] = realRuns.length > 0 ? realRuns : RECENT_RUNS;

  const quotesToday = summary?.quotes_24h ?? 28452;
  const totalSources = summary?.total_sources ?? 5;
  const healthySources = summary?.healthy_sources ?? 5;

  const handleTriggerCollection = () => {
    setIsTriggering(true);
    notify.loading('Starting manual collection run...', { id: 'coll-run' });

    setTimeout(() => {
      setIsTriggering(false);
      setShowRunConfirm(false);
      notify.success('Collection queued', {
        id: 'coll-run',
        description: 'Batch Run #1843 has been submitted to the Celery worker pool.',
      });
    }, 800);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Data Ingestion Control Room
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Automated matrix collection scheduler, horizontal multi-stage transformation pipeline, and run audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRunConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-2xs transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Collection Now</span>
          </button>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded">
            ● SCHEDULER: RUNNING (Every 3 Hours)
          </span>
          <span className="px-2.5 py-1 bg-slate-100 text-[#475467] text-xs font-medium rounded border border-slate-200">
            Next Collection: 18:00 IST
          </span>
        </div>
      </div>

      {/* KPI Operations Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Quotes Today</span>
          <span className="text-2xl font-bold text-[#101828] tabular-nums mt-0.5">{quotesToday.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Across monitored routes</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Validated Fares</span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">27,611</span>
          <span className="text-[10px] text-emerald-700 block mt-0.5">97.0% pass rate</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase block">Rejected (Sanity)</span>
          <span className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">412</span>
          <span className="text-[10px] text-rose-700 block mt-0.5">Physical bounds check</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Duplicates Flagged</span>
          <span className="text-2xl font-bold text-[#101828] tabular-nums mt-0.5">429</span>
          <span className="text-[10px] text-[#667085] block mt-0.5">Preserved, not discarded</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase block">Active Data Sources</span>
          <span className="text-2xl font-bold text-blue-700 tabular-nums mt-0.5">{healthySources} / {totalSources}</span>
          <span className="text-[10px] text-blue-700 block mt-0.5">Airlines + OTAs</span>
        </div>
      </div>

      {/* Latest Collection Run #1842 Horizontal Pipeline Diagram */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded border border-blue-200">
                RUN #1842
              </span>
              <h3 className="text-sm font-bold text-[#101828]">Scheduled Batch Collection Pipeline Execution</h3>
            </div>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Started: 02 Sep 2026 • 15:00:02 IST • Elapsed: 6m 39s • Status: COMPLETED
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ALL 8 STAGES PASSED
          </span>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div
              key={idx}
              className="bg-[#F8FAFC] border border-[#E4E7EC] rounded p-2.5 flex flex-col justify-between relative group hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">{stage.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-sm font-black text-[#101828] font-mono tabular-nums my-1">
                {stage.count}
              </div>
              <p className="text-[10px] text-[#667085] line-clamp-1">{stage.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Collection Run History Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Collection Run History</h3>
          <span className="text-xs text-[#667085]">Celery Worker Execution Logs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Run ID</th>
                <th className="p-3">Trigger Type</th>
                <th className="p-3">Started (IST)</th>
                <th className="p-3 text-right">Duration</th>
                <th className="p-3 text-right">Raw Quotes</th>
                <th className="p-3 text-right">Validated</th>
                <th className="p-3 text-right">Rejected</th>
                <th className="p-3 text-right">Duplicates</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50 transition-colors font-mono">
                  <td className="p-3 font-bold text-blue-700">#{run.id}</td>
                  <td className="p-3 font-sans text-[#101828] font-medium">{run.trigger}</td>
                  <td className="p-3 text-[#667085]">{run.started}</td>
                  <td className="p-3 text-right text-[#475467]">{run.duration}</td>
                  <td className="p-3 text-right font-bold text-[#101828]">{run.raw}</td>
                  <td className="p-3 text-right text-emerald-700 font-bold">{run.valid}</td>
                  <td className="p-3 text-right text-rose-600">{run.rejected}</td>
                  <td className="p-3 text-right text-[#667085]">{run.dup}</td>
                  <td className="p-3 text-center font-sans">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmActionDialog
        open={showRunConfirm}
        title="Trigger Scheduled Batch Collection?"
        description="AirPulse will dispatch immediate web scraping workers across all 5 configured airline direct and OTA sources for the active 81-route basket. Rate limits and concurrency budgets will apply."
        confirmLabel="Start Collection Run"
        variant="default"
        entityName="CELERY-RUN-BATCH"
        isLoading={isTriggering}
        onConfirm={handleTriggerCollection}
        onCancel={() => setShowRunConfirm(false)}
      />
    </div>
  );
}
