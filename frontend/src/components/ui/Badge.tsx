import React from 'react';
import { clsx } from 'clsx';
import { DataOrigin, SourceStatus, AnomalySeverity, PipelineStatus, MarketPressure } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'navy' | 'outline';
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  size = 'sm',
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded tracking-wide uppercase transition-colors';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs leading-4';

  const variantMap = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-sky-50 text-sky-700 border border-sky-200',
    navy: 'bg-[#081426] text-white border border-slate-800',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };

  return (
    <span className={clsx(baseClasses, sizeClasses, variantMap[variant], className)}>
      {children}
    </span>
  );
};

export const OriginBadge: React.FC<{ origin: DataOrigin }> = ({ origin }) => {
  switch (origin) {
    case 'LIVE':
      return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />LIVE</Badge>;
    case 'REPLAY':
      return <Badge variant="info">REPLAY</Badge>;
    case 'SYNTHETIC':
      return <Badge variant="default">SYNTHETIC</Badge>;
    case 'IMPORTED':
      return <Badge variant="outline">IMPORTED</Badge>;
    case 'REFERENCE':
      return <Badge variant="navy">OFFICIAL REF</Badge>;
  }
};

export const SeverityBadge: React.FC<{ severity: AnomalySeverity }> = ({ severity }) => {
  switch (severity) {
    case 'LOW':
      return <Badge variant="default">LOW</Badge>;
    case 'MEDIUM':
      return <Badge variant="warning">MEDIUM</Badge>;
    case 'HIGH':
      return <Badge variant="danger">HIGH</Badge>;
    case 'CRITICAL':
      return <Badge variant="danger" className="bg-rose-600 text-white font-bold border-rose-700">CRITICAL</Badge>;
  }
};

export const MarketPressureBadge: React.FC<{ pressure: MarketPressure }> = ({ pressure }) => {
  switch (pressure) {
    case 'STABLE':
      return <Badge variant="success">NORMAL</Badge>;
    case 'MODERATE_PRESSURE':
      return <Badge variant="warning">ELEVATED</Badge>;
    case 'SURGING':
      return <Badge variant="danger" className="bg-rose-600 text-white font-semibold">SURGING</Badge>;
    case 'COLLAPSING':
      return <Badge variant="info">COLLAPSING</Badge>;
  }
};

export const HealthBadge: React.FC<{ status: SourceStatus }> = ({ status }) => {
  switch (status) {
    case 'HEALTHY':
      return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />HEALTHY</Badge>;
    case 'DEGRADED':
      return <Badge variant="warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />DEGRADED</Badge>;
    case 'FAILED':
      return <Badge variant="danger"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />FAILED</Badge>;
    case 'DISABLED':
      return <Badge variant="default">DISABLED</Badge>;
  }
};

