import {
  DashboardSummary,
  NationalTrendPoint,
  RouteContributor,
  MarketSignal,
  SystemTrustMetrics,
  RouteInsightDetail,
  AnomalyItem,
  FareObservation,
  ScrapingTestResult
} from '@/types';

export const mockDashboardSummary: DashboardSummary = {
  latest_index: 108.43,
  daily_change_pct: 1.24,
  weekly_change_pct: 2.14,
  monthly_change_pct: 4.82,
  active_routes: 81,
  quotes_24h: 28452,
  open_anomalies: 24,
  critical_anomalies: 3,
  active_alerts: 5,
  healthy_sources: 4,
  total_sources: 5,
  coverage_quality_score: 0.948,
  market_pressure: 'ELEVATED',
  rapid_routes_count: 17,
  data_confidence_pct: 94.8,
};

export const mockNationalTrend: NationalTrendPoint[] = [
  { date: '2026-08-04', apix: 100.00, benchmark_cpi: 100.00, daily_pct: 0.00, weekly_pct: 0.00, monthly_pct: 0.00, coverage_pct: 96.2 },
  { date: '2026-08-07', apix: 100.82, benchmark_cpi: 100.25, daily_pct: 0.35, weekly_pct: 0.82, monthly_pct: 0.82, coverage_pct: 95.8 },
  { date: '2026-08-11', apix: 101.45, benchmark_cpi: 100.50, daily_pct: 0.22, weekly_pct: 1.15, monthly_pct: 1.45, coverage_pct: 96.0 },
  { date: '2026-08-14', apix: 102.90, benchmark_cpi: 100.80, daily_pct: 0.78, weekly_pct: 2.10, monthly_pct: 2.90, coverage_pct: 94.5, annotation: 'Independence Weekend Surge' },
  { date: '2026-08-18', apix: 102.40, benchmark_cpi: 101.10, daily_pct: -0.48, weekly_pct: -0.50, monthly_pct: 2.40, coverage_pct: 96.4 },
  { date: '2026-08-22', apix: 103.85, benchmark_cpi: 101.40, daily_pct: 0.65, weekly_pct: 1.45, monthly_pct: 3.85, coverage_pct: 95.1 },
  { date: '2026-08-25', apix: 105.20, benchmark_cpi: 101.75, daily_pct: 0.42, weekly_pct: 2.70, monthly_pct: 5.20, coverage_pct: 95.8 },
  { date: '2026-08-28', apix: 106.90, benchmark_cpi: 102.10, daily_pct: 0.85, weekly_pct: 3.05, monthly_pct: 6.90, coverage_pct: 94.8, annotation: 'Festive Advance Booking Shift' },
  { date: '2026-08-30', apix: 107.19, benchmark_cpi: 102.30, daily_pct: 0.27, weekly_pct: 3.20, monthly_pct: 7.19, coverage_pct: 95.0 },
  { date: '2026-09-01', apix: 107.10, benchmark_cpi: 102.45, daily_pct: -0.08, weekly_pct: 1.80, monthly_pct: 4.60, coverage_pct: 96.1 },
  { date: '2026-09-02', apix: 108.43, benchmark_cpi: 102.60, daily_pct: 1.24, weekly_pct: 2.14, monthly_pct: 4.82, coverage_pct: 94.8 },
];

export const mockUpwardContributors: RouteContributor[] = [
  { route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight_pct: 14.2, change_pct: 11.4, apix_contribution: 0.38, direction: 'up', current_median_fare: 7420 },
  { route: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight_pct: 11.5, change_pct: 8.9, apix_contribution: 0.31, direction: 'up', current_median_fare: 6850 },
  { route: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight_pct: 9.8, change_pct: 7.2, apix_contribution: 0.24, direction: 'up', current_median_fare: 5400 },
  { route: 'DEL-CCU', origin: 'DEL', destination: 'CCU', weight_pct: 7.1, change_pct: 6.8, apix_contribution: 0.19, direction: 'up', current_median_fare: 6150 },
  { route: 'HYD-DEL', origin: 'HYD', destination: 'DEL', weight_pct: 6.4, change_pct: 5.3, apix_contribution: 0.14, direction: 'up', current_median_fare: 5650 },
];

export const mockDownwardContributors: RouteContributor[] = [
  { route: 'BOM-GOI', origin: 'BOM', destination: 'GOI', weight_pct: 4.2, change_pct: -8.4, apix_contribution: -0.16, direction: 'down', current_median_fare: 3200 },
  { route: 'DEL-COK', origin: 'DEL', destination: 'COK', weight_pct: 3.8, change_pct: -5.1, apix_contribution: -0.09, direction: 'down', current_median_fare: 5900 },
  { route: 'BLR-PNQ', origin: 'BLR', destination: 'PNQ', weight_pct: 2.9, change_pct: -4.3, apix_contribution: -0.06, direction: 'down', current_median_fare: 3600 },
  { route: 'CCU-GAU', origin: 'CCU', destination: 'GAU', weight_pct: 2.1, change_pct: -3.8, apix_contribution: -0.04, direction: 'down', current_median_fare: 2850 },
];

export const mockMarketSignals: MarketSignal[] = [
  {
    id: 'SIG-101',
    timestamp: '17:42 IST',
    severity: 'HIGH',
    category: 'PRICE SURGE',
    title: 'DEL → BOM Fares Increased 18.2%',
    description: 'Elevated fares observed across 4 independent sources for T+1 and T+7 travel windows.',
    route: 'DEL-BOM',
  },
  {
    id: 'SIG-102',
    timestamp: '16:15 IST',
    severity: 'SHOCK',
    category: 'MARKET EVENT',
    title: 'BLR → DEL Multi-Source Price Shock',
    description: 'PriceGuard identified synchronous 22.4% escalation confirmed by both Airline Direct and 2 OTAs.',
    route: 'BLR-DEL',
  },
  {
    id: 'SIG-103',
    timestamp: '15:30 IST',
    severity: 'SOURCE',
    category: 'DATA PIPELINE',
    title: 'OTA Source 03 Collection Degraded',
    description: 'Empty results rate increased to 7.8% on short-haul tier-2 routes; rate limits engaged.',
    source: 'OTA 03',
  },
  {
    id: 'SIG-104',
    timestamp: '15:00 IST',
    severity: 'INDEX',
    category: 'INDEX RELEASE',
    title: 'APIx Reaches 108.43 in Latest Run',
    description: 'National index rose +1.24 pts driven by western & northern business corridors.',
  },
  {
    id: 'SIG-105',
    timestamp: '13:20 IST',
    severity: 'DATA',
    category: 'COVERAGE AUDIT',
    title: 'Route Window Coverage at 91.8%',
    description: 'T+45 advance purchase quotes sampled below 90% threshold for regional eastern corridors.',
  },
];

export const mockSystemTrustMetrics: SystemTrustMetrics = {
  source_coverage_pct: 96,
  route_coverage_pct: 94,
  booking_window_coverage_pct: 91,
  freshness_pct: 98,
  validation_success_pct: 97.4,
};

export const mockRouteDetailDelBom: RouteInsightDetail = {
  route_code: 'DEL-BOM',
  origin: 'Delhi (DEL)',
  destination: 'Mumbai (BOM)',
  distance_km: 1148,
  traffic_weight_pct: 14.2,
  market_status: 'ELEVATED',
  data_confidence_pct: 97,
  current_median_fare: 7420,
  change_7d_pct: 11.4,
  change_30d_pct: 18.2,
  advance_purchase_curve: [
    { days_prior: 45, window_label: 'T+45', today_fare: 4650, median_30d_fare: 4500 },
    { days_prior: 30, window_label: 'T+30', today_fare: 5120, median_30d_fare: 4950 },
    { days_prior: 15, window_label: 'T+15', today_fare: 6280, median_30d_fare: 5800 },
    { days_prior: 7,  window_label: 'T+7',  today_fare: 7950, median_30d_fare: 6900 },
    { days_prior: 1,  window_label: 'T+1',  today_fare: 11840, median_30d_fare: 9850 },
  ],
  sources_comparison: [
    { source_name: 'Airline Direct (IndiGo & Air India)', source_type: 'Airline Direct', median_fare: 7380, min_fare: 6850, observations: 342, freshness: '2m ago', agreement_status: 'Agreement', reliability_score: 0.99 },
    { source_name: 'OTA Source 01 (MakeMyTrip)', source_type: 'OTA', median_fare: 7450, min_fare: 6920, observations: 218, freshness: '3m ago', agreement_status: 'Agreement', reliability_score: 0.98 },
    { source_name: 'OTA Source 02 (EaseMyTrip)', source_type: 'OTA', median_fare: 7410, min_fare: 6810, observations: 194, freshness: '4m ago', agreement_status: 'Agreement', reliability_score: 0.96 },
    { source_name: 'OTA Source 03 (Cleartrip)', source_type: 'OTA', median_fare: 7520, min_fare: 6990, observations: 152, freshness: '6m ago', agreement_status: 'Agreement', reliability_score: 0.92 },
  ]
};

export const mockAnomalyList: AnomalyItem[] = [
  {
    id: 'anm-1842',
    code: 'ANM-1842',
    timestamp: '02 Sep 2026 • 15:42 IST',
    severity: 'HIGH',
    route: 'DEL-BOM',
    booking_window: 'T+1 (1 Day)',
    airline: 'IndiGo (6E-2041)',
    source: 'OTA Source 01',
    actual_fare: 11200,
    expected_fare: 7100,
    deviation_pct: 57.7,
    percentile: 99.2,
    status: 'open',
    evidence: {
      flight_number: '6E-2041',
      departure_time: '03 Sep 2026 06:15 IST',
      base_fare: 9800,
      taxes: 1150,
      fees: 250,
      collection_time: '02 Sep 2026 15:42:08 IST',
      raw_response_hash: 'a9f24c7e81b6e45d911b3320f3a44d18ce54687d993e3d93',
      collector_version: 'ota01-v1.4',
    },
    shap_factors: [
      { feature: 'T+1 booking lead window', contribution_inr: 1320, description: 'Short booking lead time constraint' },
      { feature: 'Festival proximity (Ganesh Chaturthi)', contribution_inr: 740, description: 'Seasonal cultural calendar surge' },
      { feature: 'Route load factor / demand proxy', contribution_inr: 520, description: 'Elevated morning departure demand' },
      { feature: 'Peak Friday business departure', contribution_inr: 310, description: 'Business commute timing factor' },
      { feature: 'Aviation turbine fuel context', contribution_inr: 120, description: 'Recent ATF spot benchmark adjustment' },
    ],
    cross_source_check: [
      { source_name: 'Airline Direct (IndiGo)', observed_fare: 10980, status: 'Confirmed within 2.0%' },
      { source_name: 'OTA Source 01', observed_fare: 11200, status: 'Trigger Source' },
      { source_name: 'OTA Source 02', observed_fare: 11140, status: 'Confirmed within 0.5%' },
      { source_name: 'OTA Source 03', observed_fare: 10920, status: 'Confirmed within 2.5%' },
    ],
  },
  {
    id: 'anm-1843',
    code: 'ANM-1843',
    timestamp: '02 Sep 2026 • 15:38 IST',
    severity: 'CRITICAL',
    route: 'BLR-DEL',
    booking_window: 'T+1 (1 Day)',
    airline: 'Air India (AI-503)',
    source: 'Airline Direct',
    actual_fare: 14850,
    expected_fare: 8900,
    deviation_pct: 66.8,
    percentile: 99.8,
    status: 'open',
    evidence: {
      flight_number: 'AI-503',
      departure_time: '03 Sep 2026 09:30 IST',
      base_fare: 13200,
      taxes: 1400,
      fees: 250,
      collection_time: '02 Sep 2026 15:38:12 IST',
      raw_response_hash: 'e81a30b467e98d249f011933c09b88219468bf039478aa91',
      collector_version: 'carrier-direct-v2.1',
    },
    shap_factors: [
      { feature: 'Single remaining seat bucket', contribution_inr: 2850, description: 'Inventory depletion multiplier' },
      { feature: 'T+1 booking lead window', contribution_inr: 1400, description: 'Emergency travel premium' },
      { feature: 'Corporate business hour slot', contribution_inr: 650, description: 'Prime morning slot demand' },
    ],
    cross_source_check: [
      { source_name: 'Airline Direct (Air India)', observed_fare: 14850, status: 'Trigger Source' },
      { source_name: 'OTA Source 01', observed_fare: 14850, status: 'Exact Agreement' },
      { source_name: 'OTA Source 02', observed_fare: 14920, status: 'Agreement (+0.4%)' },
      { source_name: 'OTA Source 03', observed_fare: 14800, status: 'Agreement (-0.3%)' },
    ],
  },
  {
    id: 'anm-1844',
    code: 'ANM-1844',
    timestamp: '02 Sep 2026 • 14:20 IST',
    severity: 'MEDIUM',
    route: 'BOM-CCU',
    booking_window: 'T+7 (7 Days)',
    airline: 'SpiceJet (SG-422)',
    source: 'OTA Source 02',
    actual_fare: 9200,
    expected_fare: 6400,
    deviation_pct: 43.7,
    percentile: 88.4,
    status: 'investigating',
    evidence: {
      flight_number: 'SG-422',
      departure_time: '09 Sep 2026 17:45 IST',
      base_fare: 8100,
      taxes: 950,
      fees: 150,
      collection_time: '02 Sep 2026 14:20:00 IST',
      raw_response_hash: 'b78a9c049d113426e9f9024c8033ef1904a883190cb64d29',
      collector_version: 'ota02-v1.3',
    },
    shap_factors: [
      { feature: 'Durga Puja advance booking surge', contribution_inr: 1800, description: 'Kolkata festive corridor demand' },
      { feature: 'Route capacity reduction', contribution_inr: 720, description: 'Carrier flight schedule adjustment' },
    ],
    cross_source_check: [
      { source_name: 'Airline Direct (SpiceJet)', observed_fare: 9150, status: 'Agreement' },
      { source_name: 'OTA Source 01', observed_fare: 9240, status: 'Agreement' },
      { source_name: 'OTA Source 02', observed_fare: 9200, status: 'Trigger Source' },
      { source_name: 'OTA Source 03', observed_fare: 9180, status: 'Agreement' },
    ],
  },
];

export const mockScrapingTestSuccess: ScrapingTestResult = {
  success: true,
  source: 'OTA Source 01 (MakeMyTrip)',
  route: 'DEL → BOM',
  departure_date: '09 Sep 2026',
  booking_window: 'T+7',
  capture_timestamp: '02 Sep 2026 • 17:52:14 IST',
  http_status: 200,
  response_size_kb: 184.6,
  quotes_found: 18,
  quotes_valid: 17,
  quotes_rejected: 1,
  response_hash: '4d8a0c5fe3718b2c45e89d1b649a37c9802f4316ee0a719d26fb563a34ef0281',
  collector_version: 'ota01-v1.4.2',
  parser_version: 'parser-delbom-v2.0',
  extracted_fares: [
    { airline: 'IndiGo', flight_number: '6E-5021', departure_time: '06:00 IST', cabin: 'Economy', base_fare: 6200, taxes: 1050, total: 7250, validation_status: 'VALID' },
    { airline: 'IndiGo', flight_number: '6E-2041', departure_time: '07:15 IST', cabin: 'Economy', base_fare: 6400, taxes: 1080, total: 7480, validation_status: 'VALID' },
    { airline: 'Air India', flight_number: 'AI-865', departure_time: '08:00 IST', cabin: 'Economy', base_fare: 6800, taxes: 1120, total: 7920, validation_status: 'VALID' },
    { airline: 'Vistara / AI', flight_number: 'UK-995', departure_time: '10:20 IST', cabin: 'Economy', base_fare: 7100, taxes: 1180, total: 8280, validation_status: 'VALID' },
    { airline: 'Akasa Air', flight_number: 'QP-1102', departure_time: '11:45 IST', cabin: 'Economy', base_fare: 5900, taxes: 1020, total: 6920, validation_status: 'VALID' },
    { airline: 'IndiGo', flight_number: '6E-2114', departure_time: '14:30 IST', cabin: 'Economy', base_fare: 6100, taxes: 1050, total: 7150, validation_status: 'VALID' },
    { airline: 'SpiceJet', flight_number: 'SG-8169', departure_time: '16:00 IST', cabin: 'Economy', base_fare: 5800, taxes: 990, total: 6790, validation_status: 'VALID' },
    { airline: 'Unknown Corrupt', flight_number: 'XX-000', departure_time: '00:00', cabin: 'Unknown', base_fare: -500, taxes: 0, total: -500, validation_status: 'REJECTED (Negative Fare)' },
  ],
  raw_evidence_json: JSON.stringify({
    collector: 'ota01-v1.4.2',
    request_headers: {
      'User-Agent': 'AirPulse-Price-Intelligence/1.0 (+https://airpulse.gov.in/bot; MoSPI-CPI-Augmentation)',
      'Accept': 'application/json, text/plain, */*',
      'X-Request-Trace': 'ap-req-delbom-20260902-175214'
    },
    http_meta: {
      status: 200,
      duration_ms: 1240,
      endpoint: 'https://partner-feed.ota01.in/v2/flights/search',
      payload_sha256: '4d8a0c5fe3718b2c45e89d1b649a37c9802f4316ee0a719d26fb563a34ef0281'
    }
  }, null, 2)
};

export const mockScrapingTestFailure: ScrapingTestResult = {
  success: false,
  source: 'OTA Source 03 (Cleartrip)',
  route: 'DEL → BOM',
  departure_date: '09 Sep 2026',
  booking_window: 'T+7',
  capture_timestamp: '02 Sep 2026 • 17:54:02 IST',
  http_status: 429,
  response_size_kb: 2.1,
  quotes_found: 0,
  quotes_valid: 0,
  quotes_rejected: 0,
  response_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  collector_version: 'ota03-v1.2.0',
  parser_version: 'parser-ota03-v1.1',
  extracted_fares: [],
  raw_evidence_json: '{ error: Too Many Requests, retry_after_sec: 300, stage: RATE_LIMIT_ENGAGED}',
  failure_diagnostic: {
    stage: 'RATE_LIMIT_429',
    reason: 'Upstream source engaged exponential backoff threshold. Rate limit token bucket exhausted.',
    last_success: '42 minutes ago',
    recommended_action: 'Switch to asynchronous worker delay or failover to secondary OTA mirror.'
  }
};

export const mockBacktestPoints = [
  { month: 'Sep 23', apix: 98.4, cpi_transport: 99.1, dgca_fare: 98.8 },
  { month: 'Oct 23', apix: 104.2, cpi_transport: 102.8, dgca_fare: 103.5 },
  { month: 'Nov 23', apix: 108.5, cpi_transport: 106.4, dgca_fare: 107.1 },
  { month: 'Dec 23', apix: 115.8, cpi_transport: 112.0, dgca_fare: 114.2 },
  { month: 'Jan 24', apix: 102.1, cpi_transport: 105.8, dgca_fare: 104.0 },
  { month: 'Feb 24', apix: 99.6, cpi_transport: 101.4, dgca_fare: 100.2 },
  { month: 'Mar 24', apix: 101.4, cpi_transport: 100.8, dgca_fare: 101.1 },
  { month: 'Apr 24', apix: 105.2, cpi_transport: 103.5, dgca_fare: 104.2 },
  { month: 'May 24', apix: 112.4, cpi_transport: 108.9, dgca_fare: 110.5 },
  { month: 'Jun 24', apix: 109.8, cpi_transport: 108.2, dgca_fare: 109.0 },
  { month: 'Jul 24', apix: 103.2, cpi_transport: 104.5, dgca_fare: 103.8 },
  { month: 'Aug 24', apix: 108.4, cpi_transport: 107.1, dgca_fare: 108.0 },
];

