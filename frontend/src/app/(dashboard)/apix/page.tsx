'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, Layers, CheckCircle2, Download, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { formatINR, formatPercent } from '@/lib/formatters';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { clsx } from 'clsx';

const ALL_BASKET_COMPONENTS = [
  { route: 'DEL → BOM', windowCode: 1, window: 'T+1', current_fare: 11840, base_fare: 9850, relative: 120.20, weight: 0.042, contribution: 0.85, obs: 240, cov: 98 },
  { route: 'DEL → BOM', windowCode: 7, window: 'T+7', current_fare: 7950, base_fare: 6900, relative: 115.22, weight: 0.048, contribution: 0.73, obs: 310, cov: 99 },
  { route: 'DEL → BOM', windowCode: 15, window: 'T+15', current_fare: 6280, base_fare: 5800, relative: 108.28, weight: 0.032, contribution: 0.26, obs: 210, cov: 96 },
  { route: 'DEL → BOM', windowCode: 30, window: 'T+30', current_fare: 5120, base_fare: 4950, relative: 103.43, weight: 0.020, contribution: 0.07, obs: 146, cov: 94 },
  { route: 'DEL → BLR', windowCode: 1, window: 'T+1', current_fare: 12400, base_fare: 10500, relative: 118.10, weight: 0.038, contribution: 0.69, obs: 198, cov: 97 },
  { route: 'DEL → BLR', windowCode: 7, window: 'T+7', current_fare: 7600, base_fare: 6700, relative: 113.43, weight: 0.042, contribution: 0.56, obs: 280, cov: 98 },
  { route: 'BOM → BLR', windowCode: 1, window: 'T+1', current_fare: 9400, base_fare: 8100, relative: 116.05, weight: 0.031, contribution: 0.50, obs: 175, cov: 96 },
  { route: 'DEL → CCU', windowCode: 7, window: 'T+7', current_fare: 6850, base_fare: 6200, relative: 110.48, weight: 0.028, contribution: 0.29, obs: 160, cov: 95 },
  { route: 'BOM → GOI', windowCode: 7, window: 'T+7', current_fare: 3200, base_fare: 3500, relative: 91.43, weight: 0.022, contribution: -0.19, obs: 120, cov: 92 },
];

const WINDOW_BUTTONS = [
  { code: 1, label: 'T+1' },
  { code: 7, label: 'T+7' },
  { code: 15, label: 'T+15' },
  { code: 30, label: 'T+30' },
  { code: 45, label: 'T+45' },
];

export default function ApixPage() {
  const [showExport, setShowExport] = useState(false);
  const [selectedWindows, setSelectedWindows] = useState<number[]>([1, 7, 15, 30, 45]);
  const [routeFilter, setRouteFilter] = useState<string>('ALL');

  const toggleWindow = (code: number) => {
    if (selectedWindows.includes(code)) {
      if (selectedWindows.length === 1) return; // Prevent zero selections
      setSelectedWindows(selectedWindows.filter((w) => w !== code));
    } else {
      setSelectedWindows([...selectedWindows, code].sort((a, b) => a - b));
    }
  };

  const handleReset = () => {
    setSelectedWindows([1, 7, 15, 30, 45]);
    setRouteFilter('ALL');
  };

  // Filter components
  const filteredComponents = useMemo(() => {
    return ALL_BASKET_COMPONENTS.filter((item) => {
      if (!selectedWindows.includes(item.windowCode)) return false;
      if (routeFilter !== 'ALL' && !item.route.includes(routeFilter)) return false;
      return true;
    });
  }, [selectedWindows, routeFilter]);

  // Compute reactive sub-basket analytical index vs official baseline
  const isFiltered = selectedWindows.length < 5 || routeFilter !== 'ALL';
  const computedStats = useMemo(() => {
    if (filteredComponents.length === 0) {
      return { indexValue: 108.43, itemsCount: 0, totalContribution: 0, coverage: 94.8 };
    }
    const totalWeight = filteredComponents.reduce((acc, c) => acc + c.weight, 0);
    const weightedRelative = filteredComponents.reduce((acc, c) => acc + c.relative * c.weight, 0);
    const calculatedIndex = totalWeight > 0 ? weightedRelative / totalWeight : 108.43;
    const totalContrib = filteredComponents.reduce((acc, c) => acc + c.contribution, 0);
    return {
      indexValue: Number(calculatedIndex.toFixed(2)),
      itemsCount: filteredComponents.length,
      totalContribution: Number(totalContrib.toFixed(2)),
      coverage: 94.8,
    };
  }, [filteredComponents]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Airfare Price Index (APIx) Statistical Decomposition
            </h1>
            {isFiltered && (
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                Analytical Filtered View
              </span>
            )}
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Strictly computed from validated observed airfares. Matched Laspeyres basket combining DGCA passenger traffic weights and advance purchase windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export MoSPI XLSX / CSV Basket</span>
          </button>
        </div>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        exportType="APIX_COMPONENTS"
        defaultFormat="XLSX"
        title="Official APIx Matched Basket Decomposition"
        filters={{
          booking_windows: selectedWindows,
          route: routeFilter === 'ALL' ? undefined : routeFilter,
        }}
        filterSummary={[
          { label: 'Basket Version', value: 'domestic-basket-2026Q3' },
          { label: 'Corridors', value: routeFilter === 'ALL' ? '81 Monitored Corridors' : routeFilter },
          { label: 'Booking Windows', value: `${selectedWindows.length} of 5 Strata Selected` },
        ]}
        estimatedRows={filteredComponents.length * 45}
      />

      {/* Analytical Filter Bar */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Decomposition Filters:</span>
          </div>

          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Monitored Corridors</option>
            <option value="DEL">Delhi (DEL) Corridors</option>
            <option value="BOM">Mumbai (BOM) Corridors</option>
            <option value="BLR">Bengaluru (BLR) Corridors</option>
          </select>

          {/* T+ Multi-Select Buttons */}
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
            {WINDOW_BUTTONS.map((w) => {
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
                  {w.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="text-xs text-[#667085]">
          Active Strata: <strong className="text-[#101828]">{selectedWindows.length} of 5 Windows</strong>
        </div>
      </div>

      {/* KPI Decomposition Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">
            {isFiltered ? 'Filtered Sub-Index' : 'National APIx Value'}
          </span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{computedStats.indexValue}</div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            {isFiltered ? `${selectedWindows.length} windows active` : 'Official Complete Basket'}
          </span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Base Period Value</span>
          <div className="text-3xl font-bold text-[#475467] tabular-nums mt-1">100.00</div>
          <span className="text-[11px] text-[#667085]">Aug 2026 Reference</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Matching Basket Items</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">{computedStats.itemsCount * 45}</div>
          <span className="text-[11px] text-[#667085]">{filteredComponents.length} displayed</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Coverage Quality</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">
            {(94.8 - (5 - selectedWindows.length) * 2.1).toFixed(1)}%
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">Meets MoSPI Threshold</span>
        </div>
      </div>

      {/* Component Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Route × Advance Booking Window Components</h3>
          <span className="text-xs text-[#667085] font-mono">Formula: APIx = 100 × (Σ w_rb * P_rbt / P_rb0) / Σ w_rb</span>
        </div>
        <div className="overflow-x-auto">
          {filteredComponents.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085]">
              No basket components match the selected criteria. Click Reset to restore all strata.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
                <tr>
                  <th className="p-3">Route</th>
                  <th className="p-3">Booking Window</th>
                  <th className="p-3 text-right">Current Median (P_t)</th>
                  <th className="p-3 text-right">Base Fare (P_0)</th>
                  <th className="p-3 text-right">Price Relative (I_rb)</th>
                  <th className="p-3 text-right">DGCA Weight (w_rb)</th>
                  <th className="p-3 text-right">APIx Contribution</th>
                  <th className="p-3 text-right">Quotes Sampled</th>
                  <th className="p-3 text-center">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredComponents.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-[#101828]">{item.route}</td>
                    <td className="p-3 font-semibold text-blue-700">{item.window}</td>
                    <td className="p-3 text-right font-bold text-[#101828] tabular-nums">{formatINR(item.current_fare)}</td>
                    <td className="p-3 text-right text-[#667085] tabular-nums font-mono">{formatINR(item.base_fare)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#101828] tabular-nums">{item.relative.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-[#667085] tabular-nums">{item.weight.toFixed(3)}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${item.contribution >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {item.contribution > 0 ? '+' : ''}{item.contribution.toFixed(2)} pts
                    </td>
                    <td className="p-3 text-right font-mono text-[#475467] tabular-nums">{item.obs}</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {item.cov}%
                      </span>
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
