"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * App-wide React Query provider. One client per browser session.
 * Realtime events (Supabase) will call queryClient.invalidateQueries(...) so the UI
 * refetches authoritative data from FastAPI (FastAPI stays the source of truth).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Backend data is near-real-time; keep it fresh but avoid hammering.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
