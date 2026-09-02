'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Lock,
  RotateCw,
  SearchX,
  ShieldAlert,
  WifiOff,
  FileQuestion,
  LucideIcon
} from 'lucide-react';

export type SystemStateVariant =
  | 'empty'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'
  | 'offline'
  | 'forbidden'
  | 'not-found'
  | 'processing';

export type SystemStateLayout =
  | 'full-page'
  | 'card'
  | 'inline'
  | 'table-cell'
  | 'chart-area'
  | 'drawer';

export interface SystemStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export interface SystemStateProps {
  variant?: SystemStateVariant;
  layout?: SystemStateLayout;
  title: string;
  description?: string;
  icon?: LucideIcon;
  primaryAction?: SystemStateAction;
  secondaryAction?: SystemStateAction;
  metadata?: React.ReactNode;
  className?: string;
}

export const SystemState: React.FC<SystemStateProps> = ({
  variant = 'empty',
  layout = 'card',
  title,
  description,
  icon: CustomIcon,
  primaryAction,
  secondaryAction,
  metadata,
  className,
}) => {
  // Default variant icon mapping
  const defaultIcons: Record<SystemStateVariant, LucideIcon> = {
    empty: FileQuestion,
    error: ShieldAlert,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
    offline: WifiOff,
    forbidden: Lock,
    'not-found': SearchX,
    processing: RotateCw,
  };

  const IconComponent = CustomIcon || defaultIcons[variant];

  const variantColors: Record<SystemStateVariant, { icon: string; bg: string }> = {
    empty: { icon: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' },
    error: { icon: 'text-rose-600', bg: 'bg-rose-50/50 border-rose-200' },
    warning: { icon: 'text-amber-600', bg: 'bg-amber-50/50 border-amber-200' },
    info: { icon: 'text-blue-600', bg: 'bg-blue-50/50 border-blue-200' },
    success: { icon: 'text-emerald-600', bg: 'bg-emerald-50/50 border-emerald-200' },
    offline: { icon: 'text-slate-700', bg: 'bg-slate-100 border-slate-300' },
    forbidden: { icon: 'text-amber-700', bg: 'bg-amber-50/50 border-amber-200' },
    'not-found': { icon: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
    processing: { icon: 'text-blue-600', bg: 'bg-blue-50/50 border-blue-200' },
  };

  const renderAction = (action: SystemStateAction, isPrimary: boolean = false) => {
    const isDanger = action.variant === 'danger';
    const baseBtn = clsx(
      'px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50',
      isPrimary
        ? isDanger
          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
        : 'bg-white hover:bg-slate-50 text-[#344054] border border-[#D0D5DD]'
    );

    if (action.href) {
      return (
        <Link href={action.href} className={baseBtn}>
          {action.label}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.isLoading}
        className={baseBtn}
      >
        {action.isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
        <span>{action.label}</span>
      </button>
    );
  };

  // 1. Table cell layout
  if (layout === 'table-cell') {
    return (
      <div className={clsx('py-12 px-4 text-center flex flex-col items-center justify-center', className)}>
        <IconComponent className={clsx('w-6 h-6 mb-2', variantColors[variant].icon)} />
        <h4 className="text-xs font-bold text-[#101828]">{title}</h4>
        {description && <p className="text-[11px] text-[#475467] mt-1 max-w-sm">{description}</p>}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2 mt-3">
            {primaryAction && renderAction(primaryAction, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </div>
        )}
      </div>
    );
  }

  // 2. Inline compact layout
  if (layout === 'inline') {
    return (
      <div
        className={clsx(
          'p-3 rounded-lg border text-xs flex items-center justify-between gap-3',
          variantColors[variant].bg,
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <IconComponent className={clsx('w-4 h-4 shrink-0', variantColors[variant].icon)} />
          <div>
            <span className="font-semibold text-[#101828]">{title}</span>
            {description && <span className="text-[#475467] ml-2">{description}</span>}
          </div>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2 shrink-0">
            {primaryAction && renderAction(primaryAction, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </div>
        )}
      </div>
    );
  }

  // 3. Chart area layout
  if (layout === 'chart-area') {
    return (
      <div
        className={clsx(
          'h-[320px] w-full flex flex-col items-center justify-center bg-slate-50/50 border border-dashed border-[#D0D5DD] rounded-lg p-6 text-center',
          className
        )}
      >
        <IconComponent className={clsx('w-7 h-7 mb-2.5', variantColors[variant].icon)} />
        <h4 className="text-xs font-bold text-[#101828]">{title}</h4>
        {description && <p className="text-[11px] text-[#475467] mt-1 max-w-xs">{description}</p>}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2 mt-3.5">
            {primaryAction && renderAction(primaryAction, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </div>
        )}
      </div>
    );
  }

  // 4. Full-page layout
  if (layout === 'full-page') {
    return (
      <div className={clsx('min-h-[60vh] flex flex-col items-center justify-center p-6 text-center', className)}>
        <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center border mb-3', variantColors[variant].bg)}>
          <IconComponent className={clsx('w-6 h-6', variantColors[variant].icon)} />
        </div>
        <h2 className="text-base md:text-lg font-bold text-[#101828] tracking-tight">{title}</h2>
        {description && <p className="text-xs text-[#475467] mt-1.5 max-w-md leading-relaxed">{description}</p>}
        {metadata && <div className="mt-4">{metadata}</div>}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2.5 mt-5">
            {primaryAction && renderAction(primaryAction, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </div>
        )}
      </div>
    );
  }

  // 5. Default Card / Drawer layout
  return (
    <div
      className={clsx(
        'bg-white border border-[#E4E7EC] rounded-lg p-6 shadow-xs flex flex-col items-center text-center',
        className
      )}
    >
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center border mb-3', variantColors[variant].bg)}>
        <IconComponent className={clsx('w-5 h-5', variantColors[variant].icon)} />
      </div>
      <h3 className="text-sm font-bold text-[#101828]">{title}</h3>
      {description && <p className="text-xs text-[#475467] mt-1 max-w-sm leading-relaxed">{description}</p>}
      {metadata && <div className="mt-3 w-full text-left">{metadata}</div>}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2.5 mt-4">
          {primaryAction && renderAction(primaryAction, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
};
