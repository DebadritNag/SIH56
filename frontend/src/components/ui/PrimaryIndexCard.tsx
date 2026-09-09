import React from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, Activity, ArrowUpRight } from 'lucide-react';
import { MarketPressureBadge } from './Badge';
import { MarketPressure } from '@/types';

interface PrimaryIndexCardProps {
  indexValue: number | null;
  basePeriod?: string;
  dailyChange: number | null;
  monthlyChange: number | null;
  confidenceScore: number;
  pressure: MarketPressure;
  className?: string;
  variant?: 'default' | 'glass';
}

export const PrimaryIndexCard: React.FC<PrimaryIndexCardProps> = ({
  indexValue,
  basePeriod = 'Base: Aug 2026 = 100.00',
  dailyChange,
  monthlyChange,
  confidenceScore,
  pressure,
  className,
  variant = 'default',
}) => {
  const isGlass = variant === 'glass';

  return (
    <div
      className={clsx(
        isGlass
          ? 'glass-card rounded-xl p-5 flex flex-col justify-between shadow-xl text-white border border-brand-cyan/25'
          : 'bg-white border border-[#E4E7EC] rounded-lg p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors',
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-cyan animate-pulse shadow-[0_0_8px_#00D2FF]" />
          <span
            className={clsx(
              'text-xs font-bold uppercase tracking-wider',
              isGlass ? 'text-brand-cyan font-display' : 'text-[#101828]'
            )}
          >
            National Airfare Price Index (APIx)
          </span>
        </div>
        <MarketPressureBadge pressure={pressure} />
      </div>

      {/* Main Index KPI */}
      <div className="my-3 flex items-baseline justify-between">
        <div>
          <div
            className={clsx(
              'text-4xl font-bold tabular-nums tracking-tight font-display',
              isGlass ? 'text-white text-glow' : 'text-[#101828]'
            )}
          >
            {indexValue?.toFixed(2) ?? "Unavailable"}
          </div>
          <span className={clsx('text-xs font-medium', isGlass ? 'text-slate-300' : 'text-[#667085]')}>
            {basePeriod}
          </span>
        </div>

        {/* Change Indicators */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 tabular-nums">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            {dailyChange == null ? "Daily change unavailable" : `${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(2)}% Today`}
          </div>
          <div className={clsx('text-xs font-medium tabular-nums', isGlass ? 'text-slate-300' : 'text-[#475467]')}>
            {monthlyChange == null ? "Monthly change unavailable" : `${monthlyChange >= 0 ? "+" : ""}${monthlyChange.toFixed(2)}% in 30 Days`}
          </div>
        </div>
      </div>

      {/* Trust & Methodology Footer */}
      <div
        className={clsx(
          'mt-3 pt-3 border-t flex items-center justify-between text-xs',
          isGlass ? 'border-white/10 text-slate-300' : 'border-[#F1F5F9] text-[#475467]'
        )}
      >
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            Data Confidence: <strong className={clsx('tabular-nums', isGlass ? 'text-white' : 'text-[#101828]')}>{(confidenceScore * 100).toFixed(1)}%</strong>
          </span>
        </div>
        <div className={clsx('flex items-center gap-1', isGlass ? 'text-brand-cyan' : 'text-[#667085]')}>
          <Activity className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Laspeyres-Type Route Basket</span>
        </div>
      </div>
    </div>
  );
};
