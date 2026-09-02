/**
 * Typed fetch client for the AirPulse FastAPI backend.
 *
 * - Prefixes requests with the configured API v1 URL.
 * - Attaches the Authorization: Bearer <token> header (Supabase JWT when available,
 *   otherwise the dev bearer token for local development).
 * - Unwraps the backend envelopes:
 *     APIResponse       -> { success, data, meta }
 *     PaginatedResponse -> { success, data: [...], meta: { page, page_size, total, total_pages } }
 * - Throws ApiError on non-2xx so React Query can surface/fallback cleanly.
 */
import { config } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

// --- auth token resolution ---------------------------------------------------
let inMemoryToken: string | null = null;

/** Set/clear the current access token (called after Supabase sign-in/out). */
export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
}

function resolveToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  // Browser: a Supabase session token may be stored by the auth layer later.
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("airpulse.access_token");
    if (stored) return stored;
  }
  // Fallback to the dev token for local development.
  return config.devBearerToken || null;
}

// --- core request ------------------------------------------------------------
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${config.apiV1Url}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal } = options;
  const token = resolveToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (err) {
    // Network-level failure (backend down, CORS, DNS). Surface as ApiError(0).
    throw new ApiError(
      err instanceof Error ? err.message : "Network request failed",
      0,
      "NETWORK_ERROR",
    );
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const errObj =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: string; message?: string; details?: unknown } }).error
        : undefined;
    throw new ApiError(
      errObj?.message || `Request failed with status ${res.status}`,
      res.status,
      errObj?.code,
      errObj?.details,
    );
  }

  return payload as T;
}

// --- envelope helpers --------------------------------------------------------
interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

/** GET an APIResponse endpoint and return its unwrapped `data`. */
export async function getData<T>(
  path: string,
  query?: RequestOptions["query"],
  signal?: AbortSignal,
): Promise<T> {
  const env = await request<Envelope<T>>(path, { query, signal });
  return env.data;
}

/** POST an APIResponse endpoint and return its unwrapped `data`. */
export async function postData<T>(path: string, body?: unknown): Promise<T> {
  const env = await request<Envelope<T>>(path, { method: "POST", body });
  return env.data;
}

/** GET a PaginatedResponse endpoint and return items + pagination meta. */
export async function getPaginated<T>(
  path: string,
  query?: RequestOptions["query"],
  signal?: AbortSignal,
): Promise<Paginated<T>> {
  const env = await request<{ success: boolean; data: T[]; meta: PaginationMeta }>(path, {
    query,
    signal,
  });
  return { items: env.data ?? [], meta: env.meta };
}

/**
 * Fetch a binary file (PDF/XLSX/CSV/ZIP) from the backend with auth and return
 * the raw Blob. Never returns a placeholder — throws ApiError on failure so the
 * caller can surface a real error instead of saving a corrupt file.
 */
export async function downloadBlob(path: string): Promise<Blob> {
  const token = resolveToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(buildUrl(path), { method: "GET", headers, cache: "no-store" });
  } catch (err) {
    throw new ApiError(err instanceof Error ? err.message : "Network request failed", 0, "NETWORK_ERROR");
  }
  if (!res.ok) {
    throw new ApiError(`Download failed with status ${res.status}`, res.status, "DOWNLOAD_ERROR");
  }
  return await res.blob();
}

export const apiClient = { getData, postData, getPaginated, request, downloadBlob };
