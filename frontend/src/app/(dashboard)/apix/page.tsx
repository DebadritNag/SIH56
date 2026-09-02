'use client';

import React from 'react';
import { TrendingUp, Layers, CheckCircle2, Download } from 'lucide-react';
import { formatINR, formatPercent } from '@/lib/formatters';

const BASKET_COMPONENTS = [
  { route: 'DEL → BOM', window: 'T+1', current_fare: 11840, base_fare: 9850, relative: 120.20, weight: 0.042, contribution: 0.85, obs: 240, cov: 98 },
  { route: 'DEL → BOM', window: 'T+7', current_fare: 7950, base_fare: 6900, relative: 115.22, weight: 0.048, contribution: 0.73, obs: 310, cov: 99 },
  { route: 'DEL → BOM', window: 'T+15', current_fare: 6280, base_fare: 5800, relative: 108.28, weight: 0.032, contribution: 0.26, obs: 210, cov: 96 },
  { route: 'DEL → BOM', window: 'T+30', current_fare: 5120, base_fare: 4950, relative: 103.43, weight: 0.020, contribution: 0.07, obs: 146, cov: 94 },
  { route: 'DEL → BLR', window: 'T+1', current_fare: 12400, base_fare: 10500, relative: 118.10, weight: 0.038, contribution: 0.69, obs: 198, cov: 97 },
  { route: 'DEL → BLR', window: 'T+7', current_fare: 7600, base_fare: 6700, relative: 113.43, weight: 0.042, contribution: 0.56, obs: 280, cov: 98 },
  { route: 'BOM → BLR', window: 'T+1', current_fare: 9400, base_fare: 8100, relative: 116.05, weight: 0.031, contribution: 0.50, obs: 175, cov: 96 },
  { route: 'DEL → CCU', window: 'T+7', current_fare: 6850, base_fare: 6200, relative: 110.48, weight: 0.028, contribution: 0.29, obs: 160, cov: 95 },
  { route: 'BOM → GOI', window: 'T+7', current_fare: 3200, base_fare: 3500, relative: 91.43, weight: 0.022, contribution: -0.19, obs: 120, cov: 92 },
];

export default function ApixPage() {
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
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Strictly computed from validated observed airfares. Matched Laspeyres basket combining DGCA passenger traffic weights and advance purchase windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" />
            <span>Export MoSPI CSV Basket</span>
          </button>
        </div>
      </div>

      {/* KPI Decomposition Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">National APIx Value</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">108.43</div>
          <span className="text-[11px] text-emerald-700 font-semibold">+1.24% Today</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Base Period Value</span>
          <div className="text-3xl font-bold text-[#475467] tabular-nums mt-1">100.00</div>
          <span className="text-[11px] text-[#667085]">Aug 2026 Reference</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Active Basket Items</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">405</div>
          <span className="text-[11px] text-[#667085]">81 routes × 5 windows</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Coverage Quality</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">94.8%</div>
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
              {BASKET_COMPONENTS.map((item, idx) => (
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
        </div>
      </div>
    </div>
  );
}
