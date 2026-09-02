'use client';

import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export interface DegradedDataStateProps {
  coveragePct: number;
  thresholdPct?: number;
  affectedStrataCount?: number;
  actionHref?: string;
  className?: string;
}

export const DegradedDataState: React.FC<DegradedDataStateProps> = ({
  coveragePct,
  thresholdPct = 90,
  affectedStrataCount = 4,
  actionHref = '/data-quality',
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`p-3 bg-amber-50/70 border border-amber-300 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 text-amber-900 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold uppercase tracking-wider text-[10px]">
            DEGRADED STATISTICAL COVERAGE ({coveragePct.toFixed(1)}%)
          </span>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Only {coveragePct.toFixed(1)}% of expected corridor/window strata possess validated observations today (Required: {thresholdPct}%). {affectedStrataCount} strata are currently missing or imputed.
          </p>
        </div>
      </div>

      <Link
        href={actionHref}
        className="font-bold text-[11px] text-amber-900 hover:text-amber-950 flex items-center gap-1 underline underline-offset-2 shrink-0"
      >
        <span>Inspect Quality Matrix</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
