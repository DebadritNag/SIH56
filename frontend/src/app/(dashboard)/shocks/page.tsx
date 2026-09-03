'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import { DataSourceMeta } from '@/components/data/DataBadge';
import { EmptyShocksState } from '@/components/states/EmptyState';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';

const SHOCKS = [
  { id: 'SHOCK-2026-0902-A', route: 'DEL → BOM', window: 'T+1', surgePct: 42.8, medianFare: 11840, baselineFare: 8290, agreementCount: '4/4 Sources', carriers: 'IndiGo, Air India, Akasa', detectedAt: '15:10 IST Today', status: 'CONFIRMED' },
  { id: 'SHOCK-2026-0902-B', route: 'CCU → GAU', window: 'T+7', surgePct: 36.4, medianFare: 7200, baselineFare: 5280, agreementCount: '3/3 Sources', carriers: 'IndiGo, SpiceJet', detectedAt: '12:45 IST Today', status: 'CONFIRMED' },
  { id: 'SHOCK-2026-0901-C', route: 'DEL → BLR', window: 'T+1', surgePct: 29.5, medianFare: 12400, baselineFare: 9570, agreementCount: '4/4 Sources', carriers: 'Air India, IndiGo', detectedAt: '01 Sep 18:20', status: 'RESOLVED' },
];

export default function PriceShocksPage() {
  const { mode } = useDataMode();
  const isMock = mode === 'mock';
  // Price shocks require synchronous multi-source surge verification. In Live mode
  // only genuinely detected shocks are shown (none fabricated); Mock shows the demo set.
  const shocks = isMock ? SHOCKS : [];
  const activeCount = shocks.filter((s) => s.status === 'CONFIRMED').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-rose-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Price Shock Center &amp; Multi-Source Surge Verification
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            A route surge is only certified as a Price Shock when synchronous elevated pricing is verified across multiple independent channels, eliminating scraping artifacts.
          </p>
          <div className="mt-1.5">
            <DataSourceMeta isMock={isMock} source={isMock ? 'Demo dataset' : 'AirPulse PriceGuard (live)'} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton
            exportType="PRICE_SHOCKS"
            format="PDF"
            title="AirPulse — Market Price Shock Summary"
          />
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs rounded">
            {activeCount} Active Confirmed Shocks
          </span>
        </div>
      </div>

      {shocks.length === 0 ? (
        <EmptyShocksState layout="card" />
      ) : (
      /* Shocks Table */
      <div className="bg-white border border-[#E4E7EC] rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475467] font-semibold border-b border-[#E4E7EC] text-[11px] uppercase">
              <tr>
                <th className="p-3">Shock ID</th>
                <th className="p-3">Corridor</th>
                <th className="p-3">Window</th>
                <th className="p-3 text-right">Surge %</th>
                <th className="p-3 text-right">Shock Median</th>
                <th className="p-3 text-right">Baseline Median</th>
                <th className="p-3 text-center">Multi-Source Verification</th>
                <th className="p-3">Airlines Impacted</th>
                <th className="p-3">Detected</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {shocks.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-rose-700">{s.id}</td>
                  <td className="p-3 font-bold text-[#101828]">{s.route}</td>
                  <td className="p-3 font-semibold text-blue-700">{s.window}</td>
                  <td className="p-3 text-right font-bold text-rose-600 tabular-nums">+{s.surgePct}%</td>
                  <td className="p-3 text-right font-bold text-[#101828] tabular-nums">{formatINR(s.medianFare)}</td>
                  <td className="p-3 text-right text-[#667085] tabular-nums font-mono">{formatINR(s.baselineFare)}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                      {s.agreementCount} VERIFIED
                    </span>
                  </td>
                  <td className="p-3 text-[#475467]">{s.carriers}</td>
                  <td className="p-3 text-[#667085] font-mono text-[11px]">{s.detectedAt}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                      s.status === 'CONFIRMED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
