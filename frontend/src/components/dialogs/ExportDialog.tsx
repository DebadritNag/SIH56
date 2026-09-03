'use client';

import React, { useState } from 'react';
import { Download, X, FileText, CheckCircle2, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import { ExportFormat, ExportType } from '@/types';
import { useCreateExport, useDownloadExport } from '@/lib/hooks/useExports';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  exportType: ExportType;
  defaultFormat?: ExportFormat;
  title: string;
  filters?: Record<string, any>;
  filterSummary?: { label: string; value: string }[];
  estimatedRows?: number;
}

const FORMAT_OPTIONS: Record<ExportType, ExportFormat[]> = {
  FARE_OBSERVATIONS: ['CSV', 'XLSX', 'JSON'],
  APIX_INDEX: ['CSV', 'XLSX', 'PDF'],
  APIX_COMPONENTS: ['CSV', 'XLSX'],
  ROUTE_INTELLIGENCE: ['CSV', 'XLSX', 'PDF'],
  BOOKING_WINDOW_ANALYSIS: ['CSV', 'XLSX', 'PDF'],
  ANOMALIES: ['CSV', 'XLSX', 'PDF'],
  PRICE_SHOCKS: ['CSV', 'XLSX', 'PDF'],
  ALERTS: ['CSV', 'PDF'],
  SOURCE_HEALTH: ['CSV', 'XLSX', 'PDF'],
  COLLECTION_RUN: ['CSV', 'JSON'],
  PIPELINE_RUN: ['CSV', 'JSON', 'PDF'],
  INGESTION_REPORT: ['CSV', 'JSON', 'PDF'],
  DATA_QUALITY: ['PDF', 'XLSX', 'CSV'],
  BACKTEST_DATA: ['XLSX', 'CSV'],
  BACKTEST_AUDIT_PDF: ['PDF', 'XLSX', 'ZIP'],
  METHODOLOGY_REPORT: ['PDF'],
  PROVENANCE_REPORT: ['PDF', 'JSON'],
  REFERENCE_DATASET: ['CSV', 'XLSX'],
  BASKET_DEFINITION: ['CSV', 'XLSX'],
  MODEL_REPORT: ['PDF', 'XLSX', 'JSON'],
  SYSTEM_DIAGNOSTICS_REPORT: ['PDF', 'JSON'],
  SYSTEM_SELF_TEST_REPORT: ['PDF', 'JSON'],
  OVERVIEW_REPORT: ['PDF', 'CSV', 'XLSX'],
  CHART_IMAGE: ['PNG', 'PDF'],
};

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  exportType,
  defaultFormat,
  title,
  filters = {},
  filterSummary = [],
  estimatedRows,
}) => {
  const allowedFormats = FORMAT_OPTIONS[exportType] || ['CSV', 'XLSX', 'PDF'];
  const [format, setFormat] = useState<ExportFormat>(defaultFormat || allowedFormats[0]);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const createExportMutation = useCreateExport();
  const downloadMutation = useDownloadExport();

  if (!open) return null;

  const handleGenerate = () => {
    createExportMutation.mutate(
      {
        export_type: exportType,
        format,
        title,
        filters,
        parameters: { include_metadata: includeMetadata },
      },
      {
        onSuccess: async (job) => {
          onClose();
          await downloadMutation.mutateAsync(job);
        },
      }
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-lg shadow-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Export Dataset</h3>
              <p className="text-[10px] text-[#475467]">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#94A3B8] hover:text-[#101828] hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selection */}
        <div>
          <label className="text-[11px] font-bold text-[#101828] uppercase tracking-wider block mb-1.5">
            Select Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {allowedFormats.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`py-2 px-3 rounded border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  format === f
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700 ring-1 ring-blue-600'
                    : 'border-[#D0D5DD] bg-white text-[#344054] hover:bg-slate-50'
                }`}
              >
                <span>{f}</span>
                <span className="text-[9px] font-normal text-[#667085]">
                  {f === 'CSV' && 'Raw tabular data'}
                  {f === 'XLSX' && 'Multi-sheet workbook'}
                  {f === 'PDF' && 'Official audit report'}
                  {f === 'PNG' && '2x High-res visual'}
                  {f === 'JSON' && 'Machine-readable'}
                  {f === 'ZIP' && 'Audit dossier bundle'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Applied Filters Context */}
        {filterSummary.length > 0 && (
          <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded p-2.5 text-xs space-y-1">
            <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
              Active Observation Filters
            </span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {filterSummary.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-[#667085]">{f.label}:</span>
                  <span className="font-semibold text-[#101828] font-mono">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimate */}
        {estimatedRows && (
          <div className="flex items-center justify-between text-xs py-1 px-2 rounded bg-blue-50/50 border border-blue-100 text-[#101828]">
            <span className="text-[11px] text-[#475467]">Estimated Observations:</span>
            <span className="font-bold font-mono text-blue-700">~{estimatedRows.toLocaleString()} rows</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#D0D5DD] text-xs font-semibold text-[#344054] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createExportMutation.isPending}
            onClick={handleGenerate}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{createExportMutation.isPending ? 'Initiating Export...' : 'Generate Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
