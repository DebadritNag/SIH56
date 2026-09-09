/** Browser requests use the existing same-origin /backend-api rewrite to EC2. */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/backend-api";
const API_V1_PREFIX = process.env.NEXT_PUBLIC_API_V1_PREFIX || "/api/v1";

/** Same-origin proxy path — always works, no CORS. */
const API_V1_URL = `${API_BASE_URL.replace(/\/$/, "")}/${API_V1_PREFIX.replace(/^\//, "")}`;

export const config = {
  /** FastAPI base URL (used by the server-side proxy; not called directly by the browser). */
  apiBaseUrl: API_BASE_URL.replace(/\/$/, ""),

  /** Versioned API prefix, e.g. /api/v1 */
  apiV1Prefix: API_V1_PREFIX,

  /** Versioned same-origin API URL; backend host stays in next.config.ts. */
  apiV1Url: API_V1_URL,

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
