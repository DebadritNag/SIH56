'use client';

import React from 'react';
import { AlertTriangle, Info, ShieldAlert, X, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'default' | 'warning' | 'destructive';
  entityName?: string;
  details?: React.ReactNode;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  entityName,
  details,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const iconMap = {
    default: <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
    destructive: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />,
  };

  const buttonStyle = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    destructive: 'bg-rose-600 hover:bg-rose-700 text-white',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
    >
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-lg shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          {iconMap[variant]}
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-[#101828]">
              {title}
            </h3>
            {entityName && (
              <span className="inline-block mt-1 font-mono text-[11px] font-semibold bg-slate-100 text-[#475467] px-2 py-0.5 rounded border border-[#E2E8F0]">
                {entityName}
              </span>
            )}
            <p className="text-xs text-[#475467] mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 rounded text-[#94A3B8] hover:text-[#101828] hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {details && (
          <div className="p-3 bg-slate-50 border border-[#E4E7EC] rounded text-xs text-[#475467]">
            {details}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 rounded border border-[#D0D5DD] text-xs font-semibold text-[#344054] hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={clsx(
              'px-3.5 py-1.5 rounded text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50',
              buttonStyle[variant]
            )}
          >
            {isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
