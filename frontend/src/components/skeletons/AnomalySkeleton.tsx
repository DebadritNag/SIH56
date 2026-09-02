'use client';

import React from 'react';
import { clsx } from 'clsx';
import { MetricSkeleton } from './MetricSkeleton';
import { TableSkeleton } from './TableSkeleton';

export const AnomalySkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Title & Severity Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-80 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      {/* Filter Strip */}
      <div className="h-11 w-full bg-white border border-[#E4E7EC] rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Main Table */}
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
};
