'use client';

import React, { useState } from 'react';
import { AlertTriangle, Search, Download } from 'lucide-react';
import { AnomalyItem, AnomalySeverity } from '@/types';
import { SeverityBadge } from '@/components/ui/Badge';
import { AnomalyDetailDrawer } from '@/components/drawers/AnomalyDetailDrawer';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { formatINR } from '@/lib/formatters';
import { useAnomalies } from '@/lib/hooks/useResources';
import { useDashboardSummary } from '@/lib/hooks/useDashboard';
import { EmptyAnomaliesState, EmptySearchResultsState } from '@/components/states/EmptyState';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { MockBadge } from '@/components/data/DataBadge';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { CircleReloadingAnimation } from '@/components/ui/CircleReloadingAnimation';

export default function AnomaliesPage() {
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  // Real anomalies from FastAPI (falls back to mock while the backend has no rows).
  const {
    data: anomalyPage,
    isLoading: isAnomaliesLoading,
    isFetching: isAnomaliesFetching,
  } = useAnomalies({
    severity: severityFilter === 'ALL' ? undefined : severityFilter,
    page_size: 50,
  });

  const { summary } = useDashboardSummary();
  const { mode: dataMode } = useDataMode();

  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const anomalies: AnomalyItem[] = (anomalyPage?.items ?? []).map((a) =>
    localStatuses[a.id] ? { ...a, status: localStatuses[a.id] as AnomalyItem['status'] } : a,
  );

  const handleStatusChange = (anomalyId: string, newStatus: string) => {
    setLocalStatuses((prev) => ({ ...prev, [anomalyId]: newStatus }));
  };

  const openCount = summary?.open_anomalies ?? anomalies.filter((a) => a.status === 'open').length;
  const criticalCount = summary?.critical_anomalies ?? anomalies.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = anomalies.filter((a) => a.severity === 'HIGH').length;
  const investigatingCount = anomalies.filter((a) => a.status === 'investigating').length;
  const confirmedCount = anomalies.filter((a) => a.status === 'confirmed').length;

  const filtered = anomalies.filter((a) => {
    const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesQuery =
      a.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.airline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesQuery;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Anomaly Center &amp; PriceGuard Investigations
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Evaluate statistical anomalies identified by Isolation Forest &amp; FareGuard. Unusual fares are never automatically discarded—investigate cross-source agreement, SHAP drivers, and record audited decisions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Anomalies</span>
          </button>
          <GenerateReportButton
            exportType="ANOMALIES"
            format="PDF"
            title="AirPulse — Anomaly Intelligence Report"
            filters={{ severity: severityFilter }}
          />
          {dataMode === 'mock' && <MockBadge />}
          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200">
            PriceGuard Active (Contamination: 0.04)
          </span>
        </div>
      </div>

      <ExportDialog
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportType="ANOMALIES"
        defaultFormat="CSV"
        title="Multi-Source Anomaly Extract (PriceGuard)"
        filters={{ severity: severityFilter }}
        filterSummary={[
          { label: 'Severity Filter', value: severityFilter },
          { label: 'Model', value: 'PriceGuard Isolation Forest' },
          { label: 'Contamination Threshold', value: '0.04 (Calibrated)' },
        ]}
        estimatedRows={openCount}
      />

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Total Open</span>
          <span className="text-2xl font-bold text-[#101828] tabular-nums mt-0.5">{openCount}</span>
          <span className="text-[10px] text-[#667085] block mt-0.5">Requiring review</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase block">Critical Severity</span>
          <span className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">{criticalCount}</span>
          <span className="text-[10px] text-rose-700 block mt-0.5">&gt; 65% deviation</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase block">High Severity</span>
          <span className="text-2xl font-bold text-amber-700 tabular-nums mt-0.5">{highCount}</span>
          <span className="text-[10px] text-amber-700 block mt-0.5">Percentile &ge; 0.95</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase block">Under Investigation</span>
          <span className="text-2xl font-bold text-blue-700 tabular-nums mt-0.5">{investigatingCount}</span>
          <span className="text-[10px] text-blue-700 block mt-0.5">Assigned to analysts</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Confirmed Market Surges</span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">{confirmedCount}</span>
          <span className="text-[10px] text-emerald-700 block mt-0.5">Genuine supply shifts</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, route, carrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#F8FAFC] border border-[#D0D5DD] rounded text-xs text-[#101828] focus:outline-none"
            />
          </div>

          {/* Severity Tabs */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                  severityFilter === s
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#101828]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-[#667085]">
          Showing <strong className="text-[#101828] tabular-nums">{filtered.length}</strong> of {anomalies.length} observations
        </span>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        {dataMode === 'real' && (isAnomaliesLoading || isAnomaliesFetching) && anomalies.length === 0 ? (
          <CircleReloadingAnimation
            title="Evaluating Real-Time Price Anomalies..."
            subtitle="Executing Isolation Forest & FareGuard anomaly detection models on live observations."
            badge="ANOMALY DETECTION"
            minHeight="min-h-[360px]"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] uppercase text-[11px]">
                <tr>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Incident Code</th>

                <th className="p-3">Route &amp; Window</th>
                <th className="p-3">Carrier / Flight</th>
                <th className="p-3 text-right">Actual Observed</th>
                <th className="p-3 text-right">FareGuard Expected</th>
                <th className="p-3 text-right">Deviation</th>
                <th className="p-3 text-right">Percentile</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedAnomaly(item)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="p-3 font-mono font-bold text-[#101828]">
                    #{item.code}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-[#101828]">{item.route}</span>
                    <span className="text-[11px] text-[#667085] ml-1.5 font-normal">({item.booking_window})</span>
                  </td>
                  <td className="p-3 text-[#475467]">
                    {item.airline}
                  </td>
                  <td className="p-3 text-right font-bold text-[#101828] tabular-nums">
                    {formatINR(item.actual_fare)}
                  </td>
                  <td className="p-3 text-right text-[#667085] tabular-nums font-mono">
                    {formatINR(item.expected_fare)}
                  </td>
                  <td className="p-3 text-right tabular-nums font-bold text-rose-600">
                    +{item.deviation_pct}%
                  </td>
                  <td className="p-3 text-right tabular-nums font-mono text-[#101828]">
                    {item.percentile.toFixed(1)}%
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      item.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'open'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnomaly(item);
                      }}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded text-[11px] transition-colors"
                    >
                      Inspect &amp; Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            searchQuery || severityFilter !== 'ALL' ? (
              <EmptySearchResultsState
                onAction={() => {
                  setSearchQuery('');
                  setSeverityFilter('ALL');
                }}
              />
            ) : (
              <EmptyAnomaliesState />
            )
          )}
        </div>
        )}
      </div>


      {/* Slide-over Detail Drawer */}
      <AnomalyDetailDrawer
        anomaly={selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
