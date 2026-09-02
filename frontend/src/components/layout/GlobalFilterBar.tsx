'use client';

import React, { useState } from 'react';
import { RotateCw, SlidersHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

interface GlobalFilterBarProps {
  onRefresh?: () => void;
  selectedWindow?: string;
  onSelectWindow?: (window: string) => void;
  lastRefreshed?: string;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  onRefresh,
  selectedWindow = 'All',
  onSelectWindow,
  lastRefreshed = '17:52 IST',
}) => {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [routeScope, setRouteScope] = useState('All Monitored Routes');
  const [sourceScope, setSourceScope] = useState('All Direct & OTA Sources');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const windows = ['All', 'T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-2.5 px-4 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
      {/* Left Filter Group */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-[#667085] font-semibold uppercase text-[10px] tracking-wider mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Date Range Select */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          aria-label="Filter by Date Range"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option>Last 7 Days</option>
          <option>Last 30 Days</option>
          <option>Last 3 Months</option>
          <option>Last 6 Months</option>
          <option>Base Period (Aug 2026)</option>
        </select>

        {/* Route Select */}
        <select
          value={routeScope}
          onChange={(e) => setRouteScope(e.target.value)}
          aria-label="Filter by Route Basket"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option>All Monitored Routes (81)</option>
          <option>DEL → BOM (Delhi - Mumbai)</option>
          <option>DEL → BLR (Delhi - Bengaluru)</option>
          <option>BOM → BLR (Mumbai - Bengaluru)</option>
          <option>DEL → CCU (Delhi - Kolkata)</option>
          <option>HYD → DEL (Hyderabad - Delhi)</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceScope}
          onChange={(e) => setSourceScope(e.target.value)}
          aria-label="Filter by Data Source"
          className="bg-[#F8FAFC] border border-[#D0D5DD] text-[#101828] font-medium rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option>All Direct & OTA Sources (5)</option>
          <option>Airline Direct (IndiGo / AI / SpiceJet)</option>
          <option>OTA Sources (MMT / EMT / Cleartrip)</option>
        </select>

        {/* Booking Window Buttons */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
          {windows.map((w) => (
            <button
              key={w}
              onClick={() => onSelectWindow && onSelectWindow(w)}
              className={clsx(
                'px-2 py-0.5 rounded text-[11px] font-medium transition-all',
                selectedWindow === w
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-[#64748B] hover:text-[#101828]'
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 text-xs text-[#667085]">
        <span>Last calculated: <strong className="text-[#101828] tabular-nums">{lastRefreshed}</strong></span>
        <button
          onClick={handleRefreshClick}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#D0D5DD] hover:bg-slate-50 text-[#101828] font-medium rounded transition-colors shadow-2xs"
        >
          <RotateCw className={clsx('w-3 h-3 text-[#475467]', isRefreshing && 'animate-spin')} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
