/**
 * Typed endpoint functions for the AirPulse FastAPI backend.
 *
 * These return the RAW backend shapes (unwrapped from the response envelope).
 * Mapping to the frontend UI types lives in lib/api/mappers.ts. Hooks in
 * lib/hooks/* compose these with mock fallback.
 */
import { getData, getPaginated, postData, patchData, type Paginated } from "@/lib/api/client";

// --- Raw backend response shapes --------------------------------------------
export interface BackendDashboardSummary {
  latest_index: number;
  daily_change_pct: number;
  weekly_change_pct: number;
  monthly_change_pct: number;
  active_routes: number;
  quotes_24h: number;
  open_anomalies: number;
  critical_anomalies: number;
  active_alerts: number;
  healthy_sources: number;
  total_sources: number;
  coverage_quality_score?: number;
}

export interface BackendIndexTrendPoint {
  date: string;
  index_value: number;
}

export interface BackendRouteMovement {
  route: string;
  market: string;
  change_pct: number;
  direction: "up" | "down";
  current_median: number;
}

export interface BackendBookingWindow {
  window: string;
  avg_fare: number;
  relative_index: number;
  sample_share_pct: number;
}

export interface BackendSource {
  id: string;
  name: string;
  display_name?: string | null;
  source_type: string;
  collection_method?: string;
  enabled?: boolean;
  active?: boolean;
  consecutive_failures?: number;
  reliability_score?: number | null;
  last_success_at?: string | null;
  preferred_engine?: string;
  supported_engines?: string[];
  scrapy_enabled?: boolean;
  playwright_enabled?: boolean;
  last_successful_engine?: string | null;
  last_attempted_engine?: string | null;
}

export interface BackendSourceHealth {
  source_id: string;
  source_name: string;
  status: string;
  reliability_score: number | null;
  success_rate_24h: number;
  avg_latency_ms: number;
  records_24h: number;
  consecutive_failures: number;
  last_checked_at: string;
}

export interface BackendAnomaly {
  id: string;
  fare_id?: string | null;
  route_id?: string | null;
  source_id?: string | null;
  anomaly_score?: number | null;
  anomaly_percentile?: number | null;
  severity?: string | null;
  status?: string | null;
  anomaly_type?: string | null;
  actual_fare?: number | null;
  expected_fare?: number | null;
  residual?: number | null;
  residual_pct?: number | null;
  detected_at?: string | null;
  [key: string]: unknown;
}

export interface BackendValidatedFare {
  id: string;
  airline: string;
  flight_number?: string | null;
  origin: string;
  destination: string;
  departure_at: string;
  booking_window_days: number;
  base_fare: number;
  taxes?: number;
  total_fare: number;
  normalized_total_fare?: number;
  validation_status: string;
  is_duplicate?: boolean;
  collected_at: string;
  [key: string]: unknown;
}

export interface BackendSystemDiagnostics {
  database: string;
  database_latency_ms: number | null;
  supabase_project: string;
  realtime: string;
  realtime_tables?: string[];
  storage: string;
  auth: string;
  latest_migration: string | null;
  raw_fare_count?: number;
  validated_fare_count?: number;
  latest_collection?: string | null;
  latest_index_value?: number | null;
  timestamp?: string;
}

export interface BackendIngestionStatus {
  [key: string]: unknown;
}

// --- Endpoint functions ------------------------------------------------------
export const endpoints = {
  // Dashboard
  dashboardSummary: (query?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getData<BackendDashboardSummary>("/dashboard/summary", query, signal),
  indexTrend: (query?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getData<BackendIndexTrendPoint[]>("/dashboard/index-trend", query, signal),
  topRouteMovements: (query?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getData<BackendRouteMovement[]>("/dashboard/top-route-movements", query, signal),
  bookingWindowSummary: (query?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getData<BackendBookingWindow[]>("/dashboard/booking-window-summary", query, signal),

  // Index (APIx)
  latestIndex: (signal?: AbortSignal) => getData<unknown>("/index/latest", undefined, signal),
  indexSeries: (query?: Record<string, string | number>, signal?: AbortSignal) =>
    getData<unknown>("/index", query, signal),

  // Fares
  listFares: (
    query?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<Paginated<BackendValidatedFare>> => getPaginated("/fares", query, signal),
  fareProvenance: (fareId: string, signal?: AbortSignal) =>
    getData<unknown>(`/fares/${fareId}`, undefined, signal),

  // Anomalies
  listAnomalies: (
    query?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<Paginated<BackendAnomaly>> => getPaginated("/anomalies", query, signal),
  anomaly: (id: string, signal?: AbortSignal) =>
    getData<BackendAnomaly>(`/anomalies/${id}`, undefined, signal),

  // Sources
  listSources: (
    query?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<Paginated<BackendSource>> => getPaginated("/sources", query, signal),
  sourceHealth: (id: string, signal?: AbortSignal) =>
    getData<BackendSourceHealth>(`/sources/${id}/health`, undefined, signal),

  // Routes
  listRoutes: (
    query?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<Paginated<Record<string, unknown>>> => getPaginated("/routes", query, signal),
  routeInsights: (id: string, signal?: AbortSignal) =>
    getData<unknown>(`/routes/${id}/insights`, undefined, signal),

  // Ingestion
  ingestionStatus: (signal?: AbortSignal) =>
    getData<BackendIngestionStatus>("/ingestion/status", undefined, signal),
  listRuns: (query?: Record<string, string | number>, signal?: AbortSignal) =>
    getPaginated<Record<string, unknown>>("/ingestion/runs", query, signal),
  datasets: (signal?: AbortSignal) => getData<unknown>("/ingestion/datasets", undefined, signal),

  // Alerts
  listAlerts: (
    query?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<Paginated<Record<string, unknown>>> => getPaginated("/alerts", query, signal),

  // Backtest
  listBacktests: (signal?: AbortSignal) => getPaginated<Record<string, unknown>>("/backtest/runs", undefined, signal),

  // Methodology
  methodology: (signal?: AbortSignal) => getData<unknown>("/methodology/current", undefined, signal),

  // System diagnostics (Supabase-aware)
  systemDiagnostics: (signal?: AbortSignal) =>
    getData<BackendSystemDiagnostics>("/system/supabase-diagnostics", undefined, signal),

  // Mutations
  triggerCollection: () => postData<unknown>("/ingestion/collect"),

  // Live scraping verification (real network fetch, per-filter)
  runScrapingTest: (payload: {
    source_name?: string;
    origin: string;
    destination: string;
    departure_date: string;
    booking_window_days: number;
    mode?: string;
    engine?: "AUTO" | "SCRAPY" | "PLAYWRIGHT" | string;
    compare?: boolean;
    max_results?: number;
    is_nonstop?: boolean;
  }) => postData<ScrapingTestApiResult>("/ingestion/scraping-test", payload),

  // Source Engine Management
  updateSourceEngine: (
    sourceId: string,
    payload: {
      preferred_engine?: string;
      scrapy_enabled?: boolean;
      playwright_enabled?: boolean;
      requires_javascript?: boolean;
    },
  ) => patchData<BackendSource>(`/sources/${sourceId}/engine`, payload),
} as const;

export interface ScrapingTestStageApi {
  stage: string;
  status: "passed" | "warning" | "failed";
  detail?: string;
  failure_stage?: string;
  http_status?: number;
  response_hash?: string;
}

export interface ScrapingTestApiResult {
  status: "PASSED" | "PARTIAL" | "FAILED";
  source?: string;
  route?: string;
  departure_date?: string;
  http_status?: number | null;
  response_hash?: string | null;
  quotes_found: number;
  quotes_validated: number;
  quotes_rejected: number;
  duration_ms: number;
  failure_stage?: string;
  failure_reason?: string;
  recommended_remediation?: string;
  collector_version?: string;
  last_successful_run?: string;
  stages: ScrapingTestStageApi[];
  quotes: Array<Record<string, unknown>>;
  is_live: boolean;
  is_fallback?: boolean;
  fallback_reason?: string;
  collection_engine?: string;
  comparison?: Record<string, unknown>;
  browser_engine?: string;
  browser_version?: string;
  browser_executable?: string;
  browser_launch_status?: string;
  results_seen?: number;
  results_matching?: number;
  results_collected?: number;
  max_results?: number;
  stop_reason?: string;
}
