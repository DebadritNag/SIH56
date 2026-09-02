'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, ArrowDownRight, TrendingUp, Filter } from 'lucide-react';
import { MarketPressureBadge } from '@/components/ui/Badge';
import { formatINR, formatPercent } from '@/lib/formatters';

const MARKET_ROUTES = [
  { route: 'DEL → BOM', origin: 'DEL', dest: 'BOM', median: 7420, change7d: 4.8, change30d: 12.1, status: 'SURGING' as const, t1: 11840, t7: 7420, t15: 5900, t30: 4850, t45: 4120 },
  { route: 'DEL → BLR', origin: 'DEL', dest: 'BLR', median: 6850, change7d: 3.2, change30d: 8.4, status: 'MODERATE_PRESSURE' as const, t1: 12400, t7: 6850, t15: 5600, t30: 4600, t45: 3950 },
  { route: 'BOM → BLR', origin: 'BOM', dest: 'BLR', median: 5410, change7d: 1.5, change30d: 4.2, status: 'STABLE' as const, t1: 9400, t7: 5410, t15: 4400, t30: 3800, t45: 3200 },
  { route: 'DEL → CCU', origin: 'DEL', dest: 'CCU', median: 6120, change7d: 2.1, change30d: 5.9, status: 'MODERATE_PRESSURE' as const, t1: 10500, t7: 6120, t15: 4950, t30: 4100, t45: 3500 },
  { route: 'HYD → DEL', origin: 'HYD', dest: 'DEL', median: 5890, change7d: -0.8, change30d: 2.1, status: 'STABLE' as const, t1: 9800, t7: 5890, t15: 4800, t30: 3900, t45: 3400 },
  { route: 'BOM → GOI', origin: 'BOM', dest: 'GOI', median: 3250, change7d: -4.2, change30d: -8.5, status: 'COLLAPSING' as const, t1: 5800, t7: 3250, t15: 2900, t30: 2400, t45: 2100 },
  { route: 'BLR → PNQ', origin: 'BLR', dest: 'PNQ', median: 4100, change7d: 0.4, change30d: 1.8, status: 'STABLE' as const, t1: 6900, t7: 4100, t15: 3500, t30: 3100, t45: 2800 },
];

export default function MarketMonitorPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Market Monitor &amp; Route Velocity Matrix
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Network-wide airfare movements, inflation pressure indicators, and multi-lead time fare term structures across all active domestic corridors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 font-bold text-xs rounded">
            Active Corridors: 81 Domestic Routes
          </span>
        </div>
      </div>

      {/* Network Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Network Median Fare</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{formatINR(6420)}</div>
          <span className="text-[11px] text-emerald-700 font-semibold">+2.4% vs Last Week</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase">Routes Surging</span>
          <div className="text-3xl font-bold text-rose-700 tabular-nums mt-1">12</div>
          <span className="text-[11px] text-rose-700 font-medium">&gt; 10% 7-day surge</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Routes Stable</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">58</div>
          <span className="text-[11px] text-emerald-700 font-medium">Within &plusmn;3% band</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase">Routes Softening</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">11</div>
          <span className="text-[11px] text-blue-700 font-medium">&lt; -3% decline</span>
        </div>
      </div>

      {/* Market Heatmap Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Route Term Structure &amp; Fare Term Heatmap</h3>
          <span className="text-xs text-[#667085]">Observed Median Fares across Advance Windows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Corridor</th>
                <th className="p-3">Pressure State</th>
                <th className="p-3 text-right">T+7 Representative</th>
                <th className="p-3 text-right">7-Day Change</th>
                <th className="p-3 text-right">30-Day Change</th>
                <th className="p-3 text-right">T+1 (1-2d)</th>
                <th className="p-3 text-right">T+7 (3-10d)</th>
                <th className="p-3 text-right">T+15 (11-20d)</th>
                <th className="p-3 text-right">T+30 (21-35d)</th>
                <th className="p-3 text-right">T+45 (36+d)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {MARKET_ROUTES.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-[#101828]">
                    <Link href="/routes" className="hover:text-blue-600 hover:underline">
                      {r.route}
                    </Link>
                  </td>
                  <td className="p-3">
                    <MarketPressureBadge pressure={r.status} />
                  </td>
                  <td className="p-3 text-right font-bold text-[#101828] tabular-nums">
                    {formatINR(r.median)}
                  </td>
                  <td className={`p-3 text-right font-bold tabular-nums ${r.change7d >= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {r.change7d >= 0 ? '+' : ''}{r.change7d.toFixed(1)}%
                  </td>
                  <td className={`p-3 text-right font-bold tabular-nums ${r.change30d >= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {r.change30d >= 0 ? '+' : ''}{r.change30d.toFixed(1)}%
                  </td>
                  <td className="p-3 text-right font-mono text-rose-700 font-semibold tabular-nums">{formatINR(r.t1)}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#101828] tabular-nums">{formatINR(r.t7)}</td>
                  <td className="p-3 text-right font-mono text-[#475467] tabular-nums">{formatINR(r.t15)}</td>
                  <td className="p-3 text-right font-mono text-[#475467] tabular-nums">{formatINR(r.t30)}</td>
                  <td className="p-3 text-right font-mono text-emerald-700 tabular-nums">{formatINR(r.t45)}</td>
                  <td className="p-3 text-right">
                    <Link
                      href="/routes"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#101828] font-medium rounded text-[11px] transition-colors"
                    >
                      Route Curve →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
