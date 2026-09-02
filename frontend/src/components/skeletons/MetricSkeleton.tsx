'use client';

import React from 'react';
import { clsx } from 'clsx';

export const MetricSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={clsx(
        'bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-2xs space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-slate-100 rounded animate-pulse" />
      </div>

      <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />

      <div className="flex items-center gap-2 pt-1 border-t border-[#F8FAFC]">
        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  );
};
