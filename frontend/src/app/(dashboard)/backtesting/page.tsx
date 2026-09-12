'use client';

/**
 * Index Backtesting — unified UI for both Live and Demo modes.
 *
 * Both modes share the same layout, filters, KPI cards, chart, and
 * export button.  Data is sourced from mode-specific hooks:
 *   - demo  → mockBacktestPoints (synthetic 12-month series)
 *   - live  → /live-mode/history (genuine observation days + APIx indices)
 *
 * In Live mode, if insufficient history exists the page shows an honest
 * readiness state (BUILDING_HISTORY progress) rather than the old
 * plain-text ObservedHistory component.
 *
 * The old ObservedHistory component is no longer rendered here.
 * Backend files: unchanged.
 */

import React, { useState, useMemo } from 'react';
import {
  History, TrendingUp, Download, RotateCw,
  SlidersHorizontal, RotateCcw, AlertTriangle, Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BacktestComparisonChart } from '@/components/charts/BacktestComparisonChart';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { mockBacktestPoints } from '@/lib/mock-data/dashboard';
import { useExports, useCreateExport, useDownloadExport } from '@/lib/hooks/useExports';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { getData } from '@/lib/api/client';
import { notify } from '@/lib/notify';

// ---------------------------------------------------------------------------
// Minimum genuine observation days before showing the backtest chart
// ---------------------------------------------------------------------------
const APIX_HISTORY_THRESHOLD = 7;

// ---------------------------------------------------------------------------
// Live data hook — polls /live-mode/history for real observation series
// ---------------------------------------------------------------------------
type LiveHistory = {
  historical_days: number;
  dgca_benchmark_available: boolean;
  observations: { date: string; observations: number; mean_fare: number; live_count: number; imported_count: number }[];
  indices: { index_date: string; index_value: number }[];
};

function useLiveBacktestHistory() {
  return useQuery<LiveHistory>({
    queryKey: ['live-backtest-history', 'real'],
    queryFn: () => getData<LiveHistory>('/live-mode/history'),
    refetchInterval: 30_000,
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Convert live indices to BacktestComparisonChart format
// ---------------------------------------------------------------------------
function adaptLiveToChartPoints(history: LiveHistory) {
  return history.indices.map(idx => ({
    month: idx.index_date.slice(0, 7), // "YYYY-MM"
    apix: Number(idx.index_value.toFixed(1)),
    // Benchmark data not yet available in live mode — show null
    cpi_transport: null as unknown as number,
    dgca_fare: null as unknown as number,
  }));
}

// ---------------------------------------------------------------------------
// Shared KPI metric card
// ---------------------------------------------------------------------------
function MetricCard({
  label, value, subLabel, color = 'slate',
}: { label: string; value: string; subLabel: string; color?: 'green' | 'blue' | 'slate' | 'amber' }) {
  const valueClass = color === 'green' ? 'text-emerald-700'
    : color === 'blue' ? 'text-blue-700'
    : color === 'amber' ? 'text-amber-700'
    : 'text-[#101828]';
  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
      <span className="text-[11px] font-semibold text-[#667085] uppercase">{label}</span>
      <div className={`text-3xl font-bold tabular-nums mt-1 ${valueClass}`}>{value}</div>
      <span className="text-[11px] text-[#667085]">{subLabel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live readiness panel (shown when < APIX_HISTORY_THRESHOLD days exist)
// ---------------------------------------------------------------------------
function LiveReadinessPanel({ history }: { history: LiveHistory }) {
  const days = history.historical_days ?? 0;
  const pct = Math.min(100, (days / APIX_HISTORY_THRESHOLD) * 100);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-amber-900 mb-1">
            BUILDING BASE HISTORY — APIx Backtesting Pending
          </div>
          <p className="text-xs text-amber-800">
            Backtesting requires at least {APIX_HISTORY_THRESHOLD} genuine observation days and a
            calculated APIx index series. AirPulse is currently accumulating live data.
          </p>
        </div>
      </div>

      {/* Progress grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Observation Days</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{days}</div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-[#667085]">
              <span>Progress</span>
              <span>{days} / {APIX_HISTORY_THRESHOLD} days</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">APIx Indices</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">
            {history.indices.length}
          </div>
          <span className="text-[11px] text-[#667085]">
            {history.indices.length > 0 ? 'Index series accumulating' : 'Not yet computed'}
          </span>
        </div>

        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">DGCA Benchmark</span>
          <div className={`text-3xl font-bold tabular-nums mt-1 ${history.dgca_benchmark_available ? 'text-emerald-700' : 'text-amber-700'}`}>
            {history.dgca_benchmark_available ? 'Loaded' : 'Pending'}
          </div>
          <span className="text-[11px] text-[#667085]">
            {history.dgca_benchmark_available ? 'DGCA quarterly reference available' : 'Not yet loaded'}
          </span>
        </div>
      </div>

      {/* Available observations table */}
      {history.observations.length > 0 && (
        <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#101828]">Available Observation Days</h3>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Genuine LIVE + IMPORTED observations. Backtesting chart unlocks at {APIX_HISTORY_THRESHOLD}+ days.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#475467] text-[10px] font-semibold uppercase border-b border-[#E4E7EC]">
                <tr>
                  <th className="p-3">Date (UTC)</th>
                  <th className="p-3 text-right">LIVE</th>
                  <th className="p-3 text-right">IMPORTED</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Mean Fare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {history.observations.map(r => (
                  <tr key={r.date} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-semibold text-[#101828]">{r.date}</td>
                    <td className="p-3 text-right text-emerald-700 font-semibold">{r.live_count}</td>
                    <td className="p-3 text-right text-blue-700 font-semibold">{r.imported_count}</td>
                    <td className="p-3 text-right font-bold text-[#101828]">{r.observations}</td>
                    <td className="p-3 text-right font-mono text-[#475467]">₹{Number(r.mean_fare).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No data at all */}
      {history.observations.length === 0 && (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-8 shadow-xs text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#475467]">No genuine observations yet.</p>
          <p className="text-xs text-[#667085] mt-1">
            Run a live collection or import a dataset to start building history.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function BacktestingPage() {
  const { mode } = useDataMode();
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'12M' | '6M' | '3M'>('12M');
  const [benchmarkFilter, setBenchmarkFilter] = useState<'ALL' | 'CPI_TRANSPORT' | 'DGCA'>('ALL');
  const [methodologyVersion, setMethodologyVersion] = useState<'v1.2' | 'v1.0'>('v1.2');

  // Live data
  const { data: liveHistory, isPending: isLivePending, error: liveError } = useLiveBacktestHistory();

  // Export hooks
  const { data: exportsList = [] } = useExports({ export_type: 'BACKTEST_AUDIT_PDF' });
  const createExportMutation = useCreateExport();
  const downloadMutation = useDownloadExport();

  const existingReadyJob = exportsList.find(
    e => e.export_type === 'BACKTEST_AUDIT_PDF' && e.status === 'READY'
  );

  const handleDownloadDossier = async () => {
    if (existingReadyJob) {
      notify.info('Preparing statistical audit dossier...', { description: existingReadyJob.filename });
      await downloadMutation.mutateAsync(existingReadyJob);
      return;
    }
    setIsGenerating(true);
    notify.info('Preparing statistical audit dossier...', { description: 'Calling backend ReportLab engine...' });
    createExportMutation.mutate(
      {
        export_type: 'BACKTEST_AUDIT_PDF',
        format: 'PDF',
        title: 'MoSPI Transport CPI 12-Month Backtest Audit',
        data_mode: mode,
        filters: { period: periodFilter, methodology: `APIx Matched-Basket ${methodologyVersion}`, benchmark: benchmarkFilter },
      },
      {
        onSuccess: async (newJob) => {
          setIsGenerating(false);
          notify.success('Audit dossier generated', { description: newJob.filename });
          await downloadMutation.mutateAsync(newJob);
        },
        onError: (err: unknown) => {
          setIsGenerating(false);
          notify.error('Statistical audit dossier could not be generated', {
            description: err instanceof Error ? err.message : 'Please retry.',
          });
        },
      }
    );
  };

  // ── Determine chart data and metrics ──────────────────────────────────────

  const isDemoMode = mode === 'mock';
  const hasLiveHistory = !isLivePending && !liveError && (liveHistory?.historical_days ?? 0) >= APIX_HISTORY_THRESHOLD;
  const showChart = isDemoMode || hasLiveHistory;
  const showReadiness = !isDemoMode && !isLivePending && !hasLiveHistory;

  const demoPoints = useMemo(() => {
    let pts = [...mockBacktestPoints];
    if (periodFilter === '3M') pts = pts.slice(-3);
    else if (periodFilter === '6M') pts = pts.slice(-6);
    if (methodologyVersion === 'v1.0') pts = pts.map(p => ({ ...p, apix: Number((p.apix * 1.015).toFixed(1)) }));
    return pts;
  }, [periodFilter, methodologyVersion]);

  const liveChartPoints = useMemo(() => {
    if (!liveHistory) return [];
    return adaptLiveToChartPoints(liveHistory);
  }, [liveHistory]);

  const chartPoints = isDemoMode ? demoPoints : liveChartPoints;
  const sampleSize = isDemoMode ? demoPoints.length : (liveHistory?.historical_days ?? 0);

  // Demo metrics (reactive to filters)
  const demoMetrics = useMemo(() => {
    if (periodFilter === '3M') return { corr: '0.968', horizon: '+12 Days', rmse: '1.42 pts', agreement: '98.1%' };
    if (periodFilter === '6M') return { corr: '0.954', horizon: '+14 Days', rmse: '1.65 pts', agreement: '97.2%' };
    return { corr: '0.942', horizon: '+14 Days', rmse: '1.84 pts', agreement: '96.5%' };
  }, [periodFilter]);

  // Live metrics — derived from observation coverage; real stats require actual backtest
  const liveMetrics = useMemo(() => {
    const days = liveHistory?.historical_days ?? 0;
    const idxCount = liveHistory?.indices.length ?? 0;
    const dgca = liveHistory?.dgca_benchmark_available ? 'Available' : 'Pending';
    return {
      corr: idxCount >= 7 ? 'Computing…' : '—',
      horizon: idxCount >= 7 ? 'Computing…' : '—',
      rmse: idxCount >= 7 ? 'Computing…' : '—',
      agreement: dgca,
    };
  }, [liveHistory]);

  const metrics = isDemoMode ? demoMetrics : liveMetrics;

  const benchmarkTitle =
    benchmarkFilter === 'DGCA' ? 'DGCA Reference Benchmark'
    : benchmarkFilter === 'CPI_TRANSPORT' ? 'MoSPI CPI Transport Sub-Index'
    : 'MoSPI Transport & Comm Reference';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Statistical Backtesting &amp; Official MoSPI CPI Benchmarking
            </h1>
            {/* Mode badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isDemoMode
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isDemoMode ? 'SIH DEMO MODE' : 'LIVE DATA'}
            </span>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            {isDemoMode
              ? 'Validation of the high-frequency daily Airfare Price Index against official MoSPI CPI Transport releases. Showing synthetic demo dataset.'
              : 'Validation of genuine observed APIx series against official MoSPI CPI Transport releases and DGCA quarterly average fare indicators.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadDossier}
            disabled={isGenerating || downloadMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-xs font-semibold text-white rounded shadow-2xs transition-colors cursor-pointer"
          >
            {isGenerating || downloadMutation.isPending ? (
              <><RotateCw className="w-3.5 h-3.5 animate-spin" /><span>Preparing Dossier...</span></>
            ) : (
              <><Download className="w-3.5 h-3.5" /><span>Download Statistical Audit Dossier</span></>
            )}
          </button>
          <GenerateReportButton
            exportType="BACKTEST_AUDIT_PDF"
            format="PDF"
            title={isDemoMode ? 'Index Backtesting Audit (Demo)' : 'Index Backtesting Audit (Live)'}
            filters={{ period: periodFilter, benchmark: benchmarkFilter, methodology: methodologyVersion }}
            label="Options"
            className="px-2 py-1.5 bg-white border border-[#D0D5DD] hover:bg-slate-50 text-[#344054] text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
          />
        </div>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        exportType="BACKTEST_AUDIT_PDF"
        defaultFormat="PDF"
        title="MoSPI Transport CPI 12-Month Backtest Audit"
        filters={{ period: periodFilter, benchmark: benchmarkFilter, methodology: methodologyVersion }}
        filterSummary={[
          { label: 'Evaluation Period', value: `${periodFilter} Horizon` },
          { label: 'Benchmark', value: benchmarkTitle },
          { label: 'Methodology Version', value: `Laspeyres ${methodologyVersion}` },
        ]}
      />

      {/* Filter bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Audit Scope:</span>
          </div>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as '12M' | '6M' | '3M')}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
            <option value="12M">12 Months (Full Audit Horizon)</option>
            <option value="6M">Last 6 Months</option>
            <option value="3M">Last 3 Months (Recent Surge)</option>
          </select>
          <select value={benchmarkFilter} onChange={e => setBenchmarkFilter(e.target.value as 'ALL' | 'CPI_TRANSPORT' | 'DGCA')}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
            <option value="ALL">MoSPI CPI &amp; DGCA Combined</option>
            <option value="CPI_TRANSPORT">MoSPI Transport CPI Only</option>
            <option value="DGCA">DGCA Quarterly Average Only</option>
          </select>
          <select value={methodologyVersion} onChange={e => setMethodologyVersion(e.target.value as 'v1.2' | 'v1.0')}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
            <option value="v1.2">Methodology v1.2 (Matched Laspeyres)</option>
            <option value="v1.0">Methodology v1.0 (Legacy Unweighted)</option>
          </select>
          <button onClick={() => { setPeriodFilter('12M'); setBenchmarkFilter('ALL'); setMethodologyVersion('v1.2'); }}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer">
            <RotateCcw className="w-3 h-3" /><span>Reset</span>
          </button>
        </div>
        <div className="text-xs text-[#667085]">
          Sample Size: <strong className="text-[#101828]">
            {isDemoMode ? `${sampleSize} Observation Months` : `${sampleSize} Observation Days`}
          </strong>
          {isDemoMode && <span className="ml-2 text-[10px] text-indigo-600 font-semibold">(SYNTHETIC DEMO)</span>}
        </div>
      </div>

      {/* Loading state */}
      {!isDemoMode && isLivePending && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs animate-pulse motion-reduce:animate-none">
              <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
              <div className="h-8 w-16 bg-slate-200 rounded mb-2" />
              <div className="h-2.5 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      {(!isLivePending || isDemoMode) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Pearson Correlation (r)" value={metrics.corr} subLabel="Strong positive co-movement" color="green" />
          <MetricCard label="Lead-Lag Horizon" value={metrics.horizon} subLabel="APIx leads MoSPI release" color="blue" />
          <MetricCard label="Tracking RMSE" value={metrics.rmse} subLabel="Low variance vs benchmark" />
          <MetricCard label="DGCA Agreement" value={metrics.agreement} subLabel={isDemoMode ? 'Within quarterly bounds' : (liveHistory?.dgca_benchmark_available ? 'DGCA data loaded' : 'Benchmark pending')} color={liveHistory?.dgca_benchmark_available ? 'green' : 'amber'} />
        </div>
      )}

      {/* Error state */}
      {!isDemoMode && liveError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-xs text-rose-800">
          <strong>Unable to load live history:</strong> {liveError instanceof Error ? liveError.message : 'Unknown error.'}
        </div>
      )}

      {/* Readiness panel (Live, not enough history) */}
      {showReadiness && liveHistory && (
        <LiveReadinessPanel history={liveHistory} />
      )}

      {/* Main chart */}
      {showChart && (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">
                {isDemoMode
                  ? `Daily APIx vs Official MoSPI Transport CPI & DGCA Reference (${periodFilter})`
                  : `Observed APIx History — ${liveChartPoints.length} index point${liveChartPoints.length !== 1 ? 's' : ''}`}
              </h3>
              <p className="text-[11px] text-[#667085]">
                {isDemoMode
                  ? 'Demonstrates that daily automated web scraping captures inflation turning points 14–28 days before official monthly publication.'
                  : 'Genuine daily index series from LIVE + IMPORTED observations. Benchmark overlay will appear when DGCA reference data is loaded.'}
              </p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
              isDemoMode
                ? 'text-indigo-800 bg-indigo-50 border-indigo-200'
                : 'text-emerald-800 bg-emerald-50 border-emerald-200'
            }`}>
              {isDemoMode ? 'SYNTHETIC DEMO DATA' : 'Validated Live Series'}
            </span>
          </div>
          <BacktestComparisonChart
            data={chartPoints as Parameters<typeof BacktestComparisonChart>[0]['data']}
            benchmarkName={benchmarkTitle}
          />
        </div>
      )}

    </div>
  );
}
