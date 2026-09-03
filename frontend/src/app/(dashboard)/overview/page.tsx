'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { PrimaryIndexCard } from '@/components/ui/PrimaryIndexCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { NationalIndexChart } from '@/components/charts/NationalIndexChart';
import { WaterfallContributionChart } from '@/components/charts/WaterfallContributionChart';
import { RoutePressureHeatmap } from '@/components/charts/RoutePressureHeatmap';
import { mockMarketSignals } from '@/lib/mock-data/dashboard';
import {
  useDashboardSummary,
  useNationalTrend,
  useRouteContributors,
  useSystemTrust,
} from '@/lib/hooks/useDashboard';
import { DataSourceMeta } from '@/components/data/DataBadge';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { formatPercent, formatINR } from '@/lib/formatters';
import { DashboardFilters } from '@/types';
import { notify } from '@/lib/notify';

const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: {
    from: '2026-08-04',
    to: '2026-09-02',
    preset: '30D',
  },
  routeIds: [],
  sourceIds: [],
  bookingWindows: [1, 7, 15, 30, 45],
  compareMode: null,
};

function parseUrlFilters(searchParams: URLSearchParams): DashboardFilters {
  const rangeParam = searchParams.get('range') || '30D';
  let from = '2026-08-04';
  const to = '2026-09-02';

  if (rangeParam === '7D') from = '2026-08-26';
  else if (rangeParam === '30D') from = '2026-08-04';
  else if (rangeParam === '3M') from = '2026-06-02';
  else if (rangeParam === '6M') from = '2026-03-02';
  else if (rangeParam === 'BASE_AUG2026') from = '2026-08-01';

  const routeParam = searchParams.get('route');
  const routeIds = routeParam && routeParam !== 'ALL' ? routeParam.split(',') : [];

  const sourceParam = searchParams.get('source');
  const sourceIds = sourceParam && sourceParam !== 'ALL' ? sourceParam.split(',') : [];

  const windowsParam = searchParams.get('windows');
  let bookingWindows = [1, 7, 15, 30, 45];
  if (windowsParam) {
    const parsed = windowsParam
      .split(',')
      .map((w) => parseInt(w.trim(), 10))
      .filter((n) => [1, 7, 15, 30, 45].includes(n));
    if (parsed.length > 0) {
      bookingWindows = parsed.sort((a, b) => a - b);
    }
  }

  const compareParam = searchParams.get('compare');
  const compareMode = compareParam && compareParam !== 'none' ? compareParam : null;

  return {
    dateRange: { from, to, preset: rangeParam },
    routeIds,
    sourceIds,
    bookingWindows,
    compareMode,
  };
}

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isPendingTransition, startTransition] = useTransition();

  // 1. Canonical dashboard filter state (hydrated from URL)
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    parseUrlFilters(new URLSearchParams(searchParams.toString()))
  );

  const [contributorDirection, setContributorDirection] = useState<'up' | 'down'>('up');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState('17:52 IST');

  // Keep state synchronized with URL back/forward navigation
  useEffect(() => {
    const parsed = parseUrlFilters(new URLSearchParams(searchParams.toString()));
    setFilters(parsed);
  }, [searchParams]);

  // Push filter changes to URL search params
  const updateFiltersAndUrl = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
    startTransition(() => {
      const p = new URLSearchParams();
      if (newFilters.dateRange?.preset) p.set('range', newFilters.dateRange.preset);
      if (newFilters.routeIds?.length > 0) p.set('route', newFilters.routeIds.join(','));
      if (newFilters.sourceIds?.length > 0) p.set('source', newFilters.sourceIds.join(','));
      if (newFilters.bookingWindows?.length > 0 && newFilters.bookingWindows.length < 5) {
        p.set('windows', newFilters.bookingWindows.join(','));
      }
      if (newFilters.compareMode) p.set('compare', newFilters.compareMode);

      const qs = p.toString();
      router.push(qs ? `/overview?${qs}` : '/overview', { scroll: false });
    });
  };

  // Reset handler
  const handleResetFilters = () => {
    updateFiltersAndUrl(DEFAULT_FILTERS);
    notify.info('Filters reset to default scope');
  };

  // 2. Real data from FastAPI with stable serialized query keys
  const {
    summary: dashboardSummary,
    meta,
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
  } = useDashboardSummary(filters);

  const {
    trend: trendData,
    isFetching: isTrendFetching,
    refetch: refetchTrend,
  } = useNationalTrend(filters);

  const {
    contributors: contributorSets,
    isFetching: isContribFetching,
    refetch: refetchContrib,
  } = useRouteContributors(filters);

  const { trust: trustMetrics } = useSystemTrust();

  // Refresh handler (refetches without resetting filters)
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchSummary(),
        refetchTrend(),
        refetchContrib(),
        queryClient.invalidateQueries({ queryKey: ['booking-window-summary'] }),
      ]);
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')} IST`;
      setLastRefreshedTime(timeStr);
    } catch {
      notify.error('Dashboard refresh failed', {
        description: 'Showing previous data. Please retry.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyFetching =
    isRefreshing || isSummaryFetching || isTrendFetching || isContribFetching || isPendingTransition;

  const contributors =
    contributorDirection === 'up' ? contributorSets.up : contributorSets.down;

  // Active filter chip count or scope description
  const isFiltered =
    filters.bookingWindows.length < 5 ||
    filters.routeIds.length > 0 ||
    filters.sourceIds.length > 0 ||
    filters.dateRange.preset !== '30D' ||
    Boolean(filters.compareMode);

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Airfare Intelligence Overview
            </h1>
            {isFiltered && (
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                Filtered Analytical View
              </span>
            )}
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Real-time domestic airfare inflation, index velocity, and market pressure across India&apos;s monitored aviation network.
          </p>
          <DataSourceMeta
            className="mt-1.5"
            isMock={meta.isMock}
            source={meta.source}
            lastUpdated={meta.lastUpdated}
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <GenerateReportButton
            exportType="OVERVIEW_REPORT"
            format="PDF"
            title="AirPulse — Airfare Intelligence Overview Report"
            filters={{
              windows: filters.bookingWindows,
              routes: filters.routeIds,
              sources: filters.sourceIds,
              date_range: filters.dateRange,
            }}
          />
          <span className="px-2.5 py-1 bg-slate-100 text-[#475467] font-medium rounded border border-slate-200">
            Base Period: Aug 2026 = 100.0
          </span>
        </div>
      </div>

      {/* Global Filter Bar */}
      <GlobalFilterBar
        filters={filters}
        onFiltersChange={updateFiltersAndUrl}
        onRefresh={handleManualRefresh}
        onReset={handleResetFilters}
        isRefreshing={isRefreshing || isAnyFetching}
        lastRefreshed={lastRefreshedTime}
        isFilterStale={isAnyFetching}
      />

      {/* ROW 1: HERO INDEX STRIP (Dominant 40% APIx Card + 3 Intelligence KPI Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dominant National APIx Card (approx 40% width / 5 cols) */}
        <div className="lg:col-span-5 min-w-0">
          <PrimaryIndexCard
            indexValue={dashboardSummary.latest_index}
            dailyChange={dashboardSummary.daily_change_pct}
            monthlyChange={dashboardSummary.monthly_change_pct}
            pressure={dashboardSummary.market_pressure}
            confidenceScore={dashboardSummary.coverage_quality_score}
            className="h-full"
            basePeriod={
              isFiltered
                ? `Filtered APIx (${filters.bookingWindows.length}/5 windows)`
                : 'Base: Aug 2026 = 100.00'
            }
          />
        </div>

        {/* 3 Smaller Intelligence Cards (approx 60% width / 7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5 min-w-0">
          <MetricCard
            title="Monthly Airfare Inflation"
            value={formatPercent(dashboardSummary.monthly_change_pct, { includeSign: true })}
            subtitle="vs Previous 30-Day Index"
            change={{
              value: `${dashboardSummary.daily_change_pct > 0 ? '↑' : '↓'} ${Math.abs(
                dashboardSummary.daily_change_pct
              ).toFixed(2)} pp`,
              type: dashboardSummary.daily_change_pct > 0 ? 'positive' : 'negative',
              label: 'momentum',
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Daily Shift:</span>
                <span className="font-semibold text-emerald-700">
                  {dashboardSummary.daily_change_pct > 0 ? '+' : ''}
                  {dashboardSummary.daily_change_pct}%
                </span>
              </div>
            }
          />

          <MetricCard
            title="Market Pressure"
            value={dashboardSummary.market_pressure}
            subtitle={`${dashboardSummary.rapid_routes_count} routes under surge`}
            badge={<span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            change={{
              value: `${dashboardSummary.healthy_sources} sources active`,
              type: 'neutral',
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Price Shocks:</span>
                <span className="font-bold text-rose-600">
                  {filters.routeIds.includes('BOM-GOI') ? '0 Active' : '1 Active (BLR-DEL)'}
                </span>
              </div>
            }
          />

          <MetricCard
            title="Data Confidence"
            value={`${(dashboardSummary.coverage_quality_score * 100).toFixed(1)}%`}
            subtitle="Statistical Trust Score"
            change={{
              value: `${dashboardSummary.active_routes} routes active`,
              type: 'positive',
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Verified Quotes:</span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  {dashboardSummary.quotes_24h.toLocaleString()}
                </span>
              </div>
            }
          />
        </div>
      </div>

      {/* ROW 2: NATIONAL APIx TREND & TOP CONTRIBUTORS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* National Airfare Price Index Trend Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-[#101828]">
                  National Airfare Price Index (APIx) Trend
                </h3>
                {isAnyFetching && (
                  <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-mono animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#667085]">
                Daily official index series benchmarked against MoSPI Consumer Price Index (Transport &amp; Comm)
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#475467]">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium">
                {filters.dateRange.preset || '30D'} Range • {filters.bookingWindows.length} Windows
              </span>
            </div>
          </div>
          <NationalIndexChart data={trendData} compareMode={filters.compareMode} />
        </div>

        {/* Top APIx Contributors */}
        <div className="lg:col-span-4 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#101828]">Top Route Contributors</h3>
              <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setContributorDirection('up')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    contributorDirection === 'up'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-[#64748B]'
                  }`}
                >
                  Upward (+pts)
                </button>
                <button
                  type="button"
                  onClick={() => setContributorDirection('down')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    contributorDirection === 'down'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-[#64748B]'
                  }`}
                >
                  Downward (-pts)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mb-2">
              Index point impact based on route fare shift and DGCA passenger traffic weights:
            </p>

            <WaterfallContributionChart contributors={contributors} />
          </div>

          <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
            <Link
              href="/apix"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <span>View full basket decomposition</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ROW 3: ROUTE PRESSURE HEATMAP & LIVE MARKET SIGNALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Route × Booking-Window Heatmap */}
        <div className="lg:col-span-7 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#101828]">Network Route Movement &amp; Advance Curve Matrix</h3>
              </div>
              <p className="text-[11px] text-[#667085]">
                Price relative movement filtered to selected city-pairs and advance booking windows
              </p>
            </div>
            <Link
              href="/market"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Expand Matrix →
            </Link>
          </div>

          <RoutePressureHeatmap
            selectedWindows={filters.bookingWindows}
            selectedRoutes={filters.routeIds}
          />
        </div>

        {/* Live Market Signals Feed */}
        <div className="lg:col-span-5 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[#101828]">Real-Time Market Signals</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold uppercase">
                {filters.routeIds.length > 0 ? `${filters.routeIds.length} Monitored` : '5 Active Signals'}
              </span>
            </div>
            <p className="text-[11px] text-[#667085] mb-3">
              Automated heuristics detecting price surges, rate limit drops, and cross-source shocks:
            </p>

            <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
              {mockMarketSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="p-2.5 rounded border border-[#E4E7EC] hover:bg-[#F8FAFC] transition-colors cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-[#94A3B8]">{sig.timestamp}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        sig.severity === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : sig.severity === 'SHOCK'
                          ? 'bg-amber-100 text-amber-900 font-black'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sig.category}
                    </span>
                  </div>
                  <div className="font-semibold text-[#101828] text-xs">{sig.title}</div>
                  <p className="text-[11px] text-[#475467] mt-0.5 line-clamp-2">{sig.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
            <Link href="/anomalies" className="text-blue-600 hover:text-blue-800 font-medium">
              Investigate in Anomaly Center →
            </Link>
          </div>
        </div>
      </div>

      {/* ROW 4: SYSTEM TRUST & DATA RELIABILITY STRIP */}
      <div className="bg-[#081426] text-white rounded-lg p-4 border border-[#132238] shadow-xs min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#132238] mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-[#F8FAFC]">
              Official Data Trust &amp; Reliability Index
            </span>
            <span className="text-[10px] text-[#94A3B8] hidden sm:inline">
              (Formula: Q = 0.40 C_r + 0.25 C_s + 0.20 F + 0.15 V)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8]">Statistical Trust Score:</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-mono">
              {(dashboardSummary.coverage_quality_score * 100).toFixed(1)} / 100 (HIGH QUALITY)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Route Basket Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.route_coverage_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {dashboardSummary.active_routes} routes
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Source Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.source_coverage_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {dashboardSummary.healthy_sources} active
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Booking Window Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {filters.bookingWindows.length * 20}%
            </span>
            <span className="text-[10px] text-amber-400 block mt-0.5">
              {filters.bookingWindows.length} of 5 selected
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Data Freshness</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.freshness_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">&lt; 3 min latency</span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Validation Pass Rate</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.validation_success_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {dashboardSummary.quotes_24h.toLocaleString()} quotes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
