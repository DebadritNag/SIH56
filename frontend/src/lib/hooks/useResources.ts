"use client";

/**
 * Resource list hooks (anomalies, sources, fares, alerts, runs). Real data from FastAPI
 * with mock fallback where noted, plus pagination passthrough.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { endpoints } from "@/lib/api/endpoints";
import { mapAnomaly } from "@/lib/api/mappers";
import { mockAnomalyList } from "@/lib/mock-data/dashboard";

export function useAnomalies(params?: {
  severity?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["anomalies", params],
    queryFn: async ({ signal }) => {
      const res = await endpoints.listAnomalies(
        {
          severity: params?.severity,
          status: params?.status,
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 25,
        },
        signal,
      );
      return { items: res.items.map(mapAnomaly), meta: res.meta };
    },
    // Show mock anomalies until the backend has real rows.
    placeholderData: { items: mockAnomalyList, meta: { page: 1, page_size: 25, total: mockAnomalyList.length, total_pages: 1 } },
  });
}

export function useSources(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["sources", params],
    queryFn: async ({ signal }) =>
      endpoints.listSources({ page: params?.page ?? 1, page_size: params?.page_size ?? 50 }, signal),
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

export function useFares(params?: {
  origin?: string;
  destination?: string;
  airline?: string;
  booking_window?: number;
  validation_status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["fares", params],
    queryFn: async ({ signal }) =>
      endpoints.listFares(
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
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAlerts(params?: { status?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["alerts", params],
    queryFn: async ({ signal }) =>
      endpoints.listAlerts(
        { status: params?.status, page: params?.page ?? 1, page_size: params?.page_size ?? 25 },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useRuns(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["runs", params],
    queryFn: async ({ signal }) =>
      endpoints.listRuns({ page: params?.page ?? 1, page_size: params?.page_size ?? 25 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIngestionStatus() {
  return useQuery({
    queryKey: ["ingestion-status"],
    queryFn: async ({ signal }) => endpoints.ingestionStatus(signal),
    staleTime: 15_000,
  });
}
