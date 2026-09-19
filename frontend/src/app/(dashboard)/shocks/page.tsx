"use client";
import { Zap } from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { usePriceShocks } from '@/lib/hooks/usePriceShocks';
import { GenerateReportButton } from '@/components/data/GenerateReportButton';
import { PriceShockReadiness } from '@/components/readiness/PriceShockReadiness';
import { ReadinessSkeleton, ReadinessError } from '@/components/readiness/ReadinessUI';
export default function PriceShocksPage() {
  const {isMock,shocks,activeCount,isPending,error,refetch,data,isFetching}=usePriceShocks();
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Zap size={22} className="shrink-0 text-blue-600"/>Price Shock Center &amp; Multi-Source Surge Verification</h1><p className="mt-2 text-sm leading-6 text-slate-600">A route surge is only certified as a Price Shock when synchronous elevated pricing is verified across multiple independent channels, reducing the risk of treating source-specific artifacts as market-wide movement.</p><p className="mt-2 text-xs text-slate-500">{isMock?'DEMO / SYNTHETIC':'LIVE MODE'}</p></div><GenerateReportButton exportType="PRICE_SHOCKS" format="PDF" title="AirPulse — Market Price Shock Summary" disabled={!data}/></header>
    {!isMock && <PriceShockReadiness/>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Confirmed Price Shocks</h2><span className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold">{isPending?'Loading confirmed shocks…':!data?'Shock count unavailable':`${activeCount} Active Confirmed Shocks`}</span></div>
    {isFetching&&data&&<p role="status" className="text-xs text-blue-700">Refreshing confirmed events…</p>}
    {error&&<ReadinessError title="Unable to load Price Shock verification status" retry={()=>void refetch()}/>}
    {isPending?<ReadinessSkeleton/>:!data?null:shocks.length===0?<section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">None currently verified</h3><p className="mt-2 text-sm text-slate-600">No event currently satisfies the configured multi-source confirmation criteria.</p></section>:(
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
  </div>;
}
