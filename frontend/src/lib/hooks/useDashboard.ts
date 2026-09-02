"use client";

/**
 * Dashboard data hooks. Each fetches real data from FastAPI and maps it to the frontend
 * UI types. On network/backend error the mapped mock is returned so the UI degrades
 * gracefully (real data where the backend is complete, mock where it is not).
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

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async ({ signal }) => mapDashboardSummary(await endpoints.dashboardSummary(signal)),
    placeholderData: mockDashboardSummary,
  });
}

export function useNationalTrend() {
  return useQuery({
    queryKey: ["apix-trend"],
    queryFn: async ({ signal }) => mapNationalTrend(await endpoints.indexTrend(signal)),
    placeholderData: mockNationalTrend,
  });
}

export function useRouteContributors() {
  return useQuery({
    queryKey: ["top-route-movements"],
    queryFn: async ({ signal }) => mapRouteContributors(await endpoints.topRouteMovements(signal)),
    placeholderData: { up: mockUpwardContributors, down: mockDownwardContributors },
  });
}

export function useBookingWindowSummary() {
  return useQuery({
    queryKey: ["booking-window-summary"],
    queryFn: async ({ signal }) => endpoints.bookingWindowSummary(signal),
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
  return useQuery({
    queryKey: ["system-trust"],
    queryFn: async ({ signal }) => mapSystemTrust(await endpoints.systemDiagnostics(signal)),
    placeholderData: mockSystemTrustMetrics,
  });
}
