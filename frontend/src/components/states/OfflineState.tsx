'use client';

import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';

export interface OfflineStateProps {
  layout?: SystemStateLayout;
  lastCachedTime?: string;
  onRetry?: () => void;
  className?: string;
}

export const OfflineState: React.FC<OfflineStateProps> = ({
  layout = 'card',
  lastCachedTime = '17:42:10 IST Today',
  onRetry,
  className,
}) => {
  return (
    <SystemState
      variant="offline"
      layout={layout}
      icon={WifiOff}
      title="You are offline"
      description="AirPulse cannot retrieve new airfare observations or compute real-time indices until your connection is restored."
      metadata={
        <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-[#667085] bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>CACHED DATA • Last retrieved: {lastCachedTime}</span>
        </div>
      }
      primaryAction={onRetry ? { label: 'Retry Connection', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'System Diagnostics', href: '/system' }}
      className={className}
    />
  );
};
