'use client';

import React from 'react';
import { History, TrendingUp, Download, CheckCircle2 } from 'lucide-react';
import { BacktestComparisonChart } from '@/components/charts/BacktestComparisonChart';
import { mockBacktestPoints } from '@/lib/mock-data/dashboard';

export default function BacktestingPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-[#101828] tracking-tight">
              Statistical Backtesting &amp; Official MoSPI CPI Benchmarking
            </h1>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Validation of the high-frequency daily Airfare Price Index against monthly official MoSPI CPI Transport releases and DGCA quarterly average fare indicators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D0D5DD] text-xs font-semibold text-[#101828] rounded shadow-2xs hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" />
            <span>Download Statistical Audit Dossier</span>
          </button>
        </div>
      </div>

      {/* KPI Validation Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Pearson Correlation (r)</span>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">0.942</div>
          <span className="text-[11px] text-emerald-700 font-medium">Strong positive co-movement</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Lead-Lag Horizon</span>
          <div className="text-3xl font-bold text-blue-700 tabular-nums mt-1">+14 Days</div>
          <span className="text-[11px] text-[#667085]">APIx leads MoSPI release</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">Tracking RMSE</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">1.84 pts</div>
          <span className="text-[11px] text-[#667085]">Low variance vs benchmark</span>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#667085] uppercase">DGCA Agreement</span>
          <div className="text-3xl font-bold text-[#101828] tabular-nums mt-1">96.5%</div>
          <span className="text-[11px] text-[#667085]">Within quarterly bounds</span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Daily APIx vs Official MoSPI Transport CPI &amp; DGCA Reference (12 Months)</h3>
            <p className="text-[11px] text-[#667085]">
              Demonstrates that daily automated web scraping captures inflation turning points 14 to 28 days before official monthly publication.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Validated Against eSankhyiki Portal
          </span>
        </div>

        <BacktestComparisonChart data={mockBacktestPoints} />
      </div>
    </div>
  );
}
