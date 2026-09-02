"use client";

/**
 * Filter-aware & Mode-aware dashboard hooks.
 *
 * Honors the canonical DashboardFilters object:
 * - dateRange { from, to, preset }
 * - routeIds
 * - sourceIds
 * - bookingWindows [1, 7, 15, 30, 45]
 * - compareMode
 *
 * Serializes stable normalized parameters into query keys so TanStack Query
 * handles cache deduplication and instant refetches on filter changes.
 */
import { useQuery } from "@tanstack/react-query";

import { endpoints } from "@/lib/api/endpoints";
import {
  mapDashboardSummary,
  mapNationalTrend,
  mapRouteContributors,
  mapSystemTrust,
} from "@/lib/api/mappers";
import {
  mockDashboardSummary,
  mockNationalTrend,
  mockUpwardContributors,
  mockDownwardContributors,
  mockSystemTrustMetrics,
  getFilteredMockDashboardSummary,
  getFilteredMockNationalTrend,
  getFilteredMockRouteContributors,
} from "@/lib/mock-data/dashboard";
import { useDataMode } from "@/lib/providers/DataModeProvider";
import { DashboardFilters } from "@/types";

export interface DataMeta {
  isMock: boolean;
  source: string;
  lastUpdated: string | null;
}

const REAL_SOURCE = "AirPulse backend (live)";
const MOCK_SOURCE = "Demo dataset (offline)";

export function serializeDashboardFilters(filters?: DashboardFilters) {
  if (!filters) {
    return {
      queryKeyPart: ["default"],
      queryParams: {},
    };
  }

  const sortedWindows = [...(filters.bookingWindows || [])].sort((a, b) => a - b);
  const sortedRoutes = [...(filters.routeIds || [])].sort();
  const sortedSources = [...(filters.sourceIds || [])].sort();
  const from = filters.dateRange?.from || "";
  const to = filters.dateRange?.to || "";
  const preset = filters.dateRange?.preset || "";
  const compare = filters.compareMode || "";

  const queryKeyPart = [
    from,
    to,
    preset,
    sortedRoutes.join(","),
    sortedSources.join(","),
    sortedWindows.join(","),
    compare,
  ];

  const queryParams: Record<string, string | number | undefined> = {};
  if (from) queryParams.from = from;
  if (to) queryParams.to = to;
  if (sortedRoutes.length > 0) queryParams.routes = sortedRoutes.join(",");
  if (sortedSources.length > 0) queryParams.sources = sortedSources.join(",");
  if (sortedWindows.length > 0) queryParams.booking_windows = sortedWindows.join(",");
  if (compare && compare !== "none") queryParams.compare = compare;

  return { queryKeyPart, queryParams };
}

export function useDashboardSummary(filters?: DashboardFilters) {
  const { mode } = useDataMode();
  const { queryKeyPart, queryParams } = serializeDashboardFilters(filters);

  const fallback = filters
    ? getFilteredMockDashboardSummary(filters)
    : mockDashboardSummary;

  const q = useQuery({
    queryKey: ["dashboard-summary", mode, ...queryKeyPart],
    queryFn: async ({ signal }) => {
      if (mode === "mock") {
        return { data: fallback, isMock: true };
      }
      try {
        const raw = await endpoints.dashboardSummary(queryParams, signal);
        return { data: mapDashboardSummary(raw), isMock: false };
      } catch {
        return { data: fallback, isMock: true };
      }
    },
    placeholderData: (prev) => prev ?? { data: fallback, isMock: true },
  });

  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    summary: q.data?.data ?? fallback,
    meta: {
      isMock,
      source: isMock ? MOCK_SOURCE : REAL_SOURCE,
      lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null,
    } as DataMeta,
  };
}

export function useNationalTrend(filters?: DashboardFilters) {
  const { mode } = useDataMode();
  const { queryKeyPart, queryParams } = serializeDashboardFilters(filters);

  const fallback = filters
    ? getFilteredMockNationalTrend(filters)
    : mockNationalTrend;

  const q = useQuery({
    queryKey: ["apix-trend", mode, ...queryKeyPart],
    queryFn: async ({ signal }) => {
      if (mode === "mock") {
        return { data: fallback, isMock: true };
      }
      try {
        const raw = await endpoints.indexTrend(queryParams, signal);
        return { data: mapNationalTrend(raw), isMock: false };
      } catch {
        return { data: fallback, isMock: true };
      }
    },
    placeholderData: (prev) => prev ?? { data: fallback, isMock: true },
  });

  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    trend: q.data?.data ?? fallback,
    meta: {
      isMock,
      source: isMock ? MOCK_SOURCE : REAL_SOURCE,
      lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null,
    } as DataMeta,
  };
}

export function useRouteContributors(filters?: DashboardFilters) {
  const { mode } = useDataMode();
  const { queryKeyPart, queryParams } = serializeDashboardFilters(filters);

  const fallback = filters
    ? getFilteredMockRouteContributors(filters)
    : { up: mockUpwardContributors, down: mockDownwardContributors };

  const q = useQuery({
    queryKey: ["top-route-movements", mode, ...queryKeyPart],
    queryFn: async ({ signal }) => {
      if (mode === "mock") {
        return { data: fallback, isMock: true };
      }
      try {
        const raw = await endpoints.topRouteMovements(queryParams, signal);
        return { data: mapRouteContributors(raw), isMock: false };
      } catch {
        return { data: fallback, isMock: true };
      }
    },
    placeholderData: (prev) => prev ?? { data: fallback, isMock: true },
  });

  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    contributors: q.data?.data ?? fallback,
    meta: {
      isMock,
      source: isMock ? MOCK_SOURCE : REAL_SOURCE,
      lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null,
    } as DataMeta,
  };
}

export function useBookingWindowSummary(filters?: DashboardFilters) {
  const { mode } = useDataMode();
  const { queryKeyPart, queryParams } = serializeDashboardFilters(filters);

  return useQuery({
    queryKey: ["booking-window-summary", mode, ...queryKeyPart],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return [];
      try {
        return await endpoints.bookingWindowSummary(queryParams, signal);
      } catch {
        return [];
      }
    },
  });
}

export function useSystemDiagnostics() {
  return useQuery({
    queryKey: ["system-diagnostics"],
    queryFn: async ({ signal }) => endpoints.systemDiagnostics(signal),
    staleTime: 15_000,
  });
}

export function useSystemTrust() {
  const { mode } = useDataMode();
  const q = useQuery({
    queryKey: ["system-trust", mode],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return { data: mockSystemTrustMetrics, isMock: true };
      try {
        return { data: mapSystemTrust(await endpoints.systemDiagnostics(signal)), isMock: false };
      } catch {
        return { data: mockSystemTrustMetrics, isMock: true };
      }
    },
    placeholderData: { data: mockSystemTrustMetrics, isMock: true },
  });
  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    trust: q.data?.data ?? mockSystemTrustMetrics,
    meta: {
      isMock,
      source: isMock ? MOCK_SOURCE : REAL_SOURCE,
      lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null,
    } as DataMeta,
  };
}
