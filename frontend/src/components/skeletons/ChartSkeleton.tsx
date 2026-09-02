'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface ChartSkeletonProps {
  height?: number | string;
  hasKpi?: boolean;
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  height = 320,
  hasKpi = false,
  className,
}) => {
  return (
    <div
      className={clsx(
        'bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-2xs space-y-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        {hasKpi && <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />}
      </div>

      <div
        style={{ height }}
        className="w-full bg-slate-50/50 border border-slate-100 rounded flex flex-col justify-between p-4"
      >
        <div className="w-full border-b border-dashed border-slate-200" />
        <div className="w-full border-b border-dashed border-slate-200" />
        <div className="w-full border-b border-dashed border-slate-200" />
        <div className="w-full border-b border-dashed border-slate-200" />
        <div className="w-full border-b border-slate-300 flex justify-between pt-2">
          <div className="h-2.5 w-8 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-8 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-8 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-8 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-8 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
};
