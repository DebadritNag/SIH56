/**
 * Browser-side Supabase client.
 *
 * Used ONLY for auth and realtime subscriptions (never as the primary business-data
 * layer — that goes through FastAPI). Instantiated lazily and cached so a single
 * websocket connection is shared across the app.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. If either is
 * missing (e.g. realtime disabled in an environment), getSupabaseClient() returns null
 * and realtime features degrade gracefully.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { config } from "@/lib/config";

let cached: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  if (typeof window === "undefined" || !config.supabaseUrl || !config.supabaseAnonKey) {
    cached = null;
    return cached;
  }

  cached = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
