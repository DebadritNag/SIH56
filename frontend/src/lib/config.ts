/**
 * Runtime configuration resolved from NEXT_PUBLIC_* environment variables.
 *
 * API calls go through the Next.js proxy route (/api/proxy/...) which:
 *   - In local dev: tries http://localhost:8000 first, falls back to the EC2 backend
 *   - On Vercel / production: goes directly to the EC2 backend via NEXT_PUBLIC_API_BASE_URL
 *
 * The browser never hits the external backend directly (no CORS issues).
 * The EC2 IP is never hardcoded here — it lives only in next.config.ts rewrites
 * and in the NEXT_PUBLIC_API_BASE_URL environment variable.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/backend-api";
const API_V1_PREFIX = process.env.NEXT_PUBLIC_API_V1_PREFIX || "/api/v1";

/** Same-origin proxy path — always works, no CORS. */
const PROXY_V1 = "/api/proxy";

export const config = {
  /** FastAPI base URL (used by the server-side proxy; not called directly by the browser). */
  apiBaseUrl: API_BASE_URL.replace(/\/$/, ""),

  /** Versioned API prefix, e.g. /api/v1 */
  apiV1Prefix: API_V1_PREFIX,

  /**
   * The URL the browser-side API client uses for all requests.
   * Points at the same-origin Next.js proxy (/api/proxy) so:
   *   • No CORS issues in any environment.
   *   • Local dev auto-tries localhost:8000 before falling back to EC2.
   *   • Vercel always proxies to EC2 via the Next.js rewrite in next.config.ts.
   */
  apiV1Url: PROXY_V1,

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",

  /**
   * Local-dev bearer token accepted by FastAPI when AUTH_STRICT=false.
   * Supabase auth session is wired. Empty string disables it.
   */
  devBearerToken: process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN || "",

  /** Public hCaptcha sitekey for auth-form bot protection. Empty string disables the widget. */
  hcaptchaSitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "",
} as const;
