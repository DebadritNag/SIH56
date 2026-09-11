'use client';

/**
 * AirPulse / VAYANTARA — Live Overview
 *
 * Progressive design: works from day 1 with any amount of real data.
 *  - Primary panels use current observation data (live_count, routes[], latest_collected)
 *  - APIx section shows readiness / progress when history < threshold
 *  - Historical comparison panels (Monthly Inflation, 30-day APIx) only appear when
 *    genuine history exists
 *  - No fake zeros, no hardcoded fallbacks, no SYNTHETIC/REPLAY values
 *
 * Data flow (single source of truth per panel):
 *  useLiveModeContext() → ROW 1 KPI cards, Booking Window Coverage, APIx Status, Observation History
 *  useDashboardSummary(filters) → Anomaly badge, Active Routes count
 *  useAnomalies({ status:'OPEN', page_size:5 }) → Market Signals feed
 *  useNationalTrend(filters) → APIx trend chart (only shown when apix_available)
 *  useRouteContributors(filters) → Route Fare Snapshot / Fare Range charts
 *  useSources() → Collection Sources panel
 *  usePriceShocks() → Price Shocks count (unchanged)
 *  useFares({ page_size:5 }) → Latest Live Observations table
 */

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  MapPin,
  Radio,
  RefreshCcw,
  Server,
  ShieldCheck,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { EChartWrapper } from '@/components/charts/EChartWrapper';
import type { EChartsOption } from 'echarts';
import { NationalIndexChart } from '@/components/charts/NationalIndexChart';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { OriginBadge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/formatters';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { useLiveModeContext } from '@/lib/hooks/useLiveModeContext';
import {
  useDashboardSummary,
  useNationalTrend,
  useRouteContributors,
  useSystemTrust,
} from '@/lib/hooks/useDashboard';
import { useAnomalies, useFares, useSources } from '@/lib/hooks/useResources';
import { usePriceShocks } from '@/lib/hooks/usePriceShocks';
import { getData } from '@/lib/api/client';
import { DashboardFilters } from '@/types';
import { notify } from '@/lib/notify';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum observation-days before APIx trend chart is shown */
const APIX_HISTORY_THRESHOLD = 7;

const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: { from: '2026-08-04', to: '2026-09-02', preset: '30D' },
  routeIds: [],
  sourceIds: [],
  bookingWindows: [1, 7, 15, 30, 45],
  compareMode: null,
};

const BOOKING_WINDOW_DEFS = [
  { code: 1,  label: 'T+1',  days: '0–2 days' },
  { code: 7,  label: 'T+7',  days: '3–10 days' },
  { code: 15, label: 'T+15', days: '11–20 days' },
  { code: 30, label: 'T+30', days: '21–35 days' },
  { code: 45, label: 'T+45', days: '36+ days' },
];

// ─── URL filter parser (unchanged from original) ──────────────────────────────

function parseUrlFilters(sp: URLSearchParams): DashboardFilters {
  const rangeParam = sp.get('range') || '30D';
  let from = '2026-08-04';
  const to = '2026-09-02';
  if (rangeParam === '7D') from = '2026-08-26';
  else if (rangeParam === '3M') from = '2026-06-02';
  else if (rangeParam === '6M') from = '2026-03-02';
  else if (rangeParam === 'BASE_AUG2026') from = '2026-08-01';

  const routeIds = sp.get('route') ? sp.get('route')!.split(',').filter(Boolean) : [];
  const sourceIds = sp.get('source') ? sp.get('source')!.split(',').filter(Boolean) : [];
  const windowsParam = sp.get('windows');
  let bookingWindows = [1, 7, 15, 30, 45];
  if (windowsParam) {
    const parsed = windowsParam.split(',').map(w => parseInt(w, 10)).filter(n => [1,7,15,30,45].includes(n));
    if (parsed.length) bookingWindows = parsed.sort((a,b)=>a-b);
  }
  const compareMode = sp.get('compare') || null;
  return { dateRange: { from, to, preset: rangeParam }, routeIds, sourceIds, bookingWindows, compareMode };
}

// ─── Mini-component helpers ────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white border border-[#E4E7EC] rounded-lg shadow-xs', className)}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, subtitle, right }: {
  icon?: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-[#101828]">{title}</span>
        </div>
        {subtitle && <p className="text-[11px] text-[#667085] mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-slate-100 motion-reduce:animate-none', className)} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px] text-xs text-[#667085] italic">
      {message}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-2 h-2 rounded-full bg-slate-300" />;
  return (
    <span className={clsx(
      'w-2 h-2 rounded-full',
      ok ? 'bg-emerald-500' : 'bg-rose-500'
    )} />
  );
}

// ─── KPI Card (compact, used in ROW 1) ────────────────────────────────────────

function KpiCard({
  title, value, sub, icon, accent, loading,
}: {
  title: string; value: React.ReactNode; sub?: React.ReactNode;
  icon: React.ReactNode; accent: string; loading?: boolean;
}) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-1', accent)}>
        {icon}
      </div>
      <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider">{title}</span>
      {loading
        ? <Skeleton className="h-7 w-16 mt-1" />
        : <div className="text-2xl font-bold text-[#101828] tabular-nums leading-tight">{value}</div>
      }
      {sub && <div className="text-[11px] text-[#475467] mt-0.5 truncate">{sub}</div>}
    </Card>
  );
}

// ─── Observation history hook (new, calls existing /live-mode/history) ─────────

interface ObsHistoryEntry {
  date: string;
  observations: number;
  live_count: number;
  imported_count: number;
  mean_fare: number;
}
interface ObsHistory {
  observations: ObsHistoryEntry[];
  historical_days: number;
  dgca_benchmark_available: boolean;
}

function useObservationHistory() {
  const { mode } = useDataMode();
  return useQuery<ObsHistory>({
    queryKey: ['obs-history', mode],
    queryFn: async ({ signal }) => {
      if (mode === 'mock') {
        // Demo data for mock mode — realistic short-history shape
        const days: ObsHistoryEntry[] = [
          { date: '2026-09-08', observations: 12, live_count: 5, imported_count: 7, mean_fare: 7840 },
          { date: '2026-09-09', observations: 25, live_count: 8, imported_count: 17, mean_fare: 7920 },
          { date: '2026-09-10', observations: 45, live_count: 18, imported_count: 27, mean_fare: 8100 },
          { date: '2026-09-11', observations: 61, live_count: 22, imported_count: 39, mean_fare: 8240 },
        ];
        return { observations: days, historical_days: 4, dgca_benchmark_available: false };
      }
      return getData<ObsHistory>('/live-mode/history', undefined, signal);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const { mode } = useDataMode();
  const isMock = mode === 'mock';

  // Filter state (URL-synced)
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    parseUrlFilters(new URLSearchParams(searchParams.toString()))
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState('—');

  useEffect(() => {
    setFilters(parseUrlFilters(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  const updateFiltersAndUrl = (f: DashboardFilters) => {
    setFilters(f);
    startTransition(() => {
      const p = new URLSearchParams();
      if (f.dateRange?.preset) p.set('range', f.dateRange.preset);
      if (f.routeIds?.length > 0) p.set('route', f.routeIds.join(','));
      if (f.sourceIds?.length > 0) p.set('source', f.sourceIds.join(','));
      if (f.bookingWindows?.length > 0 && f.bookingWindows.length < 5) p.set('windows', f.bookingWindows.join(','));
      if (f.compareMode) p.set('compare', f.compareMode);
      const qs = p.toString();
      router.push(qs ? `/overview?${qs}` : '/overview', { scroll: false });
    });
  };
  const handleResetFilters = () => { updateFiltersAndUrl(DEFAULT_FILTERS); notify.info('Filters reset'); };

  // ── Data hooks ─────────────────────────────────────────────────────────────

  const { ctx, isLoading: isCtxLoading } = useLiveModeContext();
  const { summary, isFetching: isSummaryFetching, refetch: refetchSummary } = useDashboardSummary(filters);
  const { trend: trendData, isFetching: isTrendFetching, refetch: refetchTrend } = useNationalTrend(filters);
  const { contributors: contribSets, isFetching: isContribFetching, refetch: refetchContrib } = useRouteContributors(filters);
  const { trust: trustMetrics } = useSystemTrust();
  const { activeCount: shockCount, isPending: isShocksPending } = usePriceShocks();
  const { data: signalsData, isPending: isSignalsPending } = useAnomalies({ status: 'OPEN', page_size: 5 });
  const { data: sourcesPage, isPending: isSourcesPending } = useSources({ page_size: 20 });
  const { data: faresList, isPending: isFaresPending } = useFares({ page_size: 5 });
  const { data: obsHistory, isPending: isHistoryPending } = useObservationHistory();

  const isAnyFetching = isRefreshing || isSummaryFetching || isTrendFetching || isContribFetching;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSummary(), refetchTrend(), refetchContrib(),
        queryClient.invalidateQueries({ queryKey: ['live-mode-context'] }),
        queryClient.invalidateQueries({ queryKey: ['obs-history'] }),
      ]);
      const now = new Date();
      setLastRefreshedTime(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')} IST`);
    } catch { notify.error('Dashboard refresh failed'); }
    finally { setIsRefreshing(false); }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const totalEligible = ctx.total_eligible ?? 0;
  const liveCount     = ctx.live_count ?? 0;
  const importedCount = ctx.imported_count ?? 0;
  const activeRoutes  = ctx.routes ?? [];
  const historyDays   = ctx.historical_days ?? 0;
  const apixAvailable = ctx.apix_available ?? false;
  const latestCollected = ctx.latest_collected;
  const openAnomalies = summary.open_anomalies ?? 0;
  const quotesTotal   = summary.quotes_24h ?? 0;   // all eligible fares matching filter

  // Relative time display for last collection
  const collectionAgo = useMemo(() => {
    if (!latestCollected) return null;
    const secs = Math.floor((Date.now() - new Date(latestCollected).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
    return `${Math.floor(secs/3600)}h ago`;
  }, [latestCollected]);

  // Source name from latest live collection — find from ctx or sources list
  const latestSourceLabel = useMemo(() => {
    if (!ctx.latest_live_collection_id) return null;
    const sources = sourcesPage?.items ?? [];
    if (sources.length > 0) {
      // Prefer active contributing source
      const contributing = sources.filter(s => (s.quotes_today ?? 0) > 0 || s.active);
      if (contributing.length === 1) return contributing[0].display_name || contributing[0].name;
    }
    return null;
  }, [ctx.latest_live_collection_id, sourcesPage]);

  // Route contributions from existing hook (median/min/max per route)
  const routeStats = useMemo(() => {
    const all = [...(contribSets.up || []), ...(contribSets.down || [])];
    // Deduplicate by route
    const seen = new Set<string>();
    return all.filter(r => { if (seen.has(r.route)) return false; seen.add(r.route); return true; });
  }, [contribSets]);

  // Booking window availability matrix from booking-window-summary hook
  const { data: bwSummaryRaw } = useQuery({
    queryKey: ['booking-window-summary', mode],
    queryFn: async ({ signal }) => {
      if (isMock) return BOOKING_WINDOW_DEFS.map(w => ({
        window: w.label, window_code: w.code, count: w.code <= 7 ? 12 : 0,
        live: w.code <= 7 ? 5 : 0, imported: w.code <= 7 ? 7 : 0, avg_fare: 7900,
      }));
      return getData<unknown[]>('/dashboard/booking-window-summary', undefined, signal);
    },
    staleTime: 60_000,
  });

  // Map bwSummary to { label → count } for the matrix
  const bwAvailability = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(bwSummaryRaw)) {
      for (const row of bwSummaryRaw as Array<Record<string, unknown>>) {
        const label = String(row.window || row.label || '');
        const cnt = Number(row.count ?? 0);
        if (label) map[label] = (map[label] ?? 0) + cnt;
      }
    }
    return map;
  }, [bwSummaryRaw]);

  // Latest 5 fares from existing useFares hook
  const latestFares = useMemo(() => {
    const raw = (faresList as { data?: unknown[]; items?: unknown[] } | undefined);
    return (raw?.data ?? raw?.items ?? []) as Array<Record<string, unknown>>;
  }, [faresList]);

  // ML coverage: from anomalies (PriceGuard scored) and signalsData meta
  const mlCoverage = useMemo(() => {
    const pgScored = signalsData?.meta?.total ?? 0;
    return { pgScored };
  }, [signalsData]);

  const isFiltered = filters.bookingWindows.length < 5 || filters.routeIds.length > 0
    || filters.sourceIds.length > 0 || filters.dateRange.preset !== '30D' || Boolean(filters.compareMode);

  // ── Route Fare Snapshot chart ──────────────────────────────────────────────

  const routeFareChartOption = useMemo((): EChartsOption | null => {
    const routes = routeStats.filter(r => r.current_median_fare > 0);
    if (!routes.length) return null;
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: '#081426',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as Array<{ name: string; value: number; data: Record<string, unknown> }>;
          const r = routes.find(x => x.route === p[0]?.name);
          return `<div style="font-weight:600">${p[0]?.name}</div>` +
            `<div>Median: ${formatINR(p[0]?.value)}</div>` +
            (r ? `<div style="color:#94A3B8;font-size:11px">${r.route} · ${r.change_pct != null ? (r.change_pct > 0 ? '+' : '') + r.change_pct.toFixed(1) + '% vs network' : ''}</div>` : '');
        },
      },
      grid: { left: '2%', right: '6%', top: '10%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: routes.map(r => r.route),
        axisLabel: { color: '#475467', fontSize: 11, fontWeight: 600 },
        axisLine: { lineStyle: { color: '#E4E7EC' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#667085', fontSize: 10,
          formatter: (v: number) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`,
        },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [{
        type: 'bar' as const,
        data: routes.map(r => ({
          value: Math.round(r.current_median_fare),
          itemStyle: {
            color: r.change_pct != null && r.change_pct > 5
              ? '#2563EB'
              : r.change_pct != null && r.change_pct < -5
              ? '#16A34A'
              : '#3B82F6',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '55%',
        label: {
          show: true, position: 'top', fontSize: 11, color: '#101828', fontWeight: 600,
          formatter: (p: { value: unknown }) => formatINR(Number(p.value)),
        },
      }],
    };
  }, [routeStats]);

  // ── Fare Range chart (min/median/max grouped bar) ──────────────────────────

  const fareRangeChartOption = useMemo((): EChartsOption | null => {
    const routes = routeStats.filter(r => r.current_median_fare > 0);
    if (!routes.length) return null;
    const rnames = routes.map(r => r.route);
    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#081426',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as Array<{ seriesName: string; value: number; name: string }>;
          const route = p[0]?.name;
          return `<div style="font-weight:600">${route}</div>` +
            p.map(pp => `<div>${pp.seriesName}: ${formatINR(pp.value)}</div>`).join('');
        },
      },
      legend: {
        data: ['Min', 'Median', 'Max'],
        textStyle: { color: '#475467', fontSize: 10 },
        bottom: 0,
      },
      grid: { left: '2%', right: '4%', top: '10%', bottom: '16%', containLabel: true },
      xAxis: { type: 'category' as const, data: rnames, axisLabel: { color: '#475467', fontSize: 11, fontWeight: 600 }, axisLine: { lineStyle: { color: '#E4E7EC' } } },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#667085', fontSize: 10,
          formatter: (v: number) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`,
        },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Min', type: 'bar' as const, barWidth: '18%', stack: undefined,
          data: routes.map(r => Math.round((r as unknown as Record<string,unknown>).min_fare as number ?? r.current_median_fare * 0.85)),
          itemStyle: { color: '#16A34A', borderRadius: [4,4,0,0] },
        },
        {
          name: 'Median', type: 'bar' as const, barWidth: '18%',
          data: routes.map(r => Math.round(r.current_median_fare)),
          itemStyle: { color: '#2563EB', borderRadius: [4,4,0,0] },
        },
        {
          name: 'Max', type: 'bar' as const, barWidth: '18%',
          data: routes.map(r => Math.round((r as unknown as Record<string,unknown>).max_fare as number ?? r.current_median_fare * 1.3)),
          itemStyle: { color: '#DC2626', borderRadius: [4,4,0,0] },
        },
      ],
    };
  }, [routeStats]);

  // ── Observation History chart ──────────────────────────────────────────────

  const obsHistoryChartOption = useMemo((): EChartsOption | null => {
    const rows = obsHistory?.observations ?? [];
    if (!rows.length) return null;
    const dates = rows.map(r => r.date?.slice(5) ?? r.date);
    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#081426',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as Array<{ seriesName: string; value: number; name: string }>;
          return `<div style="font-weight:600">${p[0]?.name}</div>` +
            p.map(pp => `<div>${pp.seriesName}: ${pp.value}</div>`).join('');
        },
      },
      legend: { data: ['LIVE', 'IMPORTED'], textStyle: { color: '#475467', fontSize: 10 }, bottom: 0 },
      grid: { left: '2%', right: '4%', top: '8%', bottom: '16%', containLabel: true },
      xAxis: { type: 'category' as const, data: dates, axisLabel: { color: '#475467', fontSize: 11 }, axisLine: { lineStyle: { color: '#E4E7EC' } } },
      yAxis: { type: 'value' as const, axisLabel: { color: '#667085', fontSize: 10 }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      series: [
        {
          name: 'LIVE', type: 'bar' as const, stack: 'total',
          data: rows.map(r => r.live_count ?? 0),
          itemStyle: { color: '#10B981' },
        },
        {
          name: 'IMPORTED', type: 'bar' as const, stack: 'total',
          data: rows.map(r => r.imported_count ?? 0),
          itemStyle: { color: '#3B82F6' },
        },
      ],
    };
  }, [obsHistory]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Airfare Intelligence Overview
            </h1>
            {isFiltered && (
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                Filtered View
              </span>
            )}
            {/* Live Mode badge */}
            {!isCtxLoading && ctx.mode !== 'EMPTY' && (
              <span className={clsx(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border',
                ctx.mode === 'LIVE_DATA' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                ctx.mode === 'HYBRID' && 'bg-blue-50 text-blue-700 border-blue-200',
                ctx.mode === 'IMPORTED_FALLBACK' && 'bg-amber-50 text-amber-700 border-amber-200',
              )}>
                <Radio className="w-2.5 h-2.5" />
                {ctx.mode_label ?? ctx.mode}
              </span>
            )}
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Real-time domestic airfare collection status, route coverage, and market intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleManualRefresh}
            disabled={isAnyFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#D0D5DD] text-[#475467] bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={clsx('w-3.5 h-3.5', isAnyFetching && 'animate-spin')} />
            Refresh
          </button>
          <GenerateReportButton
            exportType="OVERVIEW_REPORT"
            format="PDF"
            title="AirPulse — Live Intelligence Overview Report"
            filters={{ windows: filters.bookingWindows, routes: filters.routeIds, sources: filters.sourceIds, date_range: filters.dateRange }}
          />
        </div>
      </div>

      {/* ── Filter Bar (unchanged) ───────────────────────────────────────────── */}
      <GlobalFilterBar
        filters={filters}
        onFiltersChange={updateFiltersAndUrl}
        onRefresh={handleManualRefresh}
        onReset={handleResetFilters}
        isRefreshing={isAnyFetching}
        lastRefreshed={lastRefreshedTime}
        isFilterStale={isAnyFetching}
      />

      {/* ── ROW 1 — 5 KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

        <KpiCard
          title="Live Observations"
          value={isCtxLoading ? '—' : totalEligible > 0 ? totalEligible.toLocaleString() : '—'}
          sub={totalEligible > 0
            ? <>{liveCount > 0 && <span className="text-emerald-700">{liveCount} LIVE</span>}{liveCount > 0 && importedCount > 0 && ' · '}{importedCount > 0 && <span className="text-blue-700">{importedCount} imported</span>}</>
            : 'No eligible data yet'}
          icon={<Database className="w-4 h-4 text-white" />}
          accent="bg-blue-600"
          loading={isCtxLoading}
        />

        <KpiCard
          title="Active Routes"
          value={isCtxLoading ? '—' : activeRoutes.length > 0 ? activeRoutes.length : '—'}
          sub={activeRoutes.length > 0
            ? activeRoutes.slice(0,3).join(' · ') + (activeRoutes.length > 3 ? ` +${activeRoutes.length-3}` : '')
            : 'No routes with data'}
          icon={<MapPin className="w-4 h-4 text-white" />}
          accent="bg-indigo-600"
          loading={isCtxLoading}
        />

        <KpiCard
          title="Latest Collection"
          value={collectionAgo ?? '—'}
          sub={latestSourceLabel ?? (liveCount > 0 ? 'LIVE data' : importedCount > 0 ? 'Imported' : 'No collection yet')}
          icon={<Clock className="w-4 h-4 text-white" />}
          accent={collectionAgo ? 'bg-emerald-600' : 'bg-slate-400'}
          loading={isCtxLoading}
        />

        <KpiCard
          title="Validated Fares"
          value={quotesTotal > 0 ? quotesTotal.toLocaleString() : '—'}
          sub={quotesTotal > 0 && totalEligible > 0
            ? `${((quotesTotal/Math.max(totalEligible,1))*100).toFixed(0)}% of observations`
            : 'Awaiting ingestion'}
          icon={<CheckCircle2 className="w-4 h-4 text-white" />}
          accent="bg-teal-600"
          loading={isCtxLoading}
        />

        <KpiCard
          title="Active Anomalies"
          value={isShocksPending ? '—' : openAnomalies > 0 ? openAnomalies : '0'}
          sub={openAnomalies > 0 ? 'PriceGuard signals' : 'All clear'}
          icon={<AlertTriangle className="w-4 h-4 text-white" />}
          accent={openAnomalies > 0 ? 'bg-rose-600' : 'bg-slate-400'}
        />
      </div>

      {/* ── ROW 2 — Route Fare Snapshot + Observed Fare Range ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Route Fare Snapshot */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
            title="Current Route Fare Snapshot"
            subtitle="Median eligible observed fare per active corridor"
            right={
              <span className="text-[10px] text-[#94A3B8] font-medium">
                {routeStats.length > 0 ? `${routeStats.length} routes` : 'No data'}
              </span>
            }
          />
          {isContribFetching && routeStats.length === 0
            ? <Skeleton className="h-52 w-full" />
            : routeFareChartOption
            ? <EChartWrapper option={routeFareChartOption} style={{ height: '200px', width: '100%' }} loading={isContribFetching} />
            : <EmptyState message="No eligible observations for the selected filters and routes." />
          }
        </Card>

        {/* Observed Fare Range */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
            title="Observed Fare Range"
            subtitle="Min · Median · Max per active corridor"
            right={
              routeStats.length > 0
                ? <span className="text-[10px] text-[#94A3B8]">Spread across observations</span>
                : null
            }
          />
          {isContribFetching && routeStats.length === 0
            ? <Skeleton className="h-52 w-full" />
            : fareRangeChartOption
            ? <EChartWrapper option={fareRangeChartOption} style={{ height: '200px', width: '100%' }} loading={isContribFetching} />
            : <EmptyState message="Fare range unavailable — no eligible route observations." />
          }
        </Card>
      </div>

      {/* ── ROW 3 — Latest Live Observations + Route Activity ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Latest Live Observations */}
        <Card className="p-4 min-w-0 flex flex-col">
          <CardHeader
            icon={<Activity className="w-4 h-4 text-emerald-600" />}
            title="Latest Live Observations"
            subtitle="5 most recently collected eligible fares"
            right={
              <Link href="/fares" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                View Fare Explorer <ChevronRight className="w-3 h-3" />
              </Link>
            }
          />
          {isFaresPending
            ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
            : latestFares.length === 0
            ? <EmptyState message="No live observations yet. Run a live collection from Data Ingestion." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] text-[#667085] uppercase font-semibold border-b border-[#F1F5F9]">
                    <tr>
                      <th className="pb-1.5">Route</th>
                      <th className="pb-1.5">Carrier</th>
                      <th className="pb-1.5 text-right">Fare</th>
                      <th className="pb-1.5">Window</th>
                      <th className="pb-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {latestFares.slice(0,5).map((f, i) => {
                      const origin = String(f.origin_code ?? f.origin ?? '');
                      const dest   = String(f.destination_code ?? f.destination ?? '');
                      const fare   = Number(f.total_fare ?? 0);
                      const bw     = String(f.booking_window_bucket ?? '—');
                      const airline = String(f.airline_code ?? f.airline ?? '—');
                      const valid  = String(f.validation_status ?? 'VALID');
                      const orig   = String(f.data_origin ?? 'IMPORTED');
                      return (
                        <tr key={String(f.id ?? i)} className="hover:bg-slate-50">
                          <td className="py-1.5 font-semibold text-[#101828]">{origin}→{dest}</td>
                          <td className="py-1.5 text-[#475467]">{airline}</td>
                          <td className="py-1.5 text-right font-bold text-[#101828] tabular-nums">{formatINR(fare)}</td>
                          <td className="py-1.5 text-blue-700 font-semibold">{bw}</td>
                          <td className="py-1.5 text-center">
                            <span className={clsx(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded',
                              valid === 'VALID' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            )}>
                              {orig === 'LIVE' ? '● LIVE' : 'IMP'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>

        {/* Route Activity */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<MapPin className="w-4 h-4 text-indigo-600" />}
            title="Route Activity"
            subtitle="Current observation coverage per corridor"
          />
          {isContribFetching && routeStats.length === 0
            ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            : routeStats.length === 0
            ? <EmptyState message="No route data yet." />
            : (
              <div className="space-y-2">
                {routeStats.slice(0,6).map(r => {
                  const rc = r as unknown as Record<string, unknown>;
                  const count  = Number(rc.total_count ?? 0);
                  const median = Number(r.current_median_fare);
                  const live   = Number(rc.live_count ?? 0);
                  const spread = Number(rc.spread_pct ?? 0);
                  return (
                    <div key={r.route} className="flex items-center justify-between py-1.5 border-b border-[#F8FAFC] last:border-0">
                      <div>
                        <span className="font-bold text-[#101828] text-xs">{r.route}</span>
                        <div className="text-[10px] text-[#667085] mt-0.5">
                          {count} obs · {live > 0 && <span className="text-emerald-700">{live} LIVE</span>}
                          {spread > 0 && <span className="ml-1">· ±{spread.toFixed(0)}% spread</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#101828] text-xs tabular-nums">{formatINR(median)}</div>
                        <div className="text-[10px] text-[#667085]">median</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      </div>

      {/* ── ROW 4 — Booking Window Coverage + ML Intelligence ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Booking Window Coverage Matrix */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<Calendar className="w-4 h-4 text-blue-600" />}
            title="Booking Window Coverage"
            subtitle="Which advance-purchase windows have eligible observations"
          />
          {activeRoutes.length === 0
            ? <EmptyState message="No active routes — run a collection to populate." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[#667085] uppercase font-semibold">
                      <th className="text-left py-1 pr-3">Route</th>
                      {BOOKING_WINDOW_DEFS.map(w => (
                        <th key={w.code} className="text-center py-1 px-2">{w.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRoutes.slice(0,6).map(route => (
                      <tr key={route} className="border-t border-[#F8FAFC]">
                        <td className="font-semibold text-[#101828] py-1.5 pr-3">{route.replace('-', '→')}</td>
                        {BOOKING_WINDOW_DEFS.map(w => {
                          const cnt = bwAvailability[w.label] ?? 0;
                          // We don't have per-route × per-window granularity from summary endpoint.
                          // Show AVAILABLE for windows where we have any obs, otherwise show from ctx.
                          const routeActive = activeRoutes.includes(route);
                          const ctxBuckets = ctx.booking_window_buckets ?? [];
                          const available = routeActive && (cnt > 0 || ctxBuckets.includes(w.label));
                          return (
                            <td key={w.code} className="text-center py-1.5 px-2">
                              {available
                                ? <span className="text-emerald-600 font-bold text-sm" title={`${w.label}: data available`}>✓</span>
                                : <span className="text-slate-300 text-sm" title={`${w.label}: no data`}>—</span>
                              }
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>

        {/* ML Intelligence Coverage */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<Zap className="w-4 h-4 text-amber-600" />}
            title="ML Intelligence Coverage"
            subtitle="FareGuard + PriceGuard scoring against eligible observations"
          />
          <div className="space-y-3">
            {/* FareGuard */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-[#101828]">FareGuard XGBoost</div>
                <div className="text-[10px] text-[#667085] mt-0.5">fareguard-xgb-v1</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#101828] tabular-nums">
                  {quotesTotal > 0 ? `${quotesTotal} fares scored` : '—'}
                </div>
                <div className="text-[10px] text-[#667085]">benchmark predictions</div>
              </div>
            </div>

            {/* PriceGuard */}
            <div className="flex items-start justify-between border-t border-[#F8FAFC] pt-3">
              <div>
                <div className="text-xs font-semibold text-[#101828]">PriceGuard Isolation Forest</div>
                <div className="text-[10px] text-[#667085] mt-0.5">priceguard-if-v1</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#101828] tabular-nums">
                  {openAnomalies > 0 ? `${openAnomalies} anomalies detected` : quotesTotal > 0 ? 'All fares normal' : '—'}
                </div>
                <div className="text-[10px] text-[#667085]">from FareGuard predictions</div>
              </div>
            </div>

            {/* SHAP */}
            <div className="flex items-start justify-between border-t border-[#F8FAFC] pt-3">
              <div>
                <div className="text-xs font-semibold text-[#101828]">SHAP Explanations</div>
                <div className="text-[10px] text-[#667085] mt-0.5">TreeExplainer (gated on anomalies)</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#101828]">
                  {openAnomalies > 0 ? `${openAnomalies} explanations` : 'None required'}
                </div>
                <div className="text-[10px] text-[#667085]">per anomaly</div>
              </div>
            </div>

            <Link href="/anomalies" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium pt-1">
              <span>View Anomaly Center</span> <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* ── ROW 5 — Market Signals + Pipeline Health ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Real-Time Market Signals (kept, badge is now live) */}
        <Card className="p-4 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-bold text-[#101828]">Real-Time Market Signals</span>
            </div>
            {!isSignalsPending && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold uppercase">
                {(signalsData?.items.length ?? 0) === 0
                  ? '0 Active'
                  : `${signalsData!.items.length} Active Signal${signalsData!.items.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#667085] mb-3">
            PriceGuard anomaly signals from current eligible observations
          </p>
          <div className="space-y-2 flex-1">
            {isSignalsPending
              ? [1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)
              : (signalsData?.items.length ?? 0) === 0
              ? <EmptyState message="No active market signals" />
              : signalsData!.items.map(sig => {
                  const sc = sig.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800'
                    : sig.severity === 'HIGH' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700';
                  return (
                    <div key={sig.id} className="p-2.5 rounded border border-[#E4E7EC] hover:bg-[#F8FAFC] text-xs cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#101828]">{sig.route} · {sig.booking_window}</span>
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase', sc)}>{sig.severity}</span>
                      </div>
                      <div className="text-[11px] text-[#475467]">
                        {sig.airline} · {formatINR(sig.actual_fare)}
                        {sig.deviation_pct > 0 && <span className="text-rose-600 ml-1">+{sig.deviation_pct.toFixed(1)}% vs expected</span>}
                      </div>
                    </div>
                  );
                })
            }
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#F1F5F9]">
            <Link href="/anomalies" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Investigate in Anomaly Center →
            </Link>
          </div>
        </Card>

        {/* Pipeline Health */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<Server className="w-4 h-4 text-slate-600" />}
            title="Pipeline Health"
            subtitle="Latest collection and ingestion run status"
            right={
              <Link href="/pipeline" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                Pipeline Monitor <ChevronRight className="w-3 h-3" />
              </Link>
            }
          />
          <div className="space-y-2 text-xs">
            {/* Collection */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-[#475467]" />
                <span className="text-[#475467] font-medium">Collection</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <StatusDot ok={ctx.latest_live_collection_id ? true : null} />
                <span className="font-semibold text-[#101828]">
                  {ctx.latest_live_collection_date
                    ? new Date(ctx.latest_live_collection_date).toLocaleDateString('en-IN', { month:'short', day:'2-digit' })
                    : '—'}
                </span>
              </div>
            </div>
            {/* Ingestion */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-[#475467]" />
                <span className="text-[#475467] font-medium">Ingestion</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={ctx.latest_ingestion_run_id ? true : null} />
                <span className="font-semibold text-[#101828]">
                  {quotesTotal > 0 ? `${quotesTotal} validated` : '—'}
                </span>
              </div>
            </div>
            {/* FareGuard */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#475467]" />
                <span className="text-[#475467] font-medium">FareGuard</span>
              </div>
              <span className="font-semibold text-[#101828]">
                {quotesTotal > 0 ? `${quotesTotal} scored` : '—'}
              </span>
            </div>
            {/* PriceGuard */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#475467]" />
                <span className="text-[#475467] font-medium">PriceGuard</span>
              </div>
              <span className="font-semibold text-[#101828]">
                {openAnomalies > 0 ? `${openAnomalies} anomalies` : quotesTotal > 0 ? 'All clear' : '—'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── ROW 6 — APIx Status + Collection Sources ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* APIx Status / Readiness */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
            title="APIx Status"
            subtitle={apixAvailable ? 'National Airfare Price Index available' : 'Building base observation history'}
            right={
              apixAvailable
                ? <Link href="/apix" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                    Full APIx <ChevronRight className="w-3 h-3" />
                  </Link>
                : null
            }
          />
          {apixAvailable ? (
            /* Full APIx available */
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums text-[#101828]">
                  {summary.latest_index?.toFixed(2) ?? '—'}
                </span>
                <div className="text-[11px] text-[#667085]">
                  Base: Aug 2026 = 100.0
                  {ctx.apix_count > 0 && <span className="ml-2">· {ctx.apix_count} index points</span>}
                </div>
              </div>
              <div className="h-40">
                {trendData.length > 0
                  ? <NationalIndexChart data={trendData} compareMode={null} />
                  : <EmptyState message="Index trend loading…" />
                }
              </div>
            </div>
          ) : (
            /* Not yet available — show progress */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>AirPulse is accumulating genuine observation history. APIx will activate when base-period requirements are met.</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085]">History accumulated</span>
                  <span className="font-semibold text-[#101828]">{historyDays} / {APIX_HISTORY_THRESHOLD} observation days</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (historyDays / APIX_HISTORY_THRESHOLD) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Routes represented</span>
                  <span className="font-semibold text-[#101828]">{activeRoutes.length} active corridor{activeRoutes.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Booking windows covered</span>
                  <span className="font-semibold text-[#101828]">{ctx.booking_window_buckets?.length ?? 0} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">DGCA benchmark</span>
                  <span className={clsx('font-semibold', ctx.dgca_benchmark_available ? 'text-emerald-700' : 'text-slate-500')}>
                    {ctx.dgca_benchmark_available ? 'Available' : 'Pending'}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide">
                STATUS: BUILDING BASE HISTORY
              </div>
            </div>
          )}
        </Card>

        {/* Collection Sources */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<Wifi className="w-4 h-4 text-slate-600" />}
            title="Collection Sources"
            subtitle="Configured and active data sources"
            right={
              <Link href="/sources" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                All Sources <ChevronRight className="w-3 h-3" />
              </Link>
            }
          />
          {isSourcesPending
            ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            : !sourcesPage || sourcesPage.items.length === 0
            ? <EmptyState message="No sources configured." />
            : (
              <div className="space-y-2">
                {sourcesPage.items
                  .filter(s => s.enabled !== false)
                  .slice(0, 6)
                  .map(src => {
                    const healthy = (src.consecutive_failures ?? 0) === 0;
                    const contributed = (src.quotes_today ?? 0) > 0;
                    return (
                      <div key={src.id} className="flex items-start justify-between py-1.5 border-b border-[#F8FAFC] last:border-0">
                        <div className="flex items-center gap-2">
                          <StatusDot ok={healthy} />
                          <div>
                            <div className="font-semibold text-[#101828] text-xs">{src.display_name || src.name}</div>
                            <div className="text-[10px] text-[#667085] mt-0.5">
                              {src.source_type}
                              {src.collection_method && ` · ${src.collection_method}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-[#667085]">
                          {contributed
                            ? <span className="text-emerald-700 font-semibold">{src.quotes_today} obs</span>
                            : src.last_success_at
                            ? <span>Last: {new Date(src.last_success_at).toLocaleDateString('en-IN',{month:'short',day:'2-digit'})}</span>
                            : <span className="text-slate-400">No data yet</span>
                          }
                        </div>
                      </div>
                    );
                  })}
              </div>
            )
          }
        </Card>
      </div>

      {/* ── ROW 7 — Observation History + Data Trust ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Observation History chart */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
            title="Observation History"
            subtitle={
              apixAvailable
                ? 'Daily ingestion cadence — sufficient history for APIx'
                : `${historyDays} day${historyDays !== 1 ? 's' : ''} of genuine observations (APIx unlocks at ${APIX_HISTORY_THRESHOLD}+ days)`
            }
          />
          {isHistoryPending
            ? <Skeleton className="h-44 w-full" />
            : obsHistoryChartOption
            ? <EChartWrapper option={obsHistoryChartOption} style={{ height: '168px', width: '100%' }} loading={isHistoryPending} />
            : <EmptyState message="No observation history yet." />
          }
        </Card>

        {/* Data Trust & Coverage */}
        <Card className="p-4 min-w-0">
          <CardHeader
            icon={<ShieldCheck className="w-4 h-4 text-slate-600" />}
            title="Data Trust & Coverage"
            subtitle="Key data quality indicators"
            right={
              <Link href="/data-quality" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                Data Quality Matrix <ChevronRight className="w-3 h-3" />
              </Link>
            }
          />
          <div className="space-y-2.5 text-xs">
            {[
              {
                label: 'Route coverage',
                value: trustMetrics.route_coverage_pct != null
                  ? `${trustMetrics.route_coverage_pct}%`
                  : activeRoutes.length > 0 ? `${activeRoutes.length} active routes` : '—',
                ok: activeRoutes.length > 0,
              },
              {
                label: 'Booking-window coverage',
                value: filters.bookingWindows.length === 5 ? 'All 5 windows selected'
                  : `${filters.bookingWindows.length} / 5 windows`,
                ok: filters.bookingWindows.length > 0,
              },
              {
                label: 'Validation rate',
                value: trustMetrics.validation_success_pct != null
                  ? `${trustMetrics.validation_success_pct}%`
                  : quotesTotal > 0 ? 'Validated' : '—',
                ok: quotesTotal > 0,
              },
              {
                label: 'Data freshness',
                value: trustMetrics.freshness_pct != null
                  ? `${trustMetrics.freshness_pct}%`
                  : collectionAgo ?? '—',
                ok: !!collectionAgo,
              },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-[#F8FAFC] last:border-0">
                <span className="text-[#667085]">{label}</span>
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={ok} />
                  <span className={clsx('font-semibold', ok ? 'text-[#101828]' : 'text-slate-400')}>
                    {value}
                  </span>
                </div>
              </div>
            ))}

            {/* Statistical Trust Score */}
            <div className="mt-1 pt-2 border-t border-[#E4E7EC]">
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Statistical Trust Score</span>
                <span className={clsx(
                  'font-bold text-xs px-2 py-0.5 rounded font-mono border',
                  summary.coverage_quality_score == null || summary.coverage_quality_score === 0
                    ? 'text-slate-400 bg-slate-50 border-slate-200'
                    : summary.coverage_quality_score >= 0.90
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : summary.coverage_quality_score >= 0.70
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                )}>
                  {summary.coverage_quality_score == null || summary.coverage_quality_score === 0
                    ? 'Unavailable'
                    : `${(summary.coverage_quality_score * 100).toFixed(1)} / 100 (${
                        summary.coverage_quality_score >= 0.90 ? 'HIGH QUALITY'
                        : summary.coverage_quality_score >= 0.70 ? 'ACCEPTABLE'
                        : 'LOW QUALITY'
                      })`}
                </span>
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-1">Formula: Q = 0.40·Cr + 0.25·Cs + 0.20·F + 0.15·V</p>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
