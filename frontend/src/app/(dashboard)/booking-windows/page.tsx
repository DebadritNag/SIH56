'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, Info, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { useBookingWindowSummary } from '@/lib/hooks/useDashboard';
import { DataSourceMeta } from '@/components/data/DataBadge';
import { LiveModeBadge, DataCompositionStrip } from '@/components/data/LiveModeBadge';
import { useLiveModeContext } from '@/lib/hooks/useLiveModeContext';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { notify } from '@/lib/notify';

const WINDOW_DATA = [
  {
    code: 'T+1',
    label: 'Emergency / Last Minute',
    days: '1 - 2 Days',
    medianFare: 11200,
    volatility: 'High (34.2%)',
    cpiWeight: '15.0%',
    statusTag: 'LAST MINUTE SURGE',
    rationale:
      'Captures distressed, non-discretionary corporate & medical travel premium.',
  },
  {
    code: 'T+7',
    label: 'Short-Term Planning',
    days: '3 - 10 Days',
    medianFare: 7420,
    volatility: 'Moderate (14.5%)',
    cpiWeight: '35.0%',
    statusTag: 'PRIMARY BENCHMARK',
    rationale:
      'Primary benchmark window reflecting standard commercial and business leisure travel.',
  },
  {
    code: 'T+15',
    label: 'Medium-Term Discretionary',
    days: '11 - 20 Days',
    medianFare: 5900,
    volatility: 'Low (8.1%)',
    cpiWeight: '25.0%',
    statusTag: 'DISCRETIONARY',
    rationale:
      'Standard domestic vacation and visiting-friends-and-relatives (VFR) booking cycle.',
  },
  {
    code: 'T+30',
    label: 'Long-Term Advance',
    days: '21 - 35 Days',
    medianFare: 4850,
    volatility: 'Very Low (4.8%)',
    cpiWeight: '15.0%',
    statusTag: 'ADVANCE INVENTORY',
    rationale:
      'Early planning leisure and festival migration bookings.',
  },
  {
    code: 'T+45',
    label: 'Ultra Advance Base',
    days: '36+ Days',
    medianFare: 4120,
    volatility: 'Stable (3.2%)',
    cpiWeight: '10.0%',
    statusTag: 'BASE YIELD FLOOR',
    rationale:
      'Base airline yield inventory floor; highly predictable statutory and seasonal baseline.',
  },
];

export default function BookingWindowsPage() {
  const { mode } = useDataMode();
  const isMock = mode === 'mock';
  const [isManualReloading, setIsManualReloading] = useState(false);

  const { ctx, isLoading: ctxLoading } = useLiveModeContext();

  const {
    data: bwSummary,
    isLoading: isBwLoading,
    isFetching: isBwFetching,
    refetch: refetchBw,
  } = useBookingWindowSummary();

  const handleReload = async () => {
    setIsManualReloading(true);
    try {
      await refetchBw();
      notify.success('Booking window data reloaded');
    } catch {
      notify.error('Failed to reload booking windows');
    } finally {
      setTimeout(() => setIsManualReloading(false), 600);
    }
  };

  const isBusy = isBwLoading || isBwFetching || isManualReloading;

  // New backend shape: [{window, window_code, avg_fare, sample_count, available, availability_label, live_count, imported_count}]
  // Map by label e.g. "T+7"
  const realByLabel = useMemo(() => {
    type BwRow = {
      window?: string;
      window_code?: number;
      avg_fare?: number;
      sample_count?: number;
      available?: boolean;
      availability_label?: string;
      live_count?: number;
      imported_count?: number;
    };
    const map = new Map<string, BwRow>();
    for (const r of ((bwSummary as BwRow[] | undefined) ?? [])) {
      const key = r.window ?? (r.window_code != null ? `T+${r.window_code}` : null);
      if (key) map.set(key, r);
    }
    return map;
  }, [bwSummary]);

  const windows = WINDOW_DATA.map((w) => {
    if (isMock) {
      return { ...w, hasData: true, isVerified: true, sampleCount: 420,
        liveCount: 5, importedCount: 26, availabilityLabel: '420 observations (demo)',
        statusText: 'Demo Baseline' };
    }
    const real = realByLabel.get(w.code);
    const available = real?.available === true;
    const n = real?.sample_count ?? 0;
    return {
      ...w,
      // Only show real fare when real data exists — never show mock fare for unavailable windows.
      medianFare: available ? (real?.avg_fare ?? null) : null,
      hasData: available,
      isVerified: available,
      sampleCount: n,
      liveCount: real?.live_count ?? 0,
      importedCount: real?.imported_count ?? 0,
      availabilityLabel: real?.availability_label ?? (available ? `${n} observations` : 'No observations'),
      statusText: available ? `${n} obs` : 'No observations',
    };
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Advance Booking Windows &amp; Lead Time Economics
            </h1>
            <LiveModeBadge ctx={ctx} loading={ctxLoading} isMock={isMock} />
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Systematic segmentation of airfare observations by advance purchase horizon to isolate dynamic yield pricing from macro headline inflation.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <DataSourceMeta
              isMock={isMock}
              source={isMock ? 'Demo dataset' : 'AirPulse validated observations (Live)'}
            />
            {!isMock && <DataCompositionStrip ctx={ctx} />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Reload Telemetry Button */}
          <button
            onClick={handleReload}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            title="Reload booking window telemetry and empirical observation counts"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isBusy ? 'animate-spin' : ''}`} />
            <span>{isBusy ? 'Aggregating Windows...' : 'Reload Telemetry'}</span>
          </button>

          <GenerateReportButton
            exportType="BOOKING_WINDOW_ANALYSIS"
            format="PDF"
            title="AirPulse — Advance Booking Window Analysis"
          />
        </div>
      </div>

      {/* Booking Windows Cards */}
      <div className="relative">
        {isBusy && (
          <div className="absolute inset-0 bg-white/60 z-10 rounded-lg flex items-center justify-center">
            <span className="text-xs text-[#667085] animate-pulse font-semibold">Updating windows…</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {windows.map((w) => (
              <div
                key={w.code}
                className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {w.code}
                    </span>
                    <span className="text-[10px] text-[#667085] font-mono">{w.days}</span>
                  </div>
                  <h3 className="text-xs font-bold text-[#101828] line-clamp-1">{w.label}</h3>

                  {/* Fare value — only shown when real observations exist */}
                  {isMock || w.hasData ? (
                    <div className="text-2xl font-bold text-[#101828] tabular-nums mt-2">
                      {w.medianFare != null ? formatINR(w.medianFare) : '—'}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-300" />
                      No observations
                    </div>
                  )}

                  {/* Observation status */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {!isMock && (
                      w.isVerified
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <AlertCircle className="w-3 h-3 text-slate-300 shrink-0" />
                    )}
                    <span className={`text-[10px] font-semibold ${
                      isMock ? 'text-[#667085]' : w.isVerified ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      {w.availabilityLabel}
                    </span>
                  </div>

                  {/* Live / Imported breakdown for verified windows */}
                  {!isMock && w.isVerified && (w.liveCount > 0 || w.importedCount > 0) && (
                    <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-[#94A3B8]">
                      {w.liveCount > 0 && <span className="text-emerald-600">LIVE {w.liveCount}</span>}
                      {w.importedCount > 0 && <span className="text-blue-500">IMP {w.importedCount}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-[#F1F5F9] text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#667085]">CPI Basket Wt:</span>
                    <span className="font-bold text-[#101828]">{w.cpiWeight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Volatility:</span>
                    <span className="text-[#475467]">{w.volatility}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">Market Role:</span>
                    <span className="text-[10px] font-bold text-slate-700 uppercase">
                      {w.statusTag}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs">
        <h3 className="text-sm font-bold text-[#101828] mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-blue-600" />
          Why Multiple Lead Time Windows Matter for CPI Augmentation
        </h3>
        <p className="text-xs text-[#475467] leading-relaxed">
          Airfare does not have a single price. A flight ticket booked for tomorrow (T+1) can cost 3× more than the exact same seat on the same flight booked 30 days in advance (T+30). In standard Consumer Price Index methodology, comparing prices without controlling for advance purchase leads to severe dynamic pricing bias. AirPulse eliminates this by standardizing price relatives across 5 discrete windows, preserving genuine underlying price changes.
        </p>
      </div>
    </div>
  );
}
