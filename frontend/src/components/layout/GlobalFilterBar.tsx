'use client';

import React from 'react';
import { RotateCw, SlidersHorizontal, RotateCcw, GitCompare } from 'lucide-react';
import { clsx } from 'clsx';
import { DashboardFilters } from '@/types';

interface GlobalFilterBarProps {
  filters: DashboardFilters;
  onFiltersChange: (newFilters: DashboardFilters) => void;
  onRefresh?: () => void;
  onReset?: () => void;
  isRefreshing?: boolean;
  lastRefreshed?: string;
  isFilterStale?: boolean;
}

const WINDOW_CONFIG = [
  { code: 1, label: 'T+1' },
  { code: 7, label: 'T+7' },
  { code: 15, label: 'T+15' },
  { code: 30, label: 'T+30' },
  { code: 45, label: 'T+45' },
];

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  onFiltersChange,
  onRefresh,
  onReset,
  isRefreshing = false,
  lastRefreshed = '17:52 IST',
  isFilterStale = false,
}) => {
  const currentPreset = filters.dateRange?.preset || '30D';
  const selectedRoute = filters.routeIds?.[0] || 'ALL';
  const selectedSource = filters.sourceIds?.[0] || 'ALL';
  const selectedWindows = filters.bookingWindows || [1, 7, 15, 30, 45];
  const compareMode = filters.compareMode || 'none';

  // Toggle multi-select booking window (prevent zero selections)
  const handleToggleWindow = (code: number) => {
    let nextWindows: number[];
    if (selectedWindows.includes(code)) {
      if (selectedWindows.length === 1) {
        // Prevent zero windows
        return;
      }
      nextWindows = selectedWindows.filter((w) => w !== code);
    } else {
      nextWindows = [...selectedWindows, code].sort((a, b) => a - b);
    }

    onFiltersChange({
      ...filters,
      bookingWindows: nextWindows,
    });
  };

  const handleSelectAllOrResetWindows = () => {
    onFiltersChange({
      ...filters,
      bookingWindows: [1, 7, 15, 30, 45],
    });
  };

  const handleDatePresetChange = (preset: string) => {
    let from = '2026-08-04';
    const to = '2026-09-02';

    if (preset === '7D') from = '2026-08-26';
    else if (preset === '30D') from = '2026-08-04';
    else if (preset === '3M') from = '2026-06-02';
    else if (preset === '6M') from = '2026-03-02';
    else if (preset === 'BASE_AUG2026') from = '2026-08-01';

    onFiltersChange({
      ...filters,
      dateRange: { from, to, preset },
    });
  };

  const handleRouteChange = (val: string) => {
    onFiltersChange({
      ...filters,
      routeIds: val === 'ALL' ? [] : [val],
    });
  };

  const handleSourceChange = (val: string) => {
    onFiltersChange({
      ...filters,
      sourceIds: val === 'ALL' ? [] : [val],
    });
  };

  const handleCompareChange = (val: string) => {
    onFiltersChange({
      ...filters,
      compareMode: val === 'none' ? null : val,
    });
  };

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
      {/* Left Filter Group */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Date Range Preset Select */}
        <select
          value={currentPreset}
          onChange={(e) => handleDatePresetChange(e.target.value)}
          aria-label="Filter by Date Range"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="7D">Last 7 Days</option>
          <option value="30D">Last 30 Days</option>
          <option value="3M">Last 3 Months</option>
          <option value="6M">Last 6 Months</option>
          <option value="BASE_AUG2026">Base Period (Aug 2026)</option>
        </select>

        {/* Route Select */}
        <select
          value={selectedRoute}
          onChange={(e) => handleRouteChange(e.target.value)}
          aria-label="Filter by Route Basket"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="ALL">All Monitored Routes (81)</option>
          <option value="DEL-BOM">DEL → BOM (Delhi - Mumbai)</option>
          <option value="DEL-BLR">DEL → BLR (Delhi - Bengaluru)</option>
          <option value="BOM-BLR">BOM → BLR (Mumbai - Bengaluru)</option>
          <option value="DEL-CCU">DEL → CCU (Delhi - Kolkata)</option>
          <option value="HYD-DEL">HYD → DEL (Hyderabad - Delhi)</option>
          <option value="BOM-GOI">BOM → GOI (Mumbai - Goa)</option>
        </select>

        {/* Source Filter */}
        <select
          value={selectedSource}
          onChange={(e) => handleSourceChange(e.target.value)}
          aria-label="Filter by Data Source"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="ALL">All Direct &amp; OTA Sources (5)</option>
          <option value="AIRLINE_DIRECT">Airline Direct (IndiGo / AI / SpiceJet)</option>
          <option value="OTA_AGGREGATOR">OTA Sources (MMT / EMT / Cleartrip)</option>
        </select>

        {/* Compare Select */}
        <div className="flex items-center gap-1">
          <select
            value={compareMode}
            onChange={(e) => handleCompareChange(e.target.value)}
            aria-label="Compare Mode"
            className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="none">Compare: None</option>
            <option value="previous_period">Compare: Previous Period</option>
            <option value="previous_month">Compare: Previous Month</option>
          </select>
        </div>

        {/* T+ Multi-Select Booking Window Pill Buttons */}
        <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleSelectAllOrResetWindows}
            className={clsx(
              'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
              selectedWindows.length === 5
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-[#64748B] hover:text-[#101828]'
            )}
            title="Select all 5 booking windows"
          >
            All
          </button>
          {WINDOW_CONFIG.map((w) => {
            const isSelected = selectedWindows.includes(w.code);
            return (
              <button
                key={w.code}
                type="button"
                onClick={() => handleToggleWindow(w.code)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer',
                  isSelected
                    ? 'bg-white text-blue-700 shadow-2xs border border-blue-200'
                    : 'text-[#94A3B8] hover:text-[#475467]'
                )}
                title={`Toggle ${w.label} window (${isSelected ? 'Active' : 'Excluded'})`}
              >
                {w.label}
              </button>
            );
          })}
        </div>

        {/* Reset Filters Action */}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] hover:text-[#101828] px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset all filters to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Right Controls: Freshness & Refresh */}
      <div className="flex items-center gap-3 text-xs text-[#667085]">
        <div className="flex items-center gap-1.5">
          {isFilterStale && (
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
              Updating...
            </span>
          )}
          <span>
            Last refreshed:{' '}
            <strong className="text-[#101828] tabular-nums">{lastRefreshed}</strong>
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#D0D5DD] hover:bg-slate-50 disabled:opacity-60 text-[#101828] font-semibold rounded transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCw
              className={clsx('w-3.5 h-3.5 text-blue-600', isRefreshing && 'animate-spin')}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
