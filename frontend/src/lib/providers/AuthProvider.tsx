"use client";

/**
 * Supabase Auth context for AirPulse.
 *
 * - Tracks the current session/user from Supabase Auth.
 * - Syncs the access token into the FastAPI API client (setAccessToken) so every backend
 *   request carries Authorization: Bearer <supabase-jwt>. FastAPI validates it and
 *   resolves the role from the profiles table.
 * - Exposes signIn / signUp / signOut and loading/auth state.
 *
 * When Supabase env vars are absent (getSupabaseClient() === null) the app runs in a
 * degraded "no auth backend" mode: `configured` is false and the UI can offer a local
 * demo entry. The FastAPI dev-bearer fallback still lets the dashboard load locally.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase/client";
import { setAccessToken } from "@/lib/api/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True when a Supabase client is configured (env vars present). */
  configured: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    meta?: { full_name?: string; organization?: string },
    captchaToken?: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "airpulse.access_token";

function persistToken(token: string | null) {
  setAccessToken(token);
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const configured = supabase !== null;
  const [session, setSession] = useState<Session | null>(null);
  // Only "loading" when there is a Supabase client whose session we must resolve.
  const [loading, setLoading] = useState<boolean>(configured);

  useEffect(() => {
    if (!supabase) {
      // Not configured: nothing to resolve. `loading` already initialized to false.
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      persistToken(data.session?.access_token ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      persistToken(next?.access_token ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      if (!supabase) return { error: "Authentication is not configured." };
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      meta?: { full_name?: string; organization?: string },
      captchaToken?: string,
    ) => {
      if (!supabase) return { error: "Authentication is not configured.", needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: meta?.full_name, organization: meta?.organization },
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      // If email confirmation is enabled, there is a user but no active session yet.
      const needsConfirmation = Boolean(data.user) && !data.session;
      return { error: error?.message ?? null, needsConfirmation };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    persistToken(null);
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, configured, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
