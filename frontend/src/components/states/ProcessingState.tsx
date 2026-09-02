'use client';

import React from 'react';
import { RotateCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';
import { clsx } from 'clsx';

export interface PipelineStageItem {
  name: string;
  status: 'completed' | 'running' | 'waiting' | 'failed';
  processedCount?: number;
  totalCount?: number;
  details?: string;
}

export interface ProcessingStateProps {
  layout?: SystemStateLayout;
  jobId: string;
  title: string;
  stages: PipelineStageItem[];
  elapsedSeconds?: number;
  onCancel?: () => void;
  className?: string;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  layout = 'card',
  jobId,
  title,
  stages,
  elapsedSeconds = 48,
  onCancel,
  className,
}) => {
  return (
    <div className={clsx('bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs space-y-4', className)}>
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-2.5">
          <RotateCw className="w-4 h-4 text-blue-600 animate-spin" />
          <div>
            <h3 className="text-xs font-bold text-[#101828] uppercase tracking-wider">{title}</h3>
            <span className="text-[11px] font-mono text-[#667085]">Job ID: {jobId}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#475467] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Elapsed: {elapsedSeconds}s
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              Cancel Job
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stg, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 rounded bg-slate-50 border border-[#E4E7EC] text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              {stg.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {stg.status === 'running' && <RotateCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
              {stg.status === 'waiting' && <Clock className="w-3.5 h-3.5 text-slate-400" />}
              {stg.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
              <span className={stg.status === 'running' ? 'font-bold text-[#101828]' : 'text-[#475467]'}>
                {stg.name}
              </span>
            </div>

            <div className="text-[11px]">
              {stg.status === 'running' && stg.processedCount !== undefined && (
                <span className="text-blue-700 font-bold">
                  {stg.processedCount.toLocaleString()} / {stg.totalCount?.toLocaleString() || '—'}
                </span>
              )}
              {stg.status === 'completed' && <span className="text-emerald-700 font-bold">Done</span>}
              {stg.status === 'waiting' && <span className="text-slate-400">Waiting</span>}
              {stg.status === 'failed' && <span className="text-rose-700 font-bold">Failed</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
