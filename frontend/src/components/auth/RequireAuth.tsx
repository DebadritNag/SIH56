"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/providers/AuthProvider";
import { useIsClient } from "@/lib/hooks/useIsClient";

/**
 * Client-side route guard for the dashboard.
 *
 * - While the session is resolving, shows a lightweight loader (no flicker).
 * - If Supabase auth IS configured and there is no session → redirect to /login.
 * - If Supabase auth is NOT configured (local dev), allow through — the API client
 *   falls back to the dev bearer token so the dashboard still works offline of Supabase.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, loading, configured } = useAuth();
  // Gate on client so server render (where Supabase client is null) and the first client
  // render agree, avoiding a hydration mismatch. Auth is enforced only after mount.
  const mounted = useIsClient();

  const mustAuthenticate = mounted && configured && !loading && !session;

  useEffect(() => {
    if (mustAuthenticate) router.replace("/login");
  }, [mustAuthenticate, router]);

  // Resolving session, or a redirect is imminent → show a minimal loader.
  if (mounted && configured && (loading || !session)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050B18]">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
          Verifying secure session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
