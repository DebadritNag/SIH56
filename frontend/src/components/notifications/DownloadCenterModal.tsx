'use client';

import React from 'react';
import { Download, CheckCircle2, Clock, RotateCw, X, FileText, AlertCircle } from 'lucide-react';
import { notify } from '@/lib/notify';

export interface DownloadItem {
  id: string;
  title: string;
  filename: string;
  filesize: string;
  status: 'READY' | 'PROCESSING' | 'FAILED';
  createdAt: string;
  rowCount?: number;
}

const MOCK_DOWNLOADS: DownloadItem[] = [
  {
    id: 'exp-1092',
    title: 'National Fare Observations (Validated)',
    filename: 'airpulse-fares-DEL-BOM-2026-08-01_2026-09-02.csv',
    filesize: '4.8 MB',
    rowCount: 28452,
    status: 'READY',
    createdAt: '17:41 IST Today',
  },
  {
    id: 'exp-1091',
    title: 'Official APIx Matched Basket Decomposition',
    filename: 'airpulse-apix-components-2026-09-02.xlsx',
    filesize: '890 KB',
    rowCount: 405,
    status: 'READY',
    createdAt: '15:30 IST Today',
  },
  {
    id: 'exp-1090',
    title: 'MoSPI Transport CPI 12-Month Backtest Audit',
    filename: 'airpulse-backtest-dossier-2026-Q3.pdf',
    filesize: '1.2 MB',
    status: 'READY',
    createdAt: '12:15 IST Today',
  },
  {
    id: 'exp-1089',
    title: 'Multi-Source Anomaly Extract (PriceGuard)',
    filename: 'airpulse-anomalies-2026-09-02.csv',
    filesize: '—',
    status: 'PROCESSING',
    createdAt: 'Just now',
  },
];

interface DownloadCenterModalProps {
  open: boolean;
  onClose: () => void;
}

export const DownloadCenterModal: React.FC<DownloadCenterModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  const handleDownload = (item: DownloadItem) => {
    notify.info('Download started', { description: item.filename });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
    >
      <div className="w-full max-w-xl bg-white border border-[#E4E7EC] rounded-lg shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-[#101828]">Export &amp; Download Center</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#94A3B8] hover:text-[#101828] hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#475467]">
          Inspect status and retrieve recently generated CSV datasets, statistical XLSX baskets, and official PDF audit dossiers.
        </p>

        <div className="divide-y divide-[#F1F5F9] border border-[#E4E7EC] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          {MOCK_DOWNLOADS.map((item) => (
            <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-[#667085] mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-[#101828]">{item.title}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-[#667085] font-mono mt-0.5">
                    <span>{item.filename}</span>
                    <span>•</span>
                    <span>{item.filesize}</span>
                    {item.rowCount && <span>• {item.rowCount.toLocaleString()} rows</span>}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] block mt-0.5">{item.createdAt}</span>
                </div>
              </div>

              <div>
                {item.status === 'READY' && (
                  <button
                    onClick={() => handleDownload(item)}
                    className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded text-[11px] transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                )}
                {item.status === 'PROCESSING' && (
                  <span className="px-2.5 py-1 bg-slate-100 text-[#475467] rounded text-[10px] font-mono font-medium flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Processing...</span>
                  </span>
                )}
                {item.status === 'FAILED' && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold">
                    FAILED
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#D0D5DD] text-xs font-semibold text-[#344054] hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
