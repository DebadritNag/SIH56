'use client';

import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';

export interface PermissionStateProps {
  layout?: SystemStateLayout;
  currentRole?: string;
  requiredRole?: string;
  className?: string;
}

/**
 * 401 Unauthorized State: Session expired or not signed in
 */
export const UnauthorizedState: React.FC<PermissionStateProps> = ({
  layout = 'full-page',
  className,
}) => {
  return (
    <SystemState
      variant="forbidden"
      layout={layout}
      icon={Lock}
      title="Authentication required"
      description="Your secure MoSPI institutional session has expired or requires re-authentication to query this intelligence workspace."
      primaryAction={{ label: 'Sign In to AirPulse', href: '/login' }}
      secondaryAction={{ label: 'Platform Methodology', href: '/methodology' }}
      className={className}
    />
  );
};

/**
 * 403 Forbidden State: Insufficient role permissions
 */
export const ForbiddenState: React.FC<PermissionStateProps> = ({
  layout = 'card',
  currentRole = 'Statistical Viewer',
  requiredRole = 'MoSPI Analyst or Administrator',
  className,
}) => {
  return (
    <SystemState
      variant="forbidden"
      layout={layout}
      icon={ShieldAlert}
      title="Access restricted"
      description="Your current institutional role does not have authorization to view this analytical dossier or execute manual collection triggers."
      metadata={
        <div className="flex items-center justify-center gap-3 text-xs bg-slate-50 border border-[#E4E7EC] rounded-lg p-2.5 font-mono">
          <span className="text-[#475467]">Your Role: <strong className="text-[#101828]">{currentRole}</strong></span>
          <span className="text-[#CBD5E1]">|</span>
          <span className="text-[#475467]">Required: <strong className="text-blue-700">{requiredRole}</strong></span>
        </div>
      }
      primaryAction={{ label: 'Return to Overview', href: '/overview' }}
      secondaryAction={{ label: 'Request Clearance', href: '/alerts' }}
      className={className}
    />
  );
};
