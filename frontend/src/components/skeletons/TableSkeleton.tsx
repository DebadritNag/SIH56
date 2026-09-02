'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  dense?: boolean;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columns = 6,
  rows = 8,
  dense = false,
  className,
}) => {
  return (
    <div className={clsx('w-full bg-white border border-[#E4E7EC] rounded-lg overflow-hidden shadow-2xs', className)}>
      {/* Header Placeholder */}
      <div className="bg-[#F8FAFC] border-b border-[#E4E7EC] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-6 gap-3 px-4 py-2.5 bg-slate-50 border-b border-[#E4E7EC]">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'h-3 bg-slate-200 rounded animate-pulse',
              i === columns - 1 ? 'w-16 ml-auto' : 'w-20'
            )}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#F1F5F9]">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={clsx(
              'grid grid-cols-6 gap-3 px-4 items-center',
              dense ? 'py-2' : 'py-3'
            )}
          >
            {Array.from({ length: columns }).map((_, c) => {
              const widths = ['w-24', 'w-16', 'w-20', 'w-28', 'w-14', 'w-16 ml-auto'];
              return (
                <div
                  key={c}
                  className={clsx(
                    'h-3 bg-slate-100 rounded animate-pulse',
                    widths[c % widths.length]
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
