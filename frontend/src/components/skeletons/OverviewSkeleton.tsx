'use client';

import React from 'react';
import { clsx } from 'clsx';
import { MetricSkeleton } from './MetricSkeleton';
import { ChartSkeleton } from './ChartSkeleton';

export const OverviewSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-6 w-60 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-80 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Hero Strip: 40% Primary Index Card + 3 Intelligence KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dominant APIx Hero Card Placeholder (5 cols) */}
        <div className="lg:col-span-5 bg-[#081426] border border-[#132238] rounded-xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-slate-700 rounded animate-pulse" />
            <div className="h-5 w-20 bg-slate-800 rounded animate-pulse" />
          </div>

          <div className="space-y-2 py-2">
            <div className="h-10 w-44 bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-36 bg-slate-800 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
            <div className="h-7 bg-slate-800 rounded animate-pulse" />
            <div className="h-7 bg-slate-800 rounded animate-pulse" />
            <div className="h-7 bg-slate-800 rounded animate-pulse" />
          </div>
        </div>

        {/* 3 Secondary KPI Cards (7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      </div>

      {/* Main Analytical Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* National APIx Trend Chart (7 cols) */}
        <div className="lg:col-span-7">
          <ChartSkeleton height={340} hasKpi />
        </div>

        {/* Top Route Contributors Waterfall (5 cols) */}
        <div className="lg:col-span-5">
          <ChartSkeleton height={340} />
        </div>
      </div>

      {/* Heatmap & Market Signals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ChartSkeleton height={280} />
        </div>
        <div className="lg:col-span-4 bg-white border border-[#E4E7EC] rounded-lg p-4 space-y-3">
          <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-14 bg-slate-50 border border-slate-100 rounded animate-pulse" />
            <div className="h-14 bg-slate-50 border border-slate-100 rounded animate-pulse" />
            <div className="h-14 bg-slate-50 border border-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Data Reliability Trust Strip Placeholder */}
      <div className="h-12 w-full bg-slate-50 border border-[#E4E7EC] rounded-lg flex items-center justify-around px-4">
        <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );
};
