'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  Info
} from 'lucide-react';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { PrimaryIndexCard } from '@/components/ui/PrimaryIndexCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { NationalIndexChart } from '@/components/charts/NationalIndexChart';
import { WaterfallContributionChart } from '@/components/charts/WaterfallContributionChart';
import { RoutePressureHeatmap } from '@/components/charts/RoutePressureHeatmap';
import {
  mockMarketSignals,
  mockDashboardSummary,
  mockNationalTrend,
  mockUpwardContributors,
  mockDownwardContributors,
  mockSystemTrustMetrics,
} from '@/lib/mock-data/dashboard';
import {
  useDashboardSummary,
  useNationalTrend,
  useRouteContributors,
  useSystemTrust,
} from '@/lib/hooks/useDashboard';
import { formatPercent, formatINR } from '@/lib/formatters';

export default function OverviewPage() {
  const [contributorDirection, setContributorDirection] = useState<'up' | 'down'>('up');
  const [selectedWindow, setSelectedWindow] = useState('All');

  // Real data from FastAPI. Hooks provide placeholderData, but guard against undefined
  // on the very first render with explicit mock fallbacks so the UI never crashes.
  const { data: summary } = useDashboardSummary();
  const { data: nationalTrend } = useNationalTrend();
  const { data: contributorSets } = useRouteContributors();
  const { data: systemTrust } = useSystemTrust();

  const dashboardSummary = summary ?? mockDashboardSummary;
  const trendData = nationalTrend ?? mockNationalTrend;
  const trustMetrics = systemTrust ?? mockSystemTrustMetrics;
  const contributors =
    contributorDirection === 'up'
      ? contributorSets?.up ?? mockUpwardContributors
      : contributorSets?.down ?? mockDownwardContributors;

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
            Airfare Intelligence Overview
          </h1>
          <p className="text-xs text-[#475467] mt-0.5">
            Real-time domestic airfare inflation, index velocity, and market pressure across India&apos;s monitored aviation network.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-slate-100 text-[#475467] font-medium rounded border border-slate-200">
            Base Period: Aug 2026 = 100.0
          </span>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200">
            Laspeyres-Type Route Basket
          </span>
        </div>
      </div>

      {/* Global Filter Bar */}
      <GlobalFilterBar
        selectedWindow={selectedWindow}
        onSelectWindow={setSelectedWindow}
        lastRefreshed="17:52 IST"
      />

      {/* ROW 1: HERO INDEX STRIP (Dominant 40% APIx Card + 3 Intelligence KPI Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dominant National APIx Card (approx 40% width / 5 cols) */}
        <div className="lg:col-span-5">
          <PrimaryIndexCard
            indexValue={dashboardSummary.latest_index}
            dailyChange={dashboardSummary.daily_change_pct}
            monthlyChange={dashboardSummary.monthly_change_pct}
            pressure={dashboardSummary.market_pressure}
            confidenceScore={dashboardSummary.coverage_quality_score}
            className="h-full"
          />
        </div>

        {/* 3 Smaller Intelligence Cards (approx 60% width / 7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <MetricCard
            title="Monthly Airfare Inflation"
            value={formatPercent(dashboardSummary.monthly_change_pct, { includeSign: true })}
            subtitle="vs Previous 30-Day Index"
            change={{
              value: "↑ 0.63 pp",
              type: "positive",
              label: "acceleration",
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Daily Momentum:</span>
                <span className="font-semibold text-emerald-700">+1.24 pts</span>
              </div>
            }
          />

          <MetricCard
            title="Market Pressure"
            value={dashboardSummary.market_pressure}
            subtitle="17 routes rising rapidly"
            badge={
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            }
            change={{
              value: "4/5 sources aligned",
              type: "neutral",
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Price Shocks:</span>
                <span className="font-bold text-rose-600">1 Active (BLR-DEL)</span>
              </div>
            }
          />

          <MetricCard
            title="Data Confidence"
            value={`${(dashboardSummary.coverage_quality_score * 100).toFixed(1)}%`}
            subtitle="High Statistical Trust"
            change={{
              value: "81 routes monitored",
              type: "positive",
            }}
            footer={
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#667085]">Validation Rate:</span>
                <span className="font-semibold text-emerald-700">97.4% Passed</span>
              </div>
            }
          />
        </div>
      </div>

      {/* ROW 2: NATIONAL APIx TREND & TOP CONTRIBUTORS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* National Airfare Price Index Trend Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-[#101828]">National Airfare Price Index (APIx) Trend</h3>
              </div>
              <p className="text-[11px] text-[#667085]">
                Daily official index series benchmarked against MoSPI Consumer Price Index (Transport &amp; Comm)
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#475467]">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium">30-Day Window</span>
            </div>
          </div>
          <NationalIndexChart data={trendData} />
        </div>

        {/* Top APIx Contributors */}
        <div className="lg:col-span-4 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#101828]">Top Route Contributors</h3>
              <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
                <button
                  onClick={() => setContributorDirection('up')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    contributorDirection === 'up'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-[#64748B]'
                  }`}
                >
                  Upward (+pts)
                </button>
                <button
                  onClick={() => setContributorDirection('down')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
        <div className="lg:col-span-7 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#101828]">Network Route Movement &amp; Advance Curve Matrix</h3>
              </div>
              <p className="text-[11px] text-[#667085]">
                7-Day price relative movement across monitored city-pairs and advance booking windows
              </p>
            </div>
            <Link
              href="/market"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Expand Matrix →
            </Link>
          </div>

          <RoutePressureHeatmap />
        </div>

        {/* Live Market Signals Feed */}
        <div className="lg:col-span-5 bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[#101828]">Real-Time Market Signals</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold uppercase">
                5 Active Signals
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

      {/* ROW 4: SYSTEM TRUST & DATA RELIABILITY STRIP (Mandatory for Government Statisticians) */}
      <div className="bg-[#081426] text-white rounded-lg p-4 border border-[#132238] shadow-xs">
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
              94.8 / 100 (HIGH QUALITY)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Route Basket Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.route_coverage_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">81 of 81 routes</span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Source Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.source_coverage_pct}%
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">4 of 5 active</span>
          </div>

          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase block">Booking Window Coverage</span>
            <span className="text-base font-bold text-white tabular-nums">
              {trustMetrics.booking_window_coverage_pct}%
            </span>
            <span className="text-[10px] text-amber-400 block mt-0.5">T+45 sampled 91%</span>
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
            <span className="text-[10px] text-emerald-400 block mt-0.5">27,611 / 28,452 quotes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
