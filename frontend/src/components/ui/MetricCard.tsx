import React from 'react';
import { clsx } from 'clsx';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
    label?: string;
  };
  badge?: React.ReactNode;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  badge,
  subtitle,
  footer,
  className,
  variant = 'default',
}) => {
  const isGlass = variant === 'glass';

  return (
    <div
      className={clsx(
        isGlass
          ? 'glass-card rounded-xl p-4 flex flex-col justify-between shadow-lg text-white border border-brand-cyan/20'
          : 'bg-white border border-[#E4E7EC] rounded-lg p-4 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={clsx(
            'text-xs font-semibold tracking-wider uppercase',
            isGlass ? 'text-brand-cyan' : 'text-[#475467]'
          )}
        >
          {title}
        </span>
        {badge && <div>{badge}</div>}
      </div>

      <div className="my-1">
        <div
          className={clsx(
            'text-2xl font-bold tabular-nums tracking-tight font-display',
            isGlass ? 'text-white text-glow' : 'text-[#101828]'
          )}
        >
          {value}
        </div>
        {subtitle && (
          <p className={clsx('text-xs mt-0.5', isGlass ? 'text-slate-300' : 'text-[#667085]')}>
            {subtitle}
          </p>
        )}
      </div>

      {change && (
        <div className="flex items-center gap-1.5 text-xs font-medium mt-2">
          {change.type === 'positive' && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />}
          {change.type === 'negative' && <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />}
          {change.type === 'neutral' && <Minus className="w-3.5 h-3.5 text-slate-500" />}
          <span className={clsx(
            change.type === 'positive' && 'text-emerald-700',
            change.type === 'negative' && 'text-rose-700',
            change.type === 'neutral' && 'text-slate-600',
            'tabular-nums'
          )}>
            {change.value}
          </span>
          {change.label && <span className="text-[#667085] font-normal">{change.label}</span>}
        </div>
      )}

      {footer && (
        <div
          className={clsx(
            'mt-3 pt-2.5 border-t text-xs',
            isGlass ? 'border-white/10 text-slate-300' : 'border-[#F1F5F9] text-[#475467]'
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
