/**
 * Map raw backend response shapes to the frontend UI types (src/types).
 *
 * These are defensive: any field the backend does not yet populate falls back to a
 * sensible default or the corresponding mock value, so the UI renders real data where
 * the backend is complete and mock data where it is not.
 */
import {
  DashboardSummary,
  NationalTrendPoint,
  RouteContributor,
  AnomalyItem,
  SystemTrustMetrics,
} from "@/types";
import {
  mockDashboardSummary,
  mockNationalTrend,
  mockSystemTrustMetrics,
} from "@/lib/mock-data/dashboard";
import type {
  BackendDashboardSummary,
  BackendIndexTrendPoint,
  BackendRouteMovement,
  BackendAnomaly,
  BackendSystemDiagnostics,
} from "@/lib/api/endpoints";

function derivePressure(monthlyChange: number): DashboardSummary["market_pressure"] {
  if (monthlyChange >= 6) return "SURGING";
  if (monthlyChange >= 3) return "ELEVATED";
  if (monthlyChange <= -3) return "COLLAPSING";
  return "STABLE";
}

export function mapDashboardSummary(b: BackendDashboardSummary): DashboardSummary {
  const coverage = b.coverage_quality_score ?? mockDashboardSummary.coverage_quality_score;
  return {
    latest_index: b.latest_index,
    daily_change_pct: b.daily_change_pct,
    weekly_change_pct: b.weekly_change_pct,
    monthly_change_pct: b.monthly_change_pct,
    active_routes: b.active_routes,
    quotes_24h: b.quotes_24h,
    open_anomalies: b.open_anomalies,
    critical_anomalies: b.critical_anomalies,
    active_alerts: b.active_alerts,
    healthy_sources: b.healthy_sources,
    total_sources: b.total_sources,
    coverage_quality_score: coverage,
    // Fields not yet emitted by the backend summary — derive or fall back to mock.
    market_pressure: derivePressure(b.monthly_change_pct),
    rapid_routes_count: mockDashboardSummary.rapid_routes_count,
    data_confidence_pct: coverage * 100,
  };
}

export function mapNationalTrend(points: BackendIndexTrendPoint[]): NationalTrendPoint[] {
  if (!points || points.length === 0) return mockNationalTrend;
  return points.map((p, i) => {
    const prev = i > 0 ? points[i - 1].index_value : p.index_value;
    const daily = prev ? ((p.index_value - prev) / prev) * 100 : 0;
    return {
      date: p.date,
      apix: p.index_value,
      // Backend index-trend does not yet include a CPI benchmark; approximate for display.
      benchmark_cpi: Number((100 + (p.index_value - 100) * 0.55).toFixed(2)),
      daily_pct: Number(daily.toFixed(2)),
      weekly_pct: 0,
      monthly_pct: Number((p.index_value - 100).toFixed(2)),
      coverage_pct: 95,
    };
  });
}

export function mapRouteContributors(
  movements: BackendRouteMovement[],
): { up: RouteContributor[]; down: RouteContributor[] } {
  const up: RouteContributor[] = [];
  const down: RouteContributor[] = [];
  for (const m of movements ?? []) {
    const [origin = "", destination = ""] = m.route.split("-");
    const contributor: RouteContributor = {
      route: m.route,
      origin,
      destination,
      weight_pct: 0,
      change_pct: m.change_pct,
      apix_contribution: Number(((m.change_pct / 100) * 2).toFixed(2)),
      direction: m.direction,
      current_median_fare: m.current_median,
    };
    (m.direction === "down" ? down : up).push(contributor);
  }
  return { up, down };
}

const SEVERITY_MAP: Record<string, AnomalyItem["severity"]> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

const STATUS_MAP: Record<string, AnomalyItem["status"]> = {
  OPEN: "open",
  UNDER_REVIEW: "investigating",
  CONFIRMED: "confirmed",
  DISMISSED: "dismissed",
  RESOLVED: "confirmed",
  open: "open",
  investigating: "investigating",
  confirmed: "confirmed",
  dismissed: "dismissed",
};

export function mapAnomaly(a: BackendAnomaly): AnomalyItem {
  const actual = a.actual_fare ?? 0;
  const expected = a.expected_fare ?? 0;
  const deviation =
    expected > 0 ? ((actual - expected) / expected) * 100 : (a.residual_pct ?? 0);
  return {
    id: a.id,
    code: `ANM-${a.id.slice(0, 6).toUpperCase()}`,
    timestamp: a.detected_at ?? "",
    severity: SEVERITY_MAP[a.severity ?? ""] ?? "MEDIUM",
    route: (a.route_id as string) ?? "—",
    booking_window: "—",
    airline: "—",
    source: (a.source_id as string) ?? "—",
    actual_fare: actual,
    expected_fare: expected,
    deviation_pct: Number(deviation.toFixed(1)),
    percentile: (a.anomaly_percentile ?? 0) * 100,
    status: STATUS_MAP[a.status ?? ""] ?? "open",
    evidence: {
      flight_number: "—",
      departure_time: "—",
      base_fare: 0,
      taxes: 0,
      fees: 0,
      collection_time: a.detected_at ?? "—",
      raw_response_hash: "—",
      collector_version: "—",
    },
    shap_factors: [],
    cross_source_check: [],
  };
}

export function mapSystemTrust(d: BackendSystemDiagnostics): SystemTrustMetrics {
  // The diagnostics endpoint focuses on infra health; coverage sub-scores are not all
  // computed yet, so fall back to mock for the ones the backend does not provide.
  return {
    ...mockSystemTrustMetrics,
    freshness_pct: d.database === "connected" ? mockSystemTrustMetrics.freshness_pct : 0,
  };
}
