import React from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, Activity, ArrowUpRight } from 'lucide-react';
import { MarketPressureBadge } from './Badge';
import { MarketPressure } from '@/types';

interface PrimaryIndexCardProps {
  indexValue: number;
  basePeriod?: string;
  dailyChange: number;
  monthlyChange: number;
  confidenceScore: number;
  pressure: MarketPressure;
  className?: string;
}

export const PrimaryIndexCard: React.FC<PrimaryIndexCardProps> = ({
  indexValue,
  basePeriod = 'Base: Aug 2026 = 100.00',
  dailyChange,
  monthlyChange,
  confidenceScore,
  pressure,
  className,
}) => {
  return (
    <div className={clsx('bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col justify-between', className)}>
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-xs font-bold text-[#101828] uppercase tracking-wider">
            National Airfare Price Index (APIx)
          </span>
        </div>
        <MarketPressureBadge pressure={pressure} />
      </div>

      {/* Main Index KPI */}
      <div className="my-3 flex items-baseline justify-between">
        <div>
          <div className="text-4xl font-bold text-[#101828] tabular-nums tracking-tight">
            {indexValue.toFixed(2)}
          </div>
          <span className="text-xs text-[#667085] font-medium">{basePeriod}</span>
        </div>

        {/* Change Indicators */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 tabular-nums">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            +{dailyChange.toFixed(2)}% Today
          </div>
          <div className="text-xs text-[#475467] font-medium tabular-nums">
            +{monthlyChange.toFixed(2)}% in 30 Days
          </div>
        </div>
      </div>

      {/* Trust & Methodology Footer */}
      <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#475467]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Data Confidence: <strong className="text-[#101828] tabular-nums">{(confidenceScore * 100).toFixed(1)}%</strong></span>
        </div>
        <div className="flex items-center gap-1 text-[#667085]">
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>Laspeyres-Type Route Basket</span>
        </div>
      </div>
    </div>
  );
};
