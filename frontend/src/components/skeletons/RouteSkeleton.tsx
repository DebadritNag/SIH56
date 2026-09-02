'use client';

import React from 'react';
import { clsx } from 'clsx';
import { MetricSkeleton } from './MetricSkeleton';
import { ChartSkeleton } from './ChartSkeleton';
import { TableSkeleton } from './TableSkeleton';

export const RouteSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Route Header with Metadata Strip */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-36 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-24 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-8 w-44 bg-slate-100 rounded animate-pulse" />
        </div>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-[#F1F5F9]">
          <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      {/* Advance Purchase Curve Chart */}
      <ChartSkeleton height={320} hasKpi />

      {/* Source Comparison Table */}
      <TableSkeleton rows={5} columns={6} />
    </div>
  );
};
