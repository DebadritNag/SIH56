'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { usePriceShocks } from '@/lib/hooks/usePriceShocks';
import { DataSourceMeta } from '@/components/data/DataBadge';
import { EmptyShocksState } from '@/components/states/EmptyState';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';


export default function PriceShocksPage() {
  const { isMock, shocks, activeCount, isPending, error, refetch } = usePriceShocks();

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
            <DataSourceMeta isMock={isMock} source={isMock ? 'Demo dataset' : 'Confirmed price shock alerts (live)'} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton
            exportType="PRICE_SHOCKS"
            format="PDF"
            title="AirPulse — Market Price Shock Summary"
          />
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs rounded">
            {isPending ? 'Loading confirmed shocks…' : error ? 'Shock count unavailable' : `${activeCount} Active Confirmed Shocks`}
          </span>
        </div>
      </div>

      {isPending ? <div role="status" className="h-32 animate-pulse rounded bg-slate-100">Loading confirmed price shocks…</div> : error ? <div role="alert" className="rounded border p-4">Unable to load confirmed shocks. <button className="text-blue-700 underline" onClick={() => void refetch()}>Retry</button></div> : shocks.length === 0 ? (
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
