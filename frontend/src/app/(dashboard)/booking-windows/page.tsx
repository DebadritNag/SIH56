'use client';

import React from 'react';
import { Calendar, TrendingUp, Info } from 'lucide-react';
import { formatINR } from '@/lib/formatters';

const WINDOW_DATA = [
  { code: 'T+1', label: 'Emergency / Last Minute', days: '1 - 2 Days', medianFare: 11200, volatility: 'High (34.2%)', cpiWeight: '15.0%', rationale: 'Captures distressed, non-discretionary corporate & medical travel premium.' },
  { code: 'T+7', label: 'Short-Term Planning', days: '3 - 10 Days', medianFare: 7420, volatility: 'Moderate (14.5%)', cpiWeight: '35.0%', rationale: 'Primary benchmark window reflecting standard commercial and business leisure travel.' },
  { code: 'T+15', label: 'Medium-Term Discretionary', days: '11 - 20 Days', medianFare: 5900, volatility: 'Low (8.1%)', cpiWeight: '25.0%', rationale: 'Standard domestic vacation and visiting-friends-and-relatives (VFR) booking cycle.' },
  { code: 'T+30', label: 'Long-Term Advance', days: '21 - 35 Days', medianFare: 4850, volatility: 'Very Low (4.8%)', cpiWeight: '15.0%', rationale: 'Early planning leisure and festival migration bookings.' },
  { code: 'T+45', label: 'Ultra Advance Base', days: '36+ Days', medianFare: 4120, volatility: 'Stable (3.2%)', cpiWeight: '10.0%', rationale: 'Base airline yield inventory floor; highly predictable statutory and seasonal baseline.' },
];

export default function BookingWindowsPage() {
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
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Systematic segmentation of airfare observations by advance purchase horizon to isolate yield management dynamics from macro inflation trends.
          </p>
        </div>
      </div>

      {/* Booking Windows Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
        {WINDOW_DATA.map((w) => (
          <div key={w.code} className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                  {w.code}
                </span>
                <span className="text-[10px] text-[#667085] font-mono">{w.days}</span>
              </div>
              <h3 className="text-xs font-bold text-[#101828] line-clamp-1">{w.label}</h3>
              <div className="text-2xl font-bold text-[#101828] tabular-nums mt-2">
                {formatINR(w.medianFare)}
              </div>
              <span className="text-[10px] text-[#667085] block mt-0.5">National Median Fare</span>
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
            </div>
          </div>
        ))}
      </div>

      {/* Economic Methodology Explainer */}
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
