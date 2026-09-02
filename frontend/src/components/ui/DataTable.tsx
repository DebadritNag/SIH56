'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No matching statistical observations found.',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-white border border-[#E4E7EC] rounded-lg p-8 flex flex-col items-center justify-center text-xs text-[#667085]">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
        Loading dataset records...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full bg-white border border-[#E4E7EC] rounded-lg p-8 text-center text-xs text-[#667085]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={clsx('w-full overflow-x-auto bg-white border border-[#E4E7EC] rounded-lg shadow-xs', className)}>
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={clsx(
                  'px-3.5 py-2.5 tracking-wider uppercase text-[11px] whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9] text-[#101828]">
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick && onRowClick(row)}
              className={clsx(
                'transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-[#FDFDFE]'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'px-3.5 py-2.5 whitespace-nowrap',
                    col.align === 'right' && 'text-right tabular-nums',
                    col.align === 'center' && 'text-center'
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
