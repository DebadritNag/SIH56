'use client';

import React, { useState } from 'react';
import {
  Download,
  X,
  FileText,
  AlertCircle,
  RotateCw,
  Copy,
  Trash2,
  Filter,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Calendar,
  FileCheck,
} from 'lucide-react';
import { ExportJob, ExportStatus, ExportFormat } from '@/types';
import { useExports, useDownloadExport, useDeleteExport, useRetryExport } from '@/lib/hooks/useExports';
import { notify } from '@/lib/notify';

interface DownloadCenterModalProps {
  open: boolean;
  onClose: () => void;
  onOpenNewExport?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return `${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST Today`;
  } catch {
    return '—';
  }
}

export const DownloadCenterModal: React.FC<DownloadCenterModalProps> = ({
  open,
  onClose,
  onOpenNewExport,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<ExportJob | null>(null);

  const { data: exports = [], isLoading, refetch } = useExports({
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
  });

  const downloadMutation = useDownloadExport();
  const deleteMutation = useDeleteExport();
  const retryMutation = useRetryExport();

  if (!open) return null;

  const filteredExports = exports.filter((item: ExportJob) => {
    if (selectedFormat !== 'ALL' && item.export_format !== selectedFormat) return false;
    return true;
  });

  const copyChecksum = (hash?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    notify.success('Checksum copied to clipboard', { description: hash.slice(0, 16) + '...' });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-3xl bg-white border border-[#E4E7EC] rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Export &amp; Download Center</h3>
              <p className="text-[11px] text-[#475467]">
                Inspect authentic server-side statistical extracts, XLSX decomposition workbooks, and official PDF dossiers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh exports"
              className="p-1.5 rounded text-[#667085] hover:text-[#101828] hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#94A3B8] hover:text-[#101828] hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3 text-xs bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#667085]">Format:</span>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="bg-slate-50 border border-[#D0D5DD] rounded px-2 py-1 text-[11px] font-medium text-[#101828]"
              >
                <option value="ALL">All Formats</option>
                <option value="CSV">CSV</option>
                <option value="XLSX">XLSX</option>
                <option value="PDF">PDF</option>
                <option value="PNG">PNG</option>
                <option value="ZIP">ZIP</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#667085]">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-[#D0D5DD] rounded px-2 py-1 text-[11px] font-medium text-[#101828]"
              >
                <option value="ALL">All Statuses</option>
                <option value="READY">Ready</option>
                <option value="GENERATING">Generating</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#667085] font-mono">
              {filteredExports.length} item{filteredExports.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Exports List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9] p-2">
          {isLoading && (
            <div className="p-8 text-center text-xs text-[#667085] flex flex-col items-center justify-center gap-2">
              <RotateCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>Loading export catalog...</span>
            </div>
          )}

          {!isLoading && filteredExports.length === 0 && (
            <div className="p-8 text-center text-xs text-[#667085]">
              No exports match the selected filter criteria.
            </div>
          )}

          {filteredExports.map((item: ExportJob) => (
            <div
              key={item.id}
              className="p-3 rounded-md hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-transparent hover:border-[#E4E7EC]"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[#475467] shrink-0 mt-0.5 font-bold text-[10px] uppercase font-mono">
                  {item.export_format}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-xs text-[#101828] truncate">{item.title}</h4>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-[#475467] font-mono text-[9px] rounded uppercase font-semibold">
                      {item.data_origin || 'LIVE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#667085] font-mono mt-0.5 flex-wrap">
                    <span className="truncate max-w-[220px]">{item.filename}</span>
                    <span>•</span>
                    {item.status === 'READY' ? (
                      <>
                        <span>{formatBytes(item.file_size_bytes)}</span>
                        {item.row_count && <span>• {item.row_count.toLocaleString()} rows</span>}
                        {item.page_count && <span>• {item.page_count} pages</span>}
                      </>
                    ) : (
                      <span className="text-amber-700 font-medium">Calculating metrics...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] mt-0.5">
                    <span>Generated: {formatTime(item.generated_at || item.created_at)}</span>
                    {item.checksum_sha256 && (
                      <button
                        onClick={() => copyChecksum(item.checksum_sha256)}
                        className="hover:text-blue-600 flex items-center gap-0.5 font-mono"
                        title="Copy SHA-256 Digest"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>SHA-256</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {item.status === 'READY' && (
                  <button
                    onClick={() => downloadMutation.mutate(item)}
                    disabled={downloadMutation.isPending}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                )}

                {item.status === 'GENERATING' && (
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
                    <span>{item.current_stage || 'Processing...'}</span>
                    {item.progress_percent !== undefined && (
                      <span className="font-mono font-bold">{Math.round(item.progress_percent)}%</span>
                    )}
                  </div>
                )}

                {item.status === 'FAILED' && (
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                      FAILED
                    </span>
                    <button
                      onClick={() => retryMutation.mutate(item.id)}
                      className="px-2 py-1 bg-white border border-[#D0D5DD] hover:bg-slate-50 text-xs font-semibold rounded text-[#344054]"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  title="Delete export record"
                  className="p-1.5 text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E4E7EC] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#667085]">
            Authorized exports are retained for 30 days in private audit storage.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#D0D5DD] text-xs font-semibold text-[#344054] bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
