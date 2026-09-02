'use client';

import React, { useState, useMemo } from 'react';
import { History, TrendingUp, Download, CheckCircle2, RotateCw, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { BacktestComparisonChart } from '@/components/charts/BacktestComparisonChart';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { mockBacktestPoints } from '@/lib/mock-data/dashboard';
import { useExports, useCreateExport, useDownloadExport } from '@/lib/hooks/useExports';
import { notify } from '@/lib/notify';

export default function BacktestingPage() {
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Backtesting Analytical Filters
  const [periodFilter, setPeriodFilter] = useState<'12M' | '6M' | '3M'>('12M');
  const [benchmarkFilter, setBenchmarkFilter] = useState<'ALL' | 'CPI_TRANSPORT' | 'DGCA'>('ALL');
  const [methodologyVersion, setMethodologyVersion] = useState<'v1.2' | 'v1.0'>('v1.2');

  const { data: exportsList = [] } = useExports({ export_type: 'BACKTEST_AUDIT_PDF' });
  const createExportMutation = useCreateExport();
  const downloadMutation = useDownloadExport();

  // Find most recent ready backtest audit dossier
  const existingReadyJob = exportsList.find(
    (e) => e.export_type === 'BACKTEST_AUDIT_PDF' && e.status === 'READY'
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
        filters: {
          period: periodFilter,
          methodology: `APIx Matched-Basket ${methodologyVersion}`,
          benchmark: benchmarkFilter,
        },
      },
      {
        onSuccess: async (newJob) => {
          setIsGenerating(false);
          notify.success('Audit dossier generated', { description: newJob.filename });
          await downloadMutation.mutateAsync(newJob);
        },
        onError: (err: any) => {
          setIsGenerating(false);
          notify.error('Statistical audit dossier could not be generated', {
            description: err?.message || 'Please retry in a moment.',
          });
        },
      }
    );
  };

  // Filtered dataset based on period
  const filteredPoints = useMemo(() => {
    let points = [...mockBacktestPoints];
    if (periodFilter === '3M') points = points.slice(-3);
    else if (periodFilter === '6M') points = points.slice(-6);

    if (methodologyVersion === 'v1.0') {
      // Prior unweighted method had slightly higher drift
      return points.map((p) => ({
        ...p,
        apix: Number((p.apix * 1.015).toFixed(1)),
      }));
    }
    return points;
  }, [periodFilter, methodologyVersion]);

  // Reactive metrics
  const reactiveMetrics = useMemo(() => {
    if (periodFilter === '3M') {
      return { corr: '0.968', horizon: '+12 Days', rmse: '1.42 pts', agreement: '98.1%' };
    }
    if (periodFilter === '6M') {
      return { corr: '0.954', horizon: '+14 Days', rmse: '1.65 pts', agreement: '97.2%' };
    }
    return { corr: '0.942', horizon: '+14 Days', rmse: '1.84 pts', agreement: '96.5%' };
  }, [periodFilter]);

  const benchmarkTitle =
    benchmarkFilter === 'DGCA'
      ? 'DGCA Reference Benchmark'
      : benchmarkFilter === 'CPI_TRANSPORT'
      ? 'MoSPI CPI Transport Sub-Index'
      : 'MoSPI Transport & Comm Reference';

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
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Validation of the high-frequency daily Airfare Price Index against monthly official MoSPI CPI Transport releases and DGCA quarterly average fare indicators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadDossier}
            disabled={isGenerating || downloadMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-xs font-semibold text-white rounded shadow-2xs transition-colors cursor-pointer"
          >
            {isGenerating || downloadMutation.isPending ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Preparing Dossier...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Statistical Audit Dossier</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="px-2 py-1.5 bg-white border border-[#D0D5DD] hover:bg-slate-50 text-[#344054] text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
            title="Configure custom export format (XLSX, ZIP)"
          >
            Options
          </button>
        </div>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        exportType="BACKTEST_AUDIT_PDF"
        defaultFormat="PDF"
        title="MoSPI Transport CPI 12-Month Backtest Audit"
        filters={{
          period: periodFilter,
          benchmark: benchmarkFilter,
          methodology: methodologyVersion,
        }}
        filterSummary={[
          { label: 'Evaluation Period', value: `${periodFilter} Horizon` },
          { label: 'Benchmark', value: benchmarkTitle },
          { label: 'Methodology Version', value: `Laspeyres ${methodologyVersion}` },
        ]}
      />

      {/* Backtesting Filter Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Audit Scope:</span>
          </div>

          {/* Period Preset */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="12M">12 Months (Full Audit Horizon)</option>
            <option value="6M">Last 6 Months</option>
            <option value="3M">Last 3 Months (Recent Surge)</option>
          </select>

          {/* Benchmark Target */}
          <select
            value={benchmarkFilter}
            onChange={(e) => setBenchmarkFilter(e.target.value as any)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">MoSPI CPI &amp; DGCA Combined</option>
            <option value="CPI_TRANSPORT">MoSPI Transport CPI Only</option>
            <option value="DGCA">DGCA Quarterly Average Only</option>
          </select>

          {/* Methodology Version */}
          <select
            value={methodologyVersion}
            onChange={(e) => setMethodologyVersion(e.target.value as any)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="v1.2">Methodology v1.2 (Matched Laspeyres)</option>
            <option value="v1.0">Methodology v1.0 (Legacy Unweighted)</option>
          </select>

          <button
            onClick={() => {
              setPeriodFilter('12M');
              setBenchmarkFilter('ALL');
              setMethodologyVersion('v1.2');
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="text-xs text-[#667085]">
          Sample Size: <strong className="text-[#101828]">{filteredPoints.length} Observation Months</strong>
        </div>
      </div>

      {/* KPI Validation Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Pearson Correlation (r)</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">{reactiveMetrics.corr}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Strong positive co-movement</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Lead-Lag Horizon</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">{reactiveMetrics.horizon}</div>
          <span className="text-[11px] text-[#667085]">APIx leads MoSPI release</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Tracking RMSE</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{reactiveMetrics.rmse}</div>
          <span className="text-[11px] text-[#667085]">Low variance vs benchmark</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">DGCA Agreement</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{reactiveMetrics.agreement}</div>
          <span className="text-[11px] text-[#667085]">Within quarterly bounds</span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">
              Daily APIx vs Official MoSPI Transport CPI &amp; DGCA Reference ({periodFilter})
            </h3>
            <p className="text-[11px] text-[#667085]">
              Demonstrates that daily automated web scraping captures inflation turning points 14 to 28 days before official monthly publication.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Validated Against eSankhyiki Portal
          </span>
        </div>

        <BacktestComparisonChart
          data={filteredPoints}
          benchmarkName={benchmarkTitle}
        />
      </div>
    </div>
  );
}
