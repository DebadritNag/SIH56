'use client';

import React from 'react';
import {
  FileQuestion,
  SearchX,
  AlertCircle,
  ZapOff,
  BellOff,
  PlaneTakeoff,
  Database,
  Calendar,
  Layers
} from 'lucide-react';
import { SystemState, SystemStateLayout } from './SystemState';

export interface EmptyStateProps {
  layout?: SystemStateLayout;
  onAction?: () => void;
  onSecondary?: () => void;
  className?: string;
}

/**
 * 1. Overview Empty State: When APIx has not yet been computed
 */
export const EmptyIndexState: React.FC<EmptyStateProps> = ({ layout = 'card', onAction, onSecondary, className }) => (
  <SystemState
    variant="empty"
    layout={layout}
    icon={Layers}
    title="APIx has not been calculated yet"
    description="AirPulse requires validated fare observations across the active route basket before the daily Laspeyres index can be generated."
    primaryAction={
      onAction
        ? { label: 'Run Collection Now', onClick: onAction }
        : { label: 'Go to Data Ingestion', href: '/ingestion' }
    }
    secondaryAction={
      onSecondary
        ? { label: 'Use Replay Dataset', onClick: onSecondary }
        : { label: 'View Methodology', href: '/methodology' }
    }
    className={className}
  />
);

/**
 * 2. No Fare Observations: Selected filters yield no valid observations
 */
export const EmptyFaresState: React.FC<
  EmptyStateProps & { activeFilters?: string }
> = ({ layout = 'table-cell', activeFilters, onAction, onSecondary, className }) => (
  <SystemState
    variant="empty"
    layout={layout}
    icon={SearchX}
    title="No fare observations available"
    description={
      activeFilters
        ? `No valid observations were recorded matching ${activeFilters}. Fares are never assumed to be zero.`
        : 'No valid observations were recorded for the selected corridor, period, or booking-window filters.'
    }
    primaryAction={{ label: 'Clear Filters', onClick: onAction }}
    secondaryAction={{ label: 'Change Date Range', onClick: onSecondary }}
    className={className}
  />
);

/**
 * 3. No Anomalies Detected (PriceGuard)
 */
export const EmptyAnomaliesState: React.FC<EmptyStateProps> = ({ layout = 'table-cell', className }) => (
  <SystemState
    variant="success"
    layout={layout}
    icon={AlertCircle}
    title="No anomalies detected"
    description="PriceGuard has not identified unusual validated fare observations exceeding the configured multivariate contamination threshold (0.04) for this period."
    className={className}
  />
);

/**
 * 4. No Active Price Shocks
 */
export const EmptyShocksState: React.FC<EmptyStateProps> = ({ layout = 'table-cell', className }) => (
  <SystemState
    variant="empty"
    layout={layout}
    icon={ZapOff}
    title="No active market-wide price shocks"
    description="No synchronous multi-source route surge currently meets the configured price shock criteria (synchronous +30% across &ge;3 independent portals)."
    className={className}
  />
);

/**
 * 5. No Active Alerts
 */
export const EmptyAlertsState: React.FC<EmptyStateProps> = ({ layout = 'card', className }) => (
  <SystemState
    variant="empty"
    layout={layout}
    icon={BellOff}
    title="No active alerts"
    description="There are no unresolved operational, market surge, or data quality alerts requiring immediate analyst intervention."
    className={className}
  />
);

/**
 * 6. No Search Results Found
 */
export const EmptySearchResultsState: React.FC<EmptyStateProps> = ({
  layout = 'table-cell',
  onAction,
  className,
}) => (
  <SystemState
    variant="not-found"
    layout={layout}
    icon={SearchX}
    title="No matching results"
    description="Try adjusting the route corridor, data source, booking window, or validation status query."
    primaryAction={onAction ? { label: 'Reset Search & Filters', onClick: onAction } : undefined}
    className={className}
  />
);

/**
 * 7. Route Not Monitored: Route is valid airport pair but outside active DGCA basket
 */
export const RouteNotMonitoredState: React.FC<
  EmptyStateProps & { routeCode?: string; basketVersion?: string }
> = ({ layout = 'card', routeCode = 'Corridor', basketVersion = '2026-Q3', onAction, className }) => (
  <SystemState
    variant="warning"
    layout={layout}
    icon={PlaneTakeoff}
    title="Route not currently monitored"
    description={`${routeCode} is not currently included in the active AirPulse 81-route representative basket (Basket Version: ${basketVersion}).`}
    primaryAction={
      onAction
        ? { label: 'View Basket Configuration', onClick: onAction }
        : { label: 'View Monitored Corridors', href: '/routes' }
    }
    secondaryAction={{ label: 'Official Methodology', href: '/methodology' }}
    className={className}
  />
);
