"use client";

/**
 * Supabase Realtime -> TanStack Query bridge.
 *
 * Implements the BRAIN.md realtime pattern: FastAPI/Celery mutate operational tables ->
 * Supabase Realtime broadcasts the change -> this hook receives it -> it invalidates the
 * matching React Query cache keys -> the UI refetches the authoritative result from
 * FastAPI. FastAPI stays the single source of truth; realtime only signals "refresh now".
 *
 * Only the operational tables added to the `supabase_realtime` publication emit events:
 *   collection_runs, pipeline_runs, pipeline_steps, scraping_test_runs,
 *   alerts, anomalies, source_health_logs, airfare_index
 * High-volume fare tables are intentionally NOT subscribed.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase/client";

export type RealtimeStatus = "disabled" | "connecting" | "connected" | "error";

// Map each realtime table to the query keys it should invalidate on change.
const TABLE_INVALIDATIONS: Record<string, string[][]> = {
  collection_runs: [["ingestion-status"], ["runs"], ["dashboard-summary"]],
  pipeline_runs: [["ingestion-status"], ["runs"]],
  // A completed APIx pipeline step should refresh the dashboard + index views.
  pipeline_steps: [
    ["ingestion-status"],
    ["dashboard-summary"],
    ["apix-trend"],
    ["apix-latest"],
    ["top-route-movements"],
  ],
  scraping_test_runs: [["scraping-test"]],
  alerts: [["alerts"], ["dashboard-summary"]],
  anomalies: [["anomalies"], ["dashboard-summary"]],
  source_health_logs: [["sources"], ["source-health"], ["dashboard-summary"]],
  airfare_index: [["apix-latest"], ["apix-trend"], ["dashboard-summary"]],
};

const REALTIME_TABLES = Object.keys(TABLE_INVALIDATIONS);

/**
 * Subscribe to operational-table changes and invalidate matching queries.
 * Returns the current connection status for optional UI display.
 */
export function useRealtimeSubscription(): { status: RealtimeStatus } {
  const queryClient = useQueryClient();
  // Start "connecting" for BOTH server render and first client render so the markup
  // matches (avoids hydration mismatch). The effect then resolves it to disabled/
  // connected/error after mount, where getSupabaseClient() is meaningful.
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Defer off the synchronous effect path to avoid a cascading-render warning.
      const t = setTimeout(() => setStatus("disabled"), 0);
      return () => clearTimeout(t);
    }

    const channel = supabase.channel("airpulse-operational");

    for (const table of REALTIME_TABLES) {
      channel.on(
        // postgres_changes payloads for INSERT/UPDATE/DELETE
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const keys = TABLE_INVALIDATIONS[table] ?? [];
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        },
      );
    }

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") setStatus("connected");
      else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("error");
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return { status };
}
