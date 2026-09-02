'use client';

import React from 'react';
import { clsx } from 'clsx';
import { TableSkeleton } from './TableSkeleton';

export const FareExplorerSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('space-y-6 animate-in fade-in duration-150', className)}>
      {/* Title & Export Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-6 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-80 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="h-11 w-full bg-white border border-[#E4E7EC] rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-6 w-36 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Dense High-Volume Table Placeholder */}
      <TableSkeleton rows={12} columns={8} dense />

      {/* Pagination Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-3 flex items-center justify-between shadow-2xs">
        <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
          <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
};
