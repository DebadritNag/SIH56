'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import {
  WifiOff,
  AlertTriangle,
  Server,
  Clock,
  Radio,
  Layers,
  ChevronRight,
  X
} from 'lucide-react';

export type ServiceNoticePriority =
  | 'AUTH'
  | 'OFFLINE'
  | 'OUTAGE'
  | 'DEGRADED'
  | 'STALE'
  | 'REALTIME'
  | 'DEMO';

export interface ServiceNotice {
  id: string;
  priority: ServiceNoticePriority;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  timestamp?: string;
}

export const ServiceBannerManager: React.FC = () => {
  const { mode } = useDataMode();
  const [isOffline, setIsOffline] = useState(false);
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([]);
  const [showAllNotices, setShowAllNotices] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // System notices list ordered by priority
  const activeNotices: ServiceNotice[] = [];

  if (isOffline) {
    activeNotices.push({
      id: 'offline',
      priority: 'OFFLINE',
      title: 'YOU ARE OFFLINE',
      message: 'AirPulse cannot retrieve new observations until network connectivity is restored. Displayed metrics are cached.',
      actionLabel: 'System Diagnostics',
      actionHref: '/system',
    });
  }

  // Demo-only illustrative notice — never shown in Live mode
  if (mode === 'mock') {
    activeNotices.push({
      id: 'source-degraded',
      priority: 'DEGRADED',
      title: 'DEGRADED SOURCE COVERAGE (MOCK DATA)',
      message: '1 of 5 collection sources (OTA Source 03) is degraded. APIx index remains available with 94.8% basket confidence.',
      actionLabel: 'View Source Health',
      actionHref: '/sources',
    });
  }

  const visibleNotices = activeNotices.filter((n) => !dismissedNotices.includes(n.id));

  if (visibleNotices.length === 0) return null;

  const topNotice = visibleNotices[0];

  const bannerTheme = {
    AUTH: 'bg-rose-50 border-rose-300 text-rose-900',
    OFFLINE: 'bg-slate-900 border-slate-800 text-slate-100',
    OUTAGE: 'bg-rose-50 border-rose-300 text-rose-900',
    DEGRADED: 'bg-amber-50 border-amber-300 text-amber-900',
    STALE: 'bg-blue-50 border-blue-300 text-blue-900',
    REALTIME: 'bg-slate-100 border-slate-300 text-slate-800',
    DEMO: 'bg-indigo-50 border-indigo-300 text-indigo-900',
  };

  const bannerIcon = {
    AUTH: <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />,
    OFFLINE: <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />,
    OUTAGE: <Server className="w-4 h-4 text-rose-600 shrink-0" />,
    DEGRADED: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
    STALE: <Clock className="w-4 h-4 text-blue-600 shrink-0" />,
    REALTIME: <Radio className="w-4 h-4 text-slate-600 shrink-0" />,
    DEMO: <Layers className="w-4 h-4 text-indigo-600 shrink-0" />,
  };

  return (
    <div
      role="region"
      aria-label="System Notice Banner"
      className={`border-b px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 transition-colors ${bannerTheme[topNotice.priority]}`}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
        {bannerIcon[topNotice.priority]}
        <span className="font-bold tracking-wider uppercase text-[10px]">
          {topNotice.title}
        </span>
        <span className="opacity-40">•</span>
        <span className="leading-tight text-[11px] font-medium">
          {topNotice.message}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        {topNotice.actionLabel && topNotice.actionHref && (
          <Link
            href={topNotice.actionHref}
            className="font-bold underline hover:opacity-80 transition-opacity"
          >
            {topNotice.actionLabel} →
          </Link>
        )}

        {visibleNotices.length > 1 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10">
            +{visibleNotices.length - 1} more notice
          </span>
        )}

        <button
          onClick={() => setDismissedNotices((prev) => [...prev, topNotice.id])}
          aria-label="Dismiss this system notice"
          className="p-1 rounded hover:bg-black/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
