export type DataOrigin = 'LIVE' | 'REPLAY' | 'SYNTHETIC' | 'IMPORTED' | 'REFERENCE';
export type SourceStatus = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'DISABLED';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyStatus = 'open' | 'investigating' | 'confirmed' | 'dismissed';
export type PipelineStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type MarketPressure =
  | 'NORMAL'
  | 'ELEVATED'
  | 'HIGH PRESSURE'
  | 'STABLE'
  | 'MODERATE_PRESSURE'
  | 'SURGING'
  | 'COLLAPSING';

export interface DashboardSummary {
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
  coverage_quality_score: number;
  market_pressure: MarketPressure;
  rapid_routes_count: number;
  data_confidence_pct: number;
}

export interface NationalTrendPoint {
  date: string;
  apix: number;
  benchmark_cpi: number;
  daily_pct: number;
  weekly_pct: number;
  monthly_pct: number;
  coverage_pct: number;
  annotation?: string;
}

export interface RouteContributor {
  route: string;
  origin: string;
  destination: string;
  weight_pct: number;
  change_pct: number;
  apix_contribution: number;
  direction: 'up' | 'down';
  current_median_fare: number;
}

export interface MarketSignal {
  id: string;
  timestamp: string;
  severity: 'HIGH' | 'SHOCK' | 'SOURCE' | 'INDEX' | 'DATA';
  category: string;
  title: string;
  description: string;
  route?: string;
  source?: string;
}

export interface SystemTrustMetrics {
  source_coverage_pct: number;
  route_coverage_pct: number;
  booking_window_coverage_pct: number;
  freshness_pct: number;
  validation_success_pct: number;
}

export interface RouteInsightDetail {
  route_code: string;
  origin: string;
  destination: string;
  distance_km: number;
  traffic_weight_pct: number;
  market_status: MarketPressure;
  data_confidence_pct: number;
  current_median_fare: number;
  change_7d_pct: number;
  change_30d_pct: number;
  advance_purchase_curve: {
    days_prior: number;
    window_label: string;
    today_fare: number;
    median_30d_fare: number;
  }[];
  sources_comparison: {
    source_name: string;
    source_type: 'Airline Direct' | 'OTA';
    median_fare: number;
    min_fare: number;
    observations: number;
    freshness: string;
    agreement_status: 'Agreement' | 'Divergent' | 'Degraded';
    reliability_score: number;
  }[];
}

export interface AnomalyItem {
  id: string;
  code: string;
  timestamp: string;
  severity: AnomalySeverity;
  route: string;
  booking_window: string;
  airline: string;
  source: string;
  actual_fare: number;
  expected_fare: number;
  deviation_pct: number;
  percentile: number;
  status: AnomalyStatus;
  evidence: {
    flight_number: string;
    departure_time: string;
    base_fare: number;
    taxes: number;
    fees: number;
    collection_time: string;
    raw_response_hash: string;
    collector_version: string;
  };
  shap_factors: {
    feature: string;
    contribution_inr: number;
    description: string;
  }[];
  cross_source_check: {
    source_name: string;
    observed_fare: number;
    status: string;
  }[];
}

export interface FareObservation {
  id: string;
  collected_at: string;
  route: string;
  departure_date: string;
  booking_window: string;
  airline: string;
  flight_number: string;
  source: string;
  base_fare: number;
  taxes: number;
  fees: number;
  total_fare: number;
  validation_status: 'VALID' | 'REJECTED' | 'FLAGGED';
  anomaly_status: 'NORMAL' | 'ANOMALOUS';
  origin_type: DataOrigin;
  provenance: {
    collection_run_id: string;
    response_hash: string;
    collector_version: string;
    parser_version: string;
    fareguard_prediction: number;
    priceguard_score: number;
    index_eligible: boolean;
    pipeline_steps: { step: string; timestamp: string; status: string }[];
  };
}

export interface ScrapingTestStep {
  step_number: number;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
  duration_ms?: number;
}

export interface ScrapingTestResult {
  success: boolean;
  source: string;
  route: string;
  departure_date: string;
  booking_window: string;
  capture_timestamp: string;
  http_status: number;
  response_size_kb: number;
  quotes_found: number;
  quotes_valid: number;
  quotes_rejected: number;
  response_hash: string;
  collector_version: string;
  parser_version: string;
  is_fallback?: boolean;
  fallback_reason?: string;
  extracted_fares: {
    airline: string;
    flight_number: string;
    departure_date?: string;
    departure_time: string;
    cabin: string;
    base_fare: number;
    taxes: number;
    total: number;
    validation_status: string;
  }[];
  raw_evidence_json: string;
  failure_diagnostic?: {
    stage: string;
    reason: string;
    last_success: string;
    recommended_action: string;
  };
}

// ---------------------------------------------------------------------------
// Export & Download Center Types
// ---------------------------------------------------------------------------
export type ExportType =
  | 'FARE_OBSERVATIONS'
  | 'APIX_INDEX'
  | 'APIX_COMPONENTS'
  | 'ROUTE_INTELLIGENCE'
  | 'BOOKING_WINDOW_ANALYSIS'
  | 'ANOMALIES'
  | 'PRICE_SHOCKS'
  | 'ALERTS'
  | 'SOURCE_HEALTH'
  | 'COLLECTION_RUN'
  | 'PIPELINE_RUN'
  | 'INGESTION_REPORT'
  | 'DATA_QUALITY'
  | 'BACKTEST_DATA'
  | 'BACKTEST_AUDIT_PDF'
  | 'METHODOLOGY_REPORT'
  | 'PROVENANCE_REPORT'
  | 'REFERENCE_DATASET'
  | 'BASKET_DEFINITION'
  | 'MODEL_REPORT'
  | 'SYSTEM_DIAGNOSTICS_REPORT'
  | 'SYSTEM_SELF_TEST_REPORT'
  | 'OVERVIEW_REPORT'
  | 'CHART_IMAGE';

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF' | 'PNG' | 'JSON' | 'ZIP';
export type ExportStatus = 'QUEUED' | 'GENERATING' | 'UPLOADING' | 'READY' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface ExportJob {
  id: string;
  requested_by?: string;
  export_type: ExportType;
  export_format: ExportFormat;
  title: string;
  description?: string;
  filename: string;
  status: ExportStatus;
  progress_percent?: number;
  current_stage?: string;
  filters?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string;
  file_size_bytes?: number;
  row_count?: number;
  page_count?: number;
  checksum_sha256?: string;
  data_origin: string;
  generated_at?: string;
  expires_at?: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  job_metadata?: Record<string, unknown>;
}

export interface CreateExportInput {
  export_type: ExportType;
  format: ExportFormat;
  title?: string;
  description?: string;
  filters?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface ExportDownloadInfo {
  download_url: string;
  filename: string;
  mime_type: string;
  file_size_bytes?: number;
  checksum_sha256?: string;
  expires_at?: string;
}

export type DateRangePreset = '7D' | '30D' | '3M' | '6M' | '1Y' | 'BASE_AUG2026';

export interface DashboardFilters {
  dateRange: {
    from: string;
    to: string;
    preset?: DateRangePreset | string;
  };
  routeIds: string[];
  sourceIds: string[];
  bookingWindows: number[];
  compareMode?: string | null;
}
