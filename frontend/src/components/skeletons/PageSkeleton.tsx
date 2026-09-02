'use client';

import React from 'react';
import { clsx } from 'clsx';
import { MetricSkeleton } from './MetricSkeleton';
import { ChartSkeleton } from './ChartSkeleton';
import { TableSkeleton } from './TableSkeleton';

export interface PageSkeletonProps {
  titleWidth?: string;
  hasFilters?: boolean;
  kpiCount?: number;
  hasChart?: boolean;
  hasTable?: boolean;
  className?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  titleWidth = 'w-48',
  hasFilters = true,
  kpiCount = 4,
  hasChart = true,
  hasTable = true,
  className,
}) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Title & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={clsx('h-6 bg-slate-200 rounded animate-pulse', titleWidth)} />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Filter Bar Placeholder */}
      {hasFilters && (
        <div className="h-10 w-full bg-white border border-[#E4E7EC] rounded-lg p-2 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
            <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      )}

      {/* KPI Row */}
      {kpiCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Chart Section */}
      {hasChart && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartSkeleton height={320} />
          </div>
          <div className="lg:col-span-1">
            <ChartSkeleton height={320} />
          </div>
        </div>
      )}

      {/* Table Section */}
      {hasTable && <TableSkeleton rows={8} columns={6} />}
    </div>
  );
};
