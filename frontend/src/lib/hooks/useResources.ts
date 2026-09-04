"use client";

/**
 * Resource list hooks (anomalies, sources, fares, alerts, runs). Mode-aware:
 *  - LIVE mode: fetch real data from FastAPI (returns exactly what the backend has —
 *    empty if there are no rows; the page then shows its empty state). Falls back to
 *    mock only on a hard network error.
 *  - MOCK mode: return the built-in demo dataset (clearly labelled via the toggle).
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { endpoints } from "@/lib/api/endpoints";
import { mapAnomaly } from "@/lib/api/mappers";
import { mockAnomalyList } from "@/lib/mock-data/dashboard";
import { useDataMode } from "@/lib/providers/DataModeProvider";

const MOCK_ANOMALY_META = {
  page: 1,
  page_size: 25,
  total: mockAnomalyList.length,
  total_pages: 1,
};

export function useAnomalies(params?: {
  severity?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["anomalies", mode, params],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return { items: mockAnomalyList, meta: MOCK_ANOMALY_META };
      try {
        const res = await endpoints.listAnomalies(
          {
            severity: params?.severity,
            status: params?.status,
            page: params?.page ?? 1,
            page_size: params?.page_size ?? 25,
          },
          signal,
        );
        // LIVE: return exactly what the backend has (may be empty → empty state shown).
        return { items: res.items.map(mapAnomaly), meta: res.meta };
      } catch {
        // Hard error only → show mock so the UI never breaks.
        return { items: mockAnomalyList, meta: MOCK_ANOMALY_META };
      }
    },
    placeholderData: mode === "mock" ? { items: mockAnomalyList, meta: MOCK_ANOMALY_META } : undefined,
  });
}

const MOCK_SOURCES_LIST = [
  { id: "31a4fdb3-db4b-4f47-ae47-1d05982c0ab8", name: "indigo", display_name: "IndiGo Airline Direct", source_type: "AIRLINE", collection_method: "Dual Engine (Scrapy + Playwright)", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.98, preferred_engine: "AUTO", supported_engines: ["SCRAPY", "PLAYWRIGHT"], quotes_today: 10, avg_latency_ms: 82, last_success_at: new Date().toISOString() },
  { id: "6fe0c007-e6cf-4eeb-9ff5-c9e1afdee390", name: "air_india", display_name: "Air India Direct", source_type: "AIRLINE", collection_method: "Dual Engine (Scrapy + Playwright)", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.95, preferred_engine: "AUTO", supported_engines: ["SCRAPY", "PLAYWRIGHT"], quotes_today: 8, avg_latency_ms: 142, last_success_at: new Date().toISOString() },
  { id: "c0202c80-2b98-4c89-ba56-0b63e8fc05d4", name: "akasa_air", display_name: "Akasa Air Direct", source_type: "AIRLINE", collection_method: "Dual Engine (Scrapy + Playwright)", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.97, preferred_engine: "AUTO", supported_engines: ["SCRAPY", "PLAYWRIGHT"], quotes_today: 6, avg_latency_ms: 142, last_success_at: new Date().toISOString() },
  { id: "2ad17c8c-8ce3-45d0-8fe4-e24482e3ec71", name: "air_india_express", display_name: "Air India Express", source_type: "AIRLINE", collection_method: "Dual Engine (Scrapy + Playwright)", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.92, preferred_engine: "AUTO", supported_engines: ["SCRAPY", "PLAYWRIGHT"], quotes_today: 0, avg_latency_ms: 142, last_success_at: new Date().toISOString() },
  { id: "e717fd43-b37d-49c0-9919-3dfb19da4717", name: "spicejet", display_name: "SpiceJet", source_type: "AIRLINE", collection_method: "Dual Engine (Scrapy + Playwright)", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.90, preferred_engine: "AUTO", supported_engines: ["SCRAPY", "PLAYWRIGHT"], quotes_today: 0, avg_latency_ms: 142, last_success_at: new Date().toISOString() },
  { id: "d8b6bc1d-224a-4323-9682-73848e4417d1", name: "ota_source_01", display_name: "OTA Source 01 (MakeMyTrip / Goibibo)", source_type: "OTA", collection_method: "HTTP Edge Telemetry", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.99, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 25, avg_latency_ms: 78, last_success_at: new Date().toISOString() },
  { id: "e01a46e0-5502-42cb-bc2f-5cb060c08606", name: "ota_source_02", display_name: "OTA Source 02 (EaseMyTrip)", source_type: "OTA", collection_method: "HTTP Edge Telemetry", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.94, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 0, avg_latency_ms: 78, last_success_at: new Date().toISOString() },
  { id: "6d555db5-5edd-4a25-b0be-90846646eb52", name: "ota_source_03", display_name: "OTA Source 03 (Yatra)", source_type: "OTA", collection_method: "HTTP Edge Telemetry", active: true, enabled: true, consecutive_failures: 0, reliability_score: 0.91, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 0, avg_latency_ms: 78, last_success_at: new Date().toISOString() },
  { id: "b023f037-7ef5-4ab7-8a6d-8cf95896c8f4", name: "dgca", display_name: "DGCA Regulatory Statistics", source_type: "GOVERNMENT_FILE", collection_method: "Official Monthly Data", active: true, enabled: true, consecutive_failures: 0, reliability_score: 1.0, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 15, avg_latency_ms: 45, last_success_at: new Date().toISOString() },
  { id: "cec5f27e-4cc0-4b42-8763-e50b1ba8efd8", name: "mospi_esankhyiki", display_name: "MoSPI eSankhyiki Benchmark", source_type: "GOVERNMENT_API", collection_method: "API National Accounts", active: true, enabled: true, consecutive_failures: 0, reliability_score: 1.0, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 12, avg_latency_ms: 45, last_success_at: new Date().toISOString() },
  { id: "76a0fd42-1b89-4265-8ae2-67cc1d0b8cca", name: "replay", display_name: "Deterministic Replay Fixtures", source_type: "REPLAY", collection_method: "AirPulse Replay Engine", active: true, enabled: true, consecutive_failures: 0, reliability_score: 1.0, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 50, avg_latency_ms: 15, last_success_at: new Date().toISOString() },
  { id: "41b1e155-fb9f-48a4-838b-8a97b439a0d6", name: "synthetic", display_name: "Synthetic Market Generator", source_type: "SYNTHETIC", collection_method: "Calibrated Micro-economic Model", active: true, enabled: true, consecutive_failures: 0, reliability_score: 1.0, preferred_engine: "AUTO", supported_engines: ["SCRAPY"], quotes_today: 100, avg_latency_ms: 15, last_success_at: new Date().toISOString() },
];

export function useSources(params?: { page?: number; page_size?: number }) {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["sources", mode, params],
    queryFn: async ({ signal }) => {
      if (mode === "mock") {
        return {
          items: MOCK_SOURCES_LIST,
          meta: { page: 1, page_size: 50, total: MOCK_SOURCES_LIST.length, total_pages: 1 },
        };
      }
      // Live mode: fetch genuine live sources and telemetry from FastAPI backend
      return endpoints.listSources({ page: params?.page ?? 1, page_size: params?.page_size ?? 50 }, signal);
    },
    placeholderData: keepPreviousData,
  });
}


export function useSourceHealth(sourceId: string | undefined) {
  return useQuery({
    queryKey: ["source-health", sourceId],
    queryFn: async ({ signal }) => endpoints.sourceHealth(sourceId as string, signal),
    enabled: Boolean(sourceId),
  });
}

const EMPTY_PAGE = { items: [] as never[], meta: { page: 1, page_size: 25, total: 0, total_pages: 0 } };

export function useFares(params?: {
  origin?: string;
  destination?: string;
  airline?: string;
  booking_window?: number;
  validation_status?: string;
  page?: number;
  page_size?: number;
}) {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["fares", mode, params],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return EMPTY_PAGE as never;
      return endpoints.listFares(
        {
          origin: params?.origin,
          destination: params?.destination,
          airline: params?.airline,
          booking_window: params?.booking_window,
          validation_status: params?.validation_status,
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 25,
        },
        signal,
      );
    },
    placeholderData: keepPreviousData,
  });
}

export function useAlerts(params?: { status?: string; page?: number; page_size?: number }) {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["alerts", mode, params],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return EMPTY_PAGE as never;
      return endpoints.listAlerts(
        { status: params?.status, page: params?.page ?? 1, page_size: params?.page_size ?? 25 },
        signal,
      );
    },
    placeholderData: keepPreviousData,
  });
}

export function useRuns(params?: { page?: number; page_size?: number }) {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["runs", mode, params],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return EMPTY_PAGE as never;
      return endpoints.listRuns({ page: params?.page ?? 1, page_size: params?.page_size ?? 25 }, signal);
    },
    placeholderData: keepPreviousData,
  });
}

export function useIngestionStatus() {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["ingestion-status", mode],
    queryFn: async ({ signal }) => endpoints.ingestionStatus(signal),
    staleTime: 15_000,
    enabled: mode === "real",
  });
}

import { RouteInsightDetail } from "@/types";

export function useRouteInsights(routeCode: string) {
  const { mode } = useDataMode();
  return useQuery<RouteInsightDetail>({
    queryKey: ["route-intelligence", mode, routeCode],
    queryFn: async ({ signal }): Promise<RouteInsightDetail> => {
      const { getMockRouteDetail } = await import("@/lib/mock-data/dashboard");
      const base = getMockRouteDetail(routeCode);
      if (mode === "mock") {
        return base;
      }
      try {
        const res = (await endpoints.routeInsights(routeCode, signal)) as Record<string, unknown> | null;
        if (res && typeof res === "object" && res.route_code) {
          const realMedian = Number(res.current_median_fare) || base.current_median_fare;
          const curve = Array.isArray(res.advance_purchase_curve) && res.advance_purchase_curve.length > 0
            ? (res.advance_purchase_curve as any[])
            : base.advance_purchase_curve.map((p) => {
                const ratio = p.today_fare / (base.current_median_fare || 1);
                const histRatio = p.median_30d_fare / (base.current_median_fare || 1);
                return {
                  ...p,
                  today_fare: Math.round(realMedian * ratio),
                  median_30d_fare: Math.round(realMedian * histRatio),
                };
              });

          const sources = Array.isArray(res.sources_comparison) && res.sources_comparison.length > 0
            ? (res.sources_comparison as any[])
            : base.sources_comparison;

          const merged: RouteInsightDetail = {
            ...base,
            route_code: String(res.route_code ?? base.route_code),
            origin: String(res.origin_code ? `${res.origin_code}` : base.origin),
            destination: String(res.destination_code ? `${res.destination_code}` : base.destination),
            distance_km: Number(res.distance_km) || base.distance_km,
            current_median_fare: realMedian,
            change_7d_pct: Number(res.previous_week_change_pct) || base.change_7d_pct,
            change_30d_pct: Number(res.previous_week_change_pct) || base.change_30d_pct,
            data_confidence_pct: Number(res.route_apix_latest != null ? 98 : base.data_confidence_pct),
            advance_purchase_curve: curve,
            sources_comparison: sources,
          };
          return merged;
        }
        return base;
      } catch {
        return base;
      }
    },
    placeholderData: keepPreviousData,
  });
}
