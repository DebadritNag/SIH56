/**
 * Runtime configuration resolved from NEXT_PUBLIC_* environment variables.
 *
 * The frontend reads business data through FastAPI (see lib/api). Supabase is used only
 * for auth and optional realtime. Never reference server-only secrets here.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const API_V1_PREFIX = process.env.NEXT_PUBLIC_API_V1_PREFIX || "/api/v1";

export const config = {
  /** FastAPI base, e.g. http://localhost:8000 */
  apiBaseUrl: API_BASE_URL.replace(/\/$/, ""),
  /** Versioned API prefix, e.g. /api/v1 */
  apiV1Prefix: API_V1_PREFIX,
  /** Full API v1 root, e.g. http://localhost:8000/api/v1 */
  apiV1Url: `${API_BASE_URL.replace(/\/$/, "")}${API_V1_PREFIX}`,

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",

  /**
   * Dev-only bearer token accepted by FastAPI when AUTH_STRICT=false. Used until a real
   * Supabase auth session is wired. Empty string disables it.
   */
  devBearerToken: process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN || "",

  /** Public hCaptcha sitekey for auth-form bot protection. Empty string disables the widget. */
  hcaptchaSitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "",
} as const;

export type AppConfig = typeof config;
