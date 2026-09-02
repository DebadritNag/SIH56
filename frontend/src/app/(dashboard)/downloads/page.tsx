'use client';

import React, { useState } from 'react';
import {
  Download,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Trash2,
  RotateCw,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Clock,
  ShieldCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useExports, useDownloadExport, useDeleteExport, useRetryExport } from '@/lib/hooks/useExports';
import { ExportJob, ExportStatus } from '@/types';
import { notify } from '@/lib/notify';
import { ExportDialog } from '@/components/dialogs/ExportDialog';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function DownloadsPage() {
  const [selectedFormat, setSelectedFormat] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewExportModal, setShowNewExportModal] = useState(false);

  const { data: exports = [], isLoading, refetch } = useExports({
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
  });

  const downloadMutation = useDownloadExport();
  const deleteMutation = useDeleteExport();
  const retryMutation = useRetryExport();

  const filteredExports = exports.filter((item: ExportJob) => {
    if (selectedFormat !== 'ALL' && item.export_format !== selectedFormat) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchFilename = item.filename.toLowerCase().includes(q);
      if (!matchTitle && !matchFilename) return false;
    }
    return true;
  });

  const copyChecksum = (hash?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    notify.success('Checksum copied to clipboard', { description: hash });
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'XLSX':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case 'PDF':
        return <FileText className="w-4 h-4 text-rose-600" />;
      case 'CSV':
        return <FileCheck className="w-4 h-4 text-blue-600" />;
      default:
        return <Download className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Export &amp; Download Center
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Institutional repository of certified statistical exports, econometric workbooks, and official CPI augmentation audit dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#344054] rounded shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowNewExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Custom Export</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Total Generated Artifacts</span>
          <span className="text-2xl font-bold text-[#101828] tabular-nums mt-0.5">{exports.length}</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Ready for Download</span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
            {exports.filter((e: ExportJob) => e.status === 'READY').length}
          </span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">In-Flight Generations</span>
          <span className="text-2xl font-bold text-amber-600 tabular-nums mt-0.5">
            {exports.filter((e: ExportJob) => e.status === 'GENERATING' || e.status === 'QUEUED').length}
          </span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase block">Storage Retention</span>
          <span className="text-2xl font-bold text-blue-700 tabular-nums mt-0.5">30 Days</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search filename or export title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded text-xs text-[#101828] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#667085]">Format:</span>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-[#F8FAFC] border border-[#D0D5DD] rounded px-2.5 py-1 text-xs font-semibold text-[#101828] focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="bg-[#F8FAFC] border border-[#D0D5DD] rounded px-2.5 py-1 text-xs font-semibold text-[#101828] focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY">Ready</option>
              <option value="GENERATING">Generating</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Format</th>
                <th className="p-3">Title &amp; Slugs</th>
                <th className="p-3">Provenance / Scope</th>
                <th className="p-3 text-right">Metrics (Rows / Size)</th>
                <th className="p-3">SHA-256 Provenance Digest</th>
                <th className="p-3">Generated</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#667085]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Loading authorized export index...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && filteredExports.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#667085]">
                    No export artifacts found matching the current search &amp; filter parameters.
                  </td>
                </tr>
              )}

              {filteredExports.map((item: ExportJob) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                        {getFormatIcon(item.export_format)}
                      </div>
                      <span className="font-bold text-[10px] uppercase font-mono text-[#344054]">
                        {item.export_format}
                      </span>
                    </div>
                  </td>

                  <td className="p-3 max-w-xs">
                    <div className="font-bold text-[#101828] text-xs">{item.title}</div>
                    <div className="text-[11px] text-[#667085] font-mono truncate">{item.filename}</div>
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-[#475467] font-mono text-[10px] rounded uppercase font-semibold">
                      {item.data_origin || 'LIVE'}
                    </span>
                  </td>

                  <td className="p-3 text-right font-mono tabular-nums">
                    <div className="font-semibold text-[#101828]">{formatBytes(item.file_size_bytes)}</div>
                    <div className="text-[10px] text-[#667085]">
                      {item.row_count ? `${item.row_count.toLocaleString()} rows` : item.page_count ? `${item.page_count} pages` : '—'}
                    </div>
                  </td>

                  <td className="p-3 font-mono text-[10px] text-[#667085]">
                    {item.checksum_sha256 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{item.checksum_sha256}</span>
                        <button
                          onClick={() => copyChecksum(item.checksum_sha256)}
                          className="hover:text-blue-600 cursor-pointer p-0.5"
                          title="Copy full SHA-256 digest"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="p-3 text-[#667085] whitespace-nowrap text-[11px]">
                    {formatDate(item.generated_at || item.created_at)}
                  </td>

                  <td className="p-3">
                    {item.status === 'READY' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                        <FileCheck className="w-3 h-3" />
                        READY
                      </span>
                    )}

                    {item.status === 'GENERATING' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded text-[10px] border border-amber-200">
                        <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
                        {item.progress_percent ? `${Math.round(item.progress_percent)}%` : 'PROCESSING'}
                      </span>
                    )}

                    {item.status === 'FAILED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded text-[10px] border border-rose-200">
                        <AlertCircle className="w-3 h-3" />
                        FAILED
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status === 'READY' && (
                        <button
                          onClick={() => downloadMutation.mutate(item)}
                          disabled={downloadMutation.isPending}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      )}

                      {item.status === 'FAILED' && (
                        <button
                          onClick={() => retryMutation.mutate(item.id)}
                          className="px-2 py-1 bg-white border border-[#D0D5DD] hover:bg-slate-50 text-xs font-semibold rounded text-[#344054] cursor-pointer"
                        >
                          Retry
                        </button>
                      )}

                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1 text-[#94A3B8] hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete export"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Custom Export Dialog */}
      <ExportDialog
        open={showNewExportModal}
        onClose={() => setShowNewExportModal(false)}
        exportType="FARE_OBSERVATIONS"
        defaultFormat="CSV"
        title="Custom National Dataset Extract"
        filterSummary={[
          { label: 'Basket Scope', value: 'All 81 Routes' },
          { label: 'Time Horizon', value: 'Last 30 Days' },
          { label: 'Data Quality', value: 'Q ≥ 0.95 Validated Only' },
        ]}
        estimatedRows={54200}
      />
    </div>
  );
}
