'use client';

import React from 'react';
import { Hammer, Server, Database, Activity } from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';

export interface MaintenanceStateProps {
  layout?: SystemStateLayout;
  affectedServices?: string[];
  expectedRestoration?: string;
  className?: string;
}

export const MaintenanceState: React.FC<MaintenanceStateProps> = ({
  layout = 'full-page',
  affectedServices = ['Celery Batch Ingestion Workers', 'FastAPI Aggregation Node 02'],
  expectedRestoration,
  className,
}) => {
  return (
    <SystemState
      variant="warning"
      layout={layout}
      icon={Hammer}
      title="AirPulse is undergoing scheduled maintenance"
      description="Analytical pipeline and automated web scraping services are temporarily paused while database schema migrations and DGCA route table updates are completed."
      metadata={
        <div className="text-left w-full max-w-sm mx-auto bg-slate-50 border border-[#E4E7EC] rounded-lg p-3 text-xs space-y-2">
          <div className="font-semibold text-[#101828]">Affected Components:</div>
          <ul className="space-y-1 text-[#475467] font-mono text-[11px]">
            {affectedServices.map((svc, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{svc}</span>
              </li>
            ))}
          </ul>
          {expectedRestoration && (
            <div className="text-[11px] text-[#667085] pt-1 border-t border-slate-200">
              Estimated completion: <strong>{expectedRestoration}</strong>
            </div>
          )}
        </div>
      }
      primaryAction={{ label: 'System Diagnostics', href: '/system' }}
      secondaryAction={{ label: 'Official Methodology', href: '/methodology' }}
      className={className}
    />
  );
};
