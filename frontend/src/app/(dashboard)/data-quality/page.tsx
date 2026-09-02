'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, AlertCircle, Layers } from 'lucide-react';

const QUALITY_MATRIX = [
  { route: 'DEL → BOM', t1: 98, t7: 99, t15: 96, t30: 94, t45: 92 },
  { route: 'DEL → BLR', t1: 97, t7: 98, t15: 95, t30: 93, t45: 90 },
  { route: 'BOM → BLR', t1: 96, t7: 98, t15: 94, t30: 92, t45: 89 },
  { route: 'DEL → CCU', t1: 95, t7: 97, t15: 92, t30: 90, t45: 86 },
  { route: 'HYD → DEL', t1: 94, t7: 96, t15: 93, t30: 91, t45: 88 },
  { route: 'BOM → GOI', t1: 92, t7: 95, t15: 90, t30: 88, t45: 84 },
  { route: 'BLR → PNQ', t1: 90, t7: 94, t15: 89, t30: 86, t45: 81 },
  { route: 'CCU → GAU', t1: 88, t7: 92, t15: 86, t30: 84, t45: 78 },
];

function getCoverageCellClass(val: number): string {
  if (val >= 95) return 'bg-emerald-100 text-emerald-900 font-bold';
  if (val >= 90) return 'bg-emerald-50 text-emerald-800 font-semibold';
  if (val >= 85) return 'bg-amber-50 text-amber-800 font-medium';
  return 'bg-rose-50 text-rose-800 font-medium';
}

export default function DataQualityPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Data Quality &amp; Statistical Trust Matrix
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Audit coverage completeness, data missingness, cross-channel convergence, and validation rates across the national basket.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 rounded text-xs">
            Overall Quality: 94.8 / 100
          </span>
        </div>
      </div>

      {/* Trust Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Route Basket Coverage</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">94.0%</div>
          <span className="text-[11px] text-emerald-700 font-medium">81 Routes Monitored</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Cross-Source Agreement</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">96.8%</div>
          <span className="text-[11px] text-emerald-700 font-medium">Convergence within 2.5%</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Validation Pass Rate</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">97.4%</div>
          <span className="text-[11px] text-[#667085]">412 Physical Sanity Errors</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Sampling Freshness</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">98.0%</div>
          <span className="text-[11px] text-[#667085]">&lt; 3m Collection Cycle</span>
        </div>
      </div>

      {/* Coverage Matrix Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Route × Booking Window Coverage Completeness (%)</h3>
          <span className="text-xs text-[#667085]">Green &ge; 90% target coverage</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Route Corridor</th>
                <th className="p-3 text-center">T+1 (1d)</th>
                <th className="p-3 text-center">T+7 (7d)</th>
                <th className="p-3 text-center">T+15 (15d)</th>
                <th className="p-3 text-center">T+30 (30d)</th>
                <th className="p-3 text-center">T+45 (45d)</th>
                <th className="p-3 text-right">Route Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {QUALITY_MATRIX.map((row, idx) => {
                const avg = ((row.t1 + row.t7 + row.t15 + row.t30 + row.t45) / 5).toFixed(1);
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-[#101828]">{row.route}</td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2.5 py-1 rounded text-[11px] ${getCoverageCellClass(row.t1)}`}>{row.t1}%</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2.5 py-1 rounded text-[11px] ${getCoverageCellClass(row.t7)}`}>{row.t7}%</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2.5 py-1 rounded text-[11px] ${getCoverageCellClass(row.t15)}`}>{row.t15}%</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2.5 py-1 rounded text-[11px] ${getCoverageCellClass(row.t30)}`}>{row.t30}%</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2.5 py-1 rounded text-[11px] ${getCoverageCellClass(row.t45)}`}>{row.t45}%</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#101828] tabular-nums">{avg}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
