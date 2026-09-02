'use client';

import React, { useState } from 'react';
import { ShieldAlert, Server, WifiOff, RotateCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';
import { notify } from '@/lib/notify';

export type DomainErrorCategory =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'BACKEND_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'SOURCE_UNAVAILABLE'
  | 'PARSER_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'INDEX_UNAVAILABLE'
  | 'REFERENCE_SYNC_ERROR'
  | 'REALTIME_DISCONNECTED'
  | 'UNKNOWN_ERROR';

export interface ApiErrorStateProps {
  category?: DomainErrorCategory;
  layout?: SystemStateLayout;
  title?: string;
  message?: string;
  statusCode?: number;
  errorCode?: string;
  requestId?: string;
  retry?: () => void;
  isRetrying?: boolean;
  technicalDetails?: string;
  className?: string;
}

export const ApiErrorState: React.FC<ApiErrorStateProps> = ({
  category = 'UNKNOWN_ERROR',
  layout = 'card',
  title: customTitle,
  message: customMessage,
  statusCode,
  errorCode,
  requestId = 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  retry,
  isRetrying = false,
  technicalDetails,
  className,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // Category content resolution
  const categoryConfig: Record<
    DomainErrorCategory,
    { title: string; message: string; icon?: any }
  > = {
    NETWORK_ERROR: {
      title: 'Unable to reach AirPulse services',
      message: 'Network connection interrupted or blocked by client proxy. Check your connection or retry.',
    },
    TIMEOUT: {
      title: 'Upstream gateway timed out',
      message: 'The statistical aggregation service took longer than the configured 15,000ms threshold to respond.',
    },
    UNAUTHORIZED: {
      title: 'Authentication required',
      message: 'Your active session has expired or requires institutional clearance. Please re-authenticate.',
    },
    FORBIDDEN: {
      title: 'Access restricted',
      message: 'Your current role does not possess the permissions required to query this endpoint or execute this action.',
    },
    NOT_FOUND: {
      title: 'Statistical resource not found',
      message: 'The specified corridor, observation ID, or run batch could not be located.',
    },
    VALIDATION_ERROR: {
      title: 'Invalid query parameters',
      message: 'The submitted date range, corridor pair, or filter syntax failed server-side Pydantic schema validation.',
    },
    RATE_LIMITED: {
      title: 'Too many requests (429)',
      message: 'AirPulse rate limiter active. Upstream scraping target or API concurrency threshold exceeded.',
    },
    BACKEND_UNAVAILABLE: {
      title: 'Backend service unavailable',
      message: 'AirPulse FastAPI backend service is temporarily offline or unreachable.',
    },
    DATABASE_UNAVAILABLE: {
      title: 'Database unavailable',
      message: 'AirPulse could not establish a connection to the PostgreSQL analytical data store. Dashboard metrics will not load.',
    },
    SOURCE_UNAVAILABLE: {
      title: 'Collection source unavailable',
      message: 'The selected airline direct or OTA portal could not be reached due to upstream network failure or transport timeout.',
    },
    PARSER_ERROR: {
      title: 'Fare extraction failed',
      message: 'The target source responded successfully, but the configured parser could not extract the fare structure.',
    },
    MODEL_UNAVAILABLE: {
      title: 'FareGuard / PriceGuard unavailable',
      message: 'Expected-fare and anomaly scoring models are temporarily unavailable. Observed raw fares and APIx remain intact.',
    },
    INDEX_UNAVAILABLE: {
      title: 'Insufficient data coverage for APIx',
      message: 'The daily Laspeyres index could not be computed because active route coverage fell below the mandatory 90% threshold.',
    },
    REFERENCE_SYNC_ERROR: {
      title: 'Reference data synchronization failed',
      message: 'AirPulse was unable to sync benchmark series from DGCA or MoSPI data portals.',
    },
    REALTIME_DISCONNECTED: {
      title: 'Realtime updates interrupted',
      message: 'WebSocket stream disconnected. Displayed data remains valid; automatic live refresh will resume upon reconnection.',
    },
    UNKNOWN_ERROR: {
      title: 'AirPulse could not complete this request',
      message: 'An unexpected system fault occurred while processing statistical records.',
    },
  };

  const selected = categoryConfig[category];
  const title = customTitle || selected.title;
  const message = customMessage || selected.message;

  const handleCopyRequestId = () => {
    if (requestId) {
      navigator.clipboard.writeText(requestId);
      setCopied(true);
      notify.copied('Request ID');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const metadataNode = (
    <div className="space-y-2 text-left w-full mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-slate-50 border border-[#E4E7EC] font-mono text-[11px] text-[#475467]">
        <div className="flex items-center gap-2">
          <span>Request ID:</span>
          <span className="font-bold text-[#101828]">{requestId}</span>
          <button
            onClick={handleCopyRequestId}
            className="p-1 hover:text-[#101828] rounded transition-colors"
            title="Copy Request ID"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        {statusCode && (
          <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
            HTTP {statusCode}
          </span>
        )}
      </div>

      {technicalDetails && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
          </button>

          {showDetails && (
            <pre className="mt-1.5 p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-tight border border-slate-800">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );

  return (
    <SystemState
      variant="error"
      layout={layout}
      title={title}
      description={message}
      primaryAction={retry ? { label: 'Retry Request', onClick: retry, isLoading: isRetrying } : undefined}
      secondaryAction={{ label: 'System Diagnostics', href: '/system' }}
      metadata={metadataNode}
      className={className}
    />
  );
};
