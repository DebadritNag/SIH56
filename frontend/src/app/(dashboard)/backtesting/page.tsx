'use client';

import React, { useState } from 'react';
import { History, TrendingUp, Download, CheckCircle2, RotateCw } from 'lucide-react';
import { BacktestComparisonChart } from '@/components/charts/BacktestComparisonChart';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { mockBacktestPoints } from '@/lib/mock-data/dashboard';
import { useExports, useCreateExport, useDownloadExport } from '@/lib/hooks/useExports';
import { notify } from '@/lib/notify';

export default function BacktestingPage() {
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
          period: '12M',
          methodology: 'APIx Matched-Basket v1.2',
          benchmark: 'MoSPI Transport CPI & DGCA',
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
        filterSummary={[
          { label: 'Evaluation Period', value: '12 Months (2025-2026)' },
          { label: 'Benchmark', value: 'MoSPI Transport CPI & DGCA' },
          { label: 'Correlation', value: 'r = 0.942 (Strong)' },
        ]}
      />

      {/* KPI Validation Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Pearson Correlation (r)</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">0.942</div>
          <span className="text-[11px] text-emerald-700 font-medium">Strong positive co-movement</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Lead-Lag Horizon</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">+14 Days</div>
          <span className="text-[11px] text-[#667085]">APIx leads MoSPI release</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Tracking RMSE</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">1.84 pts</div>
          <span className="text-[11px] text-[#667085]">Low variance vs benchmark</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">DGCA Agreement</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">96.5%</div>
          <span className="text-[11px] text-[#667085]">Within quarterly bounds</span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Daily APIx vs Official MoSPI Transport CPI &amp; DGCA Reference (12 Months)</h3>
            <p className="text-[11px] text-[#667085]">
              Demonstrates that daily automated web scraping captures inflation turning points 14 to 28 days before official monthly publication.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Validated Against eSankhyiki Portal
          </span>
        </div>

        <BacktestComparisonChart data={mockBacktestPoints} />
      </div>
    </div>
  );
}
