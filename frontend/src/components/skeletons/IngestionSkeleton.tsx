'use client';

import React from 'react';
import { clsx } from 'clsx';
import { MetricSkeleton } from './MetricSkeleton';
import { TableSkeleton } from './TableSkeleton';

export const IngestionSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Title & Trigger Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-6 w-52 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-80 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-36 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Operational Mode Card */}
      <div className="h-20 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-4 w-40 bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-8 w-32 bg-slate-700 rounded animate-pulse" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      {/* Active Pipeline Flow Placeholder */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-50 border border-slate-200 rounded p-2 flex flex-col justify-between">
              <div className="h-2 w-10 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-14 bg-slate-300 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Historical Runs Table */}
      <TableSkeleton rows={6} columns={7} />
    </div>
  );
};
