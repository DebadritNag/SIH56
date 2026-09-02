"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Hydration-safe "are we on the client yet?" flag.
 *
 * Returns false during SSR and the first client render (matching server markup), then
 * true afterwards — without a synchronous setState-in-effect (uses useSyncExternalStore,
 * the React-recommended pattern for server/client-divergent values).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
