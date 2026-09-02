"use client";

/**
 * Mode-aware dashboard hooks.
 *
 * REAL mode: fetch from FastAPI. On error, fall back to mock (explicitly flagged isMock).
 * MOCK mode: return the built-in demo dataset (always flagged isMock=true).
 *
 * Each hook returns the React Query result PLUS { isMock, source, lastUpdated } so the UI
 * can render a MOCK/LIVE badge and source + last-updated timestamp.
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
} from "@/lib/mock-data/dashboard";
import { useDataMode } from "@/lib/providers/DataModeProvider";

export interface DataMeta {
  isMock: boolean;
  source: string;
  lastUpdated: string | null;
}

const REAL_SOURCE = "AirPulse backend (live)";
const MOCK_SOURCE = "Demo dataset (offline)";

export function useDashboardSummary() {
  const { mode } = useDataMode();
  const q = useQuery({
    queryKey: ["dashboard-summary", mode],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return { data: mockDashboardSummary, isMock: true };
      try {
        return { data: mapDashboardSummary(await endpoints.dashboardSummary(signal)), isMock: false };
      } catch {
        return { data: mockDashboardSummary, isMock: true };
      }
    },
    placeholderData: { data: mockDashboardSummary, isMock: true },
  });
  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    summary: q.data?.data ?? mockDashboardSummary,
    meta: { isMock, source: isMock ? MOCK_SOURCE : REAL_SOURCE, lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null } as DataMeta,
  };
}

export function useNationalTrend() {
  const { mode } = useDataMode();
  const q = useQuery({
    queryKey: ["apix-trend", mode],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return { data: mockNationalTrend, isMock: true };
      try {
        return { data: mapNationalTrend(await endpoints.indexTrend(signal)), isMock: false };
      } catch {
        return { data: mockNationalTrend, isMock: true };
      }
    },
    placeholderData: { data: mockNationalTrend, isMock: true },
  });
  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    trend: q.data?.data ?? mockNationalTrend,
    meta: { isMock, source: isMock ? MOCK_SOURCE : REAL_SOURCE, lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null } as DataMeta,
  };
}

export function useRouteContributors() {
  const { mode } = useDataMode();
  const fallback = { up: mockUpwardContributors, down: mockDownwardContributors };
  const q = useQuery({
    queryKey: ["top-route-movements", mode],
    queryFn: async ({ signal }) => {
      if (mode === "mock") return { data: fallback, isMock: true };
      try {
        return { data: mapRouteContributors(await endpoints.topRouteMovements(signal)), isMock: false };
      } catch {
        return { data: fallback, isMock: true };
      }
    },
    placeholderData: { data: fallback, isMock: true },
  });
  const isMock = q.data?.isMock ?? true;
  return {
    ...q,
    contributors: q.data?.data ?? fallback,
    meta: { isMock, source: isMock ? MOCK_SOURCE : REAL_SOURCE, lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null } as DataMeta,
  };
}

export function useBookingWindowSummary() {
  const { mode } = useDataMode();
  return useQuery({
    queryKey: ["booking-window-summary", mode],
    queryFn: async ({ signal }) => (mode === "mock" ? [] : endpoints.bookingWindowSummary(signal)),
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
    meta: { isMock, source: isMock ? MOCK_SOURCE : REAL_SOURCE, lastUpdated: q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null } as DataMeta,
  };
}
