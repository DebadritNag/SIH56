'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, ArrowDownRight, TrendingUp, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { MarketPressureBadge } from '@/components/ui/Badge';
import { formatINR, formatPercent } from '@/lib/formatters';
import { clsx } from 'clsx';

const ALL_MARKET_ROUTES = [
  { route: 'DEL → BOM', origin: 'DEL', dest: 'BOM', median: 7420, change7d: 4.8, change30d: 12.1, status: 'SURGING' as const, t1: 11840, t7: 7420, t15: 5900, t30: 4850, t45: 4120 },
  { route: 'DEL → BLR', origin: 'DEL', dest: 'BLR', median: 6850, change7d: 3.2, change30d: 8.4, status: 'MODERATE_PRESSURE' as const, t1: 12400, t7: 6850, t15: 5600, t30: 4600, t45: 3950 },
  { route: 'BOM → BLR', origin: 'BOM', dest: 'BLR', median: 5410, change7d: 1.5, change30d: 4.2, status: 'STABLE' as const, t1: 9400, t7: 5410, t15: 4400, t30: 3800, t45: 3200 },
  { route: 'DEL → CCU', origin: 'DEL', dest: 'CCU', median: 6120, change7d: 2.1, change30d: 5.9, status: 'MODERATE_PRESSURE' as const, t1: 10500, t7: 6120, t15: 4950, t30: 4100, t45: 3500 },
  { route: 'HYD → DEL', origin: 'HYD', dest: 'DEL', median: 5890, change7d: -0.8, change30d: 2.1, status: 'STABLE' as const, t1: 9800, t7: 5890, t15: 4800, t30: 3900, t45: 3400 },
  { route: 'BOM → GOI', origin: 'BOM', dest: 'GOI', median: 3250, change7d: -4.2, change30d: -8.5, status: 'COLLAPSING' as const, t1: 5800, t7: 3250, t15: 2900, t30: 2400, t45: 2100 },
  { route: 'BLR → PNQ', origin: 'BLR', dest: 'PNQ', median: 4100, change7d: 0.4, change30d: 1.8, status: 'STABLE' as const, t1: 6900, t7: 4100, t15: 3500, t30: 3100, t45: 2800 },
];

const WINDOW_COLS = [
  { key: 't1', code: 1, label: 'T+1 (1-2d)' },
  { key: 't7', code: 7, label: 'T+7 (3-10d)' },
  { key: 't15', code: 15, label: 'T+15 (11-20d)' },
  { key: 't30', code: 30, label: 'T+30 (21-35d)' },
  { key: 't45', code: 45, label: 'T+45 (36+d)' },
];

export default function MarketMonitorPage() {
  const [selectedWindows, setSelectedWindows] = useState<number[]>([1, 7, 15, 30, 45]);
  const [selectedPressure, setSelectedPressure] = useState<string>('ALL');
  const [selectedCorridor, setSelectedCorridor] = useState<string>('ALL');

  const toggleWindow = (code: number) => {
    if (selectedWindows.includes(code)) {
      if (selectedWindows.length === 1) return; // Prevent 0 selections
      setSelectedWindows(selectedWindows.filter((w) => w !== code));
    } else {
      setSelectedWindows([...selectedWindows, code].sort((a, b) => a - b));
    }
  };

  const handleReset = () => {
    setSelectedWindows([1, 7, 15, 30, 45]);
    setSelectedPressure('ALL');
    setSelectedCorridor('ALL');
  };

  // Filter routes
  const filteredRoutes = useMemo(() => {
    return ALL_MARKET_ROUTES.filter((r) => {
      if (selectedPressure !== 'ALL' && r.status !== selectedPressure) return false;
      if (selectedCorridor !== 'ALL' && !r.route.includes(selectedCorridor)) return false;
      return true;
    });
  }, [selectedPressure, selectedCorridor]);

  // Compute reactive network summary KPIs from filtered dataset
  const kpiData = useMemo(() => {
    if (filteredRoutes.length === 0) {
      return { median: 0, surging: 0, stable: 0, softening: 0 };
    }
    const medians = filteredRoutes.map((r) => r.median);
    const avgMedian = Math.round(medians.reduce((a, b) => a + b, 0) / medians.length);
    const surging = filteredRoutes.filter((r) => r.status === 'SURGING' || r.change7d > 4.0).length;
    const stable = filteredRoutes.filter((r) => r.status === 'STABLE' || r.status === 'MODERATE_PRESSURE').length;
    const softening = filteredRoutes.filter((r) => r.status === 'COLLAPSING' || r.change7d < 0).length;
    return { median: avgMedian, surging, stable, softening };
  }, [filteredRoutes]);

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
            Showing: {filteredRoutes.length} of {ALL_MARKET_ROUTES.length} Routes
          </span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Matrix Filters:</span>
          </div>

          {/* Corridor Select */}
          <select
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Domestic Routes</option>
            <option value="DEL">Delhi (DEL) Corridors</option>
            <option value="BOM">Mumbai (BOM) Corridors</option>
            <option value="BLR">Bengaluru (BLR) Corridors</option>
          </select>

          {/* Pressure Filter */}
          <select
            value={selectedPressure}
            onChange={(e) => setSelectedPressure(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Pressure States</option>
            <option value="SURGING">Surging (&gt; 4% 7d)</option>
            <option value="MODERATE_PRESSURE">Moderate Pressure</option>
            <option value="STABLE">Stable (&plusmn;3% band)</option>
            <option value="COLLAPSING">Collapsing (&lt; -3%)</option>
          </select>

          {/* Multi-Select Booking Windows */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
            <button
              onClick={() => setSelectedWindows([1, 7, 15, 30, 45])}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
                selectedWindows.length === 5 ? 'bg-white text-blue-700 shadow-2xs' : 'text-[#64748B]'
              )}
            >
              All
            </button>
            {WINDOW_COLS.map((w) => {
              const active = selectedWindows.includes(w.code);
              return (
                <button
                  key={w.code}
                  onClick={() => toggleWindow(w.code)}
                  className={clsx(
                    'px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer',
                    active ? 'bg-white text-blue-700 shadow-2xs border border-blue-200' : 'text-[#94A3B8] hover:text-[#475467]'
                  )}
                >
                  T+{w.code}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset to all routes and windows"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="text-xs text-[#667085]">
          Active Term Strata: <strong className="text-[#101828]">{selectedWindows.length} of 5 Windows</strong>
        </div>
      </div>

      {/* Network Summary KPIs (Reactive to Filtered Dataset) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Filtered Median Fare</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{formatINR(kpiData.median)}</div>
          <span className="text-[11px] text-emerald-700 font-semibold">Based on {filteredRoutes.length} corridors</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase">Routes Surging</span>
          <div className="text-3xl font-bold text-rose-700 tabular-nums mt-1">{kpiData.surging}</div>
          <span className="text-[11px] text-rose-700 font-medium">In selected view</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Routes Stable</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">{kpiData.stable}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Within standard band</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase">Routes Softening</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">{kpiData.softening}</div>
          <span className="text-[11px] text-blue-700 font-medium">&lt; 0% decline</span>
        </div>
      </div>

      {/* Market Heatmap Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Route Term Structure &amp; Fare Term Heatmap</h3>
          <span className="text-xs text-[#667085]">Observed Median Fares across Selected Advance Windows</span>
        </div>
        <div className="overflow-x-auto">
          {filteredRoutes.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085]">
              No corridors match the selected matrix filters. Click Reset to restore all routes.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
                <tr>
                  <th className="p-3">Corridor</th>
                  <th className="p-3">Pressure State</th>
                  <th className="p-3 text-right">Representative Median</th>
                  <th className="p-3 text-right">7-Day Change</th>
                  <th className="p-3 text-right">30-Day Change</th>
                  {WINDOW_COLS.filter((w) => selectedWindows.includes(w.code)).map((w) => (
                    <th key={w.code} className="p-3 text-right">
                      {w.label}
                    </th>
                  ))}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredRoutes.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-[#101828]">
                      <Link href={`/routes?route=${r.origin}-${r.dest}`} className="hover:text-blue-600 hover:underline">
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
                    {selectedWindows.includes(1) && (
                      <td className="p-3 text-right font-mono text-rose-700 font-semibold tabular-nums">{formatINR(r.t1)}</td>
                    )}
                    {selectedWindows.includes(7) && (
                      <td className="p-3 text-right font-mono font-bold text-[#101828] tabular-nums">{formatINR(r.t7)}</td>
                    )}
                    {selectedWindows.includes(15) && (
                      <td className="p-3 text-right font-mono text-[#475467] tabular-nums">{formatINR(r.t15)}</td>
                    )}
                    {selectedWindows.includes(30) && (
                      <td className="p-3 text-right font-mono text-[#475467] tabular-nums">{formatINR(r.t30)}</td>
                    )}
                    {selectedWindows.includes(45) && (
                      <td className="p-3 text-right font-mono text-emerald-700 tabular-nums">{formatINR(r.t45)}</td>
                    )}
                    <td className="p-3 text-right">
                      <Link
                        href={`/routes?route=${r.origin}-${r.dest}`}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#101828] font-medium rounded text-[11px] transition-colors cursor-pointer"
                      >
                        Route Curve →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
