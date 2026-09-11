"use client";

/**
 * Canonical downstream-invalidation utility.
 *
 * Call `invalidateAfterIngestion(queryClient, mode)` once after any ingestion,
 * live collection, or replay completes. This ensures every dashboard page that
 * depends on canonical fare/anomaly/index data is refreshed together so there
 * is no window where Overview shows "2 anomalies" while Anomaly Center shows
 * "20 anomalies".
 *
 * Rule: update this list when new derived pages are added — never maintain two
 * independent partial lists scattered across mutation handlers.
 */
import type { QueryClient } from "@tanstack/react-query";

/** All query-key prefixes whose data is derived from ingested fare observations. */
export const CANONICAL_QUERY_PREFIXES = [
  // Live mode context — includes latest_collected timestamp and data mode
  ["live-mode-context"],
  // Dashboard summary (anomaly count, quotes, routes, APIx index)
  ["dashboard-summary"],
  // APIx charts and basket
  ["apix-trend"],
  ["apix-latest"],
  ["top-route-movements"],
  ["booking-window-summary"],
  // Anomalies and alerts (sidebar badges + Anomaly Center + Overview signals)
  ["anomalies"],
  ["alerts"],
  // Price shocks (sidebar badge + Price Shock Center)
  ["price-shocks"],
  // Observation tables
  ["fares"],
  // Ingestion / pipeline views
  ["ingestion-status"],
  ["runs"],
  ["live-runs"],
  ["live-run"],
  // Observation history (Overview progressive chart)
  ["obs-history"],
  // Sources / source health
  ["sources"],
  ["source-health"],
] as const;

/**
 * Invalidate all canonical downstream queries after a successful ingestion or
 * live-scraping-to-ingestion cycle. Uses `refetchType: 'active'` so only
 * currently-mounted queries are immediately re-fetched; background queries are
 * simply marked stale and re-fetched when their component next mounts.
 *
 * Does NOT use a bare `invalidateQueries()` (no-args nuclear call) because that
 * also invalidates provider-internal queries, auth queries, and other unrelated
 * infrastructure keys.
 */
export async function invalidateAfterIngestion(
  queryClient: QueryClient,
  _mode?: string,        // reserved for future mode-scoped invalidation
): Promise<void> {
  await Promise.all(
    CANONICAL_QUERY_PREFIXES.map((key) =>
      queryClient.invalidateQueries({ queryKey: key, refetchType: "active" }),
    ),
  );
}

/**
 * Lighter variant: invalidate only collection-level metadata (latest collection
 * time, live-mode-context, source health) after a collection run completes but
 * BEFORE ingestion runs. Does NOT invalidate fare/anomaly tables because those
 * are only updated after ingestion.
 */
export async function invalidateAfterCollection(
  queryClient: QueryClient,
): Promise<void> {
  const collectionKeys = [
    ["live-mode-context"],
    ["live-runs"],
    ["live-run"],
    ["sources"],
    ["source-health"],
    ["dashboard-summary"],   // includes latest_collected in summary response
  ] as const;

  await Promise.all(
    collectionKeys.map((key) =>
      queryClient.invalidateQueries({ queryKey: key, refetchType: "active" }),
    ),
  );
}
