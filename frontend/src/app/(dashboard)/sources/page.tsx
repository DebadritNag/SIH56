'use client';

import React from 'react';
import { Globe, ShieldCheck, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HealthBadge } from '@/components/ui/Badge';
import { SourceStatus } from '@/types';
import { useSources } from '@/lib/hooks/useResources';
import type { BackendSource } from '@/lib/api/endpoints';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';

interface SourceRow {
  name: string;
  type: string;
  status: SourceStatus;
  method: string;
  freshness: string;
  successRate: number;
  parserVersion: string;
  recordsToday: number;
  latencyMs: number;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  AIRLINE: 'Airline Direct',
  OTA: 'OTA Aggregator',
  GOVERNMENT_API: 'Official CPI Benchmark',
  GOVERNMENT_FILE: 'Regulatory Traffic Weight',
  REPLAY: 'Deterministic Replay',
  SYNTHETIC: 'Synthetic Generator',
};

function deriveStatus(s: BackendSource): SourceStatus {
  if (s.active === false || s.enabled === false) return 'DISABLED';
  const failures = s.consecutive_failures ?? 0;
  if (failures === 0) return 'HEALTHY';
  if (failures < 3) return 'DEGRADED';
  return 'FAILED';
}

function toRow(s: BackendSource): SourceRow {
  return {
    name: s.display_name || s.name,
    type: SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type,
    status: deriveStatus(s),
    method: s.collection_method ?? '—',
    freshness: s.last_success_at ? new Date(s.last_success_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
    successRate: s.reliability_score != null ? Number(s.reliability_score) * 100 : 0,
    parserVersion: '—',
    recordsToday: 0,
    latencyMs: 0,
  };
}

export default function SourcesPage() {
  const { data: sourcePage } = useSources({ page_size: 100 });
  const SOURCES: SourceRow[] = (sourcePage?.items ?? []).map(toRow);

  const healthy = SOURCES.filter((s) => s.status === 'HEALTHY').length;
  const degraded = SOURCES.filter((s) => s.status === 'DEGRADED').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Data Sources &amp; Connector Health
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Operational monitoring of configured airline direct portals, online travel agencies, and official government statistics adapters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton exportType="SOURCE_HEALTH" format="XLSX" title="AirPulse — Data Source Health Report" />
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded">
            {SOURCES.length} Sources Active • {healthy} Healthy • {degraded} Degraded
          </span>
        </div>
      </div>

      {/* Source Health Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Source Name</th>
                <th className="p-3">Source Type</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Collection Method</th>
                <th className="p-3 text-right">Success Rate</th>
                <th className="p-3 text-right">Avg Latency</th>
                <th className="p-3 text-right">Freshness</th>
                <th className="p-3 text-right">Quotes Today</th>
                <th className="p-3 text-center">Parser Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {SOURCES.map((src, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-[#101828]">{src.name}</td>
                  <td className="p-3 text-[#667085]">{src.type}</td>
                  <td className="p-3 text-center">
                    <HealthBadge status={src.status} />
                  </td>
                  <td className="p-3 font-mono text-[11px] text-[#475467]">{src.method}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#101828] tabular-nums">
                    {src.successRate.toFixed(1)}%
                  </td>
                  <td className="p-3 text-right font-mono text-[#667085] tabular-nums">
                    {src.latencyMs} ms
                  </td>
                  <td className="p-3 text-right font-mono text-[#667085]">{src.freshness}</td>
                  <td className="p-3 text-right font-mono font-bold text-blue-700 tabular-nums">
                    {src.recordsToday.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono text-[#667085] text-[11px]">
                    {src.parserVersion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
