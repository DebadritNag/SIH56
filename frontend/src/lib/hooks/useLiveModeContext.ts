"use client";

/**
 * useLiveModeContext — canonical Live Mode status hook.
 *
 * In REAL mode: polls /live-mode/status every 15s and returns the
 * DataContextResolver output (mode, counts, routes, windows, run history).
 *
 * In MOCK mode: returns a stable demo context (HYBRID with synthetic counts)
 * so the badge renders predictably in Demo Mode.
 *
 * STRICT RULE: SYNTHETIC/REPLAY counts must NEVER appear in the Live Mode
 * context. The backend enforces this; this hook just surfaces the result.
 */
import { useQuery } from "@tanstack/react-query";
import { endpoints, type LiveModeStatus } from "@/lib/api/endpoints";
import { useDataMode } from "@/lib/providers/DataModeProvider";

const MOCK_CONTEXT: LiveModeStatus = {
  mode: "HYBRID",
  mode_label: "HYBRID LIVE + IMPORTED",
  health_badge: null,
  live_count: 5,
  imported_count: 26,
  total_eligible: 31,
  routes: ["DEL-BOM", "BOM-BLR", "DEL-CCU"],
  booking_windows: [4, 8],
  booking_window_buckets: ["T+7"],
  historical_days: 7,
  earliest_departure: "2026-09-06",
  latest_departure: "2026-09-12",
  earliest_collected: "2026-09-02",
  latest_collected: "2026-09-08",
  apix_available: true,
  apix_count: 7,
  latest_apix_date: "2026-09-08",
  latest_live_collection_id: "demo-coll-001",
  latest_live_collection_date: "2026-09-08",
  latest_dataset_import_id: "demo-import-001",
  latest_dataset_import_date: "2026-09-03",
  latest_ingestion_run_id: "demo-ingest-001",
  latest_pipeline_run_id: "demo-pipe-001",
  dgca_benchmark_available: false,
  mospi_cpi_available: true,
  eligible_origins: ["LIVE", "IMPORTED"],
};

const EMPTY_CONTEXT: LiveModeStatus = {
  mode: "EMPTY",
  mode_label: "No data available",
  health_badge: null,
  live_count: 0,
  imported_count: 0,
  total_eligible: 0,
  routes: [],
  booking_windows: [],
  booking_window_buckets: [],
  historical_days: 0,
  earliest_departure: null,
  latest_departure: null,
  earliest_collected: null,
  latest_collected: null,
  apix_available: false,
  apix_count: 0,
  latest_apix_date: null,
  latest_live_collection_id: null,
  latest_live_collection_date: null,
  latest_dataset_import_id: null,
  latest_dataset_import_date: null,
  latest_ingestion_run_id: null,
  latest_pipeline_run_id: null,
  dgca_benchmark_available: false,
  mospi_cpi_available: false,
  eligible_origins: ["LIVE", "IMPORTED"],
};

export function useLiveModeContext() {
  const { mode } = useDataMode();
  const isMock = mode === "mock";

  const q = useQuery<LiveModeStatus>({
    queryKey: ["live-mode-context", mode],
    queryFn: async ({ signal }) => {
      if (isMock) return MOCK_CONTEXT;
      return endpoints.liveModeStatus(signal);
    },
    // Poll every 15 seconds so badge updates automatically when
    // new data is imported or a live collection run completes.
    refetchInterval: 15_000,
    staleTime: 10_000,
    // In real mode: do NOT use EMPTY_CONTEXT as placeholder — showing zeros
    // while the real fetch is pending causes the Overview to display
    // "—" / "0 routes" / stale latest_collected for several seconds.
    // Returning undefined means components can check isLoading and show a
    // proper skeleton instead of incorrect zeroed values.
    placeholderData: isMock ? MOCK_CONTEXT : undefined,
  });

  const ctx = q.data ?? (isMock ? MOCK_CONTEXT : EMPTY_CONTEXT);

  return {
    ctx,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    mode: ctx.mode,
    modeLabel: ctx.mode_label,
    healthBadge: ctx.health_badge,
    isPopulated: ctx.total_eligible > 0,
    isHybrid: ctx.mode === "HYBRID",
    isImportedFallback: ctx.mode === "IMPORTED_FALLBACK",
    isLiveData: ctx.mode === "LIVE_DATA",
    isEmpty: ctx.mode === "EMPTY",
  };
}
