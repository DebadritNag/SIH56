"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * App-wide React Query provider. One client per browser session.
 *
 * staleTime = 0: operational dashboard data (anomaly counts, collection status,
 * fare tables) must always reflect the latest committed backend state. A 30-second
 * stale window was causing pages to display old anomaly/observation counts for
 * up to 30 seconds after a new ingestion completed — the "2 anomalies → 20
 * anomalies" flash bug. With staleTime=0 React Query still serves cached data
 * instantly for fast navigation, but marks it stale immediately so a background
 * refetch starts the moment any component is (re-)mounted.
 *
 * gcTime = 3 min: keep cache long enough for fast back-navigation but not so
 * long that invalidated data lingers in memory.
 *
 * Realtime events (Supabase) will call queryClient.invalidateQueries(...) so the
 * UI refetches authoritative data from FastAPI (FastAPI stays the source of truth).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // staleTime: 0 means every query is considered stale immediately after
            // it resolves — React Query serves cached data instantly for navigation
            // but triggers a background refetch so fresh data arrives quickly.
            staleTime: 0,
            gcTime: 3 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
