'use client';

import React, { useEffect, useState } from 'react';
import { formatTimestamp, formatRelativeTime, parseTimestamp } from '@/lib/utils/timestamps';

export interface DataFreshnessProps {
  timestamp?: string | number | Date | null;
  label?: string;
  status?: 'live' | 'fresh' | 'aging' | 'stale' | 'idle';
  showRelative?: boolean;
  showAbsolute?: boolean;
  isRealtime?: boolean;
  source?: string;
  className?: string;
}

export function DataFreshness({
  timestamp,
  label = 'Updated',
  status,
  showRelative = true,
  showAbsolute = false,
  isRealtime = false,
  source,
  className = '',
}: DataFreshnessProps) {
  const [relativeText, setRelativeText] = useState<string>('—');
  const [isHighlighted, setIsHighlighted] = useState(false);

  const dateObj = parseTimestamp(timestamp);

  // Update relative time tick every 10 seconds
  useEffect(() => {
    if (!dateObj) {
      setRelativeText('—');
      return;
    }

    const update = () => {
      setRelativeText(formatRelativeTime(dateObj));
    };

    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [dateObj]);

  // Flash highlight when timestamp changes
  useEffect(() => {
    if (!timestamp) return;
    setIsHighlighted(true);
    const timeout = setTimeout(() => setIsHighlighted(false), 900);
    return () => clearTimeout(timeout);
  }, [timestamp]);

  if (!dateObj) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span>{label}: Not yet processed</span>
      </div>
    );
  }

  const absoluteText = formatTimestamp(dateObj, { format: 'timeOnly' });
  const fullTooltip = `Authoritative Event: ${formatTimestamp(dateObj, { format: 'tooltip' })}`;

  // Determine freshness indicator color
  let dotColor = 'bg-emerald-500';
  let badgeLabel = 'Fresh';

  if (isRealtime) {
    dotColor = 'bg-cyan-400';
    badgeLabel = 'Live processing';
  } else if (status === 'stale') {
    dotColor = 'bg-rose-500';
    badgeLabel = 'Stale';
  } else if (status === 'aging') {
    dotColor = 'bg-amber-500';
    badgeLabel = 'Aging';
  }

  return (
    <div
      title={fullTooltip}
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono transition-all duration-300 border ${
        isHighlighted
          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
          : 'bg-slate-900/40 border-slate-800 text-slate-300'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${dotColor} ${
            isRealtime ? 'animate-pulse ring-2 ring-cyan-500/30' : ''
          }`}
        />
        {isRealtime && (
          <span className="text-[11px] font-semibold tracking-wider uppercase text-cyan-400">
            Realtime
          </span>
        )}
      </div>

      <span className="text-slate-500">·</span>

      <div className="flex items-center gap-1.5 text-slate-300">
        <span className="text-slate-400 font-sans">{label}</span>
        {showRelative && (
          <span className="font-medium text-slate-200">{relativeText}</span>
        )}
        {showAbsolute && (
          <span className="text-slate-400">({absoluteText})</span>
        )}
      </div>

      {source && (
        <>
          <span className="text-slate-600">·</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
            {source}
          </span>
        </>
      )}
    </div>
  );
}
