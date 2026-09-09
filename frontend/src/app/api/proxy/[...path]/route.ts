/**
 * Universal backend proxy — works in every environment:
 *
 *   Local dev (`npm run dev`)  → tries http://localhost:8000 first, falls back to EC2
 *   Vercel / production build  → goes directly to the EC2 backend via NEXT_PUBLIC_API_BASE_URL
 *   Any other deploy           → uses NEXT_PUBLIC_API_BASE_URL from env
 *
 * The browser always calls this same-origin route (/api/proxy/...) so there is
 * never a CORS issue regardless of which backend is actually used.
 * The EC2 IP is never hardcoded here — it comes from NEXT_PUBLIC_API_BASE_URL.
 */
import { type NextRequest, NextResponse } from "next/server";

const LOCAL_BACKEND = "http://localhost:8000";

// The configured backend from env.
// Production: set NEXT_PUBLIC_API_BASE_URL=http://54.234.16.107 in Vercel dashboard.
// Falls back to /backend-api (same-origin via next.config.ts rewrite) if not set.
const CONFIGURED_BACKEND =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "/backend-api").replace(/\/$/, "");

const IS_DEV = process.env.NODE_ENV === "development";

/** Keep the upstream deadline below the route's execution budget. */
async function tryFetch(url: string, init: RequestInit, timeoutMs = 50000): Promise<{ response: Response | null; timedOut: boolean }> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return { response: res, timedOut: false };
  } catch (error) {
    return { response: null, timedOut: error instanceof Error && error.name === "TimeoutError" };
  }
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search ?? "";

  // Forward all request headers except host (the backend sets its own).
  const headers: HeadersInit = {};
  req.headers.forEach((val, key) => {
    if (key.toLowerCase() !== "host") headers[key] = val;
  });
  // Prefer an uncompressed upstream response; Vercel handles browser compression.
  headers["accept-encoding"] = "identity";

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();

  const init: RequestInit = {
    method: req.method,
    headers,
    body: body as BodyInit | undefined,
    redirect: "manual",
  };

  let res: Response | null = null;
  let usedBackend = CONFIGURED_BACKEND;
  let timedOut = false;

  if (IS_DEV && !CONFIGURED_BACKEND.startsWith("/")) {
    // In dev: try localhost first so a local FastAPI is used when running;
    // fall back to the configured EC2 backend when it is not.
    res = (await tryFetch(`${LOCAL_BACKEND}/api/v1/${pathStr}${search}`, init, 2000)).response;
    if (res) {
      usedBackend = LOCAL_BACKEND;
    }
  }

  if (!res) {
    // Build the upstream URL. CONFIGURED_BACKEND may be:
    //   - a full URL: http://54.234.16.107   → http://54.234.16.107/api/v1/...
    //   - a same-origin path: /backend-api  → /backend-api/api/v1/... (rewritten by next.config.ts)
    const upstream = CONFIGURED_BACKEND.startsWith("/")
      ? `${req.nextUrl.origin}${CONFIGURED_BACKEND}/api/v1/${pathStr}${search}`
      : `${CONFIGURED_BACKEND}/api/v1/${pathStr}${search}`;
    const attempt = await tryFetch(upstream, init);
    res = attempt.response;
    timedOut = attempt.timedOut;
    usedBackend = upstream;
  }

  if (!res) {
    return NextResponse.json(
      { success: false, error: {
        message: timedOut
          ? "The backend did not respond within 50 seconds. Check EC2 instance health and API server logs."
          : "The proxy could not connect to the configured backend. Check NEXT_PUBLIC_API_BASE_URL and EC2 service status.",
        code: timedOut ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE",
      } },
      { status: timedOut ? 504 : 503, headers: { "cache-control": "no-store", "x-airpulse-error-source": "proxy" } }
    );
  }

  // Node fetch decodes gzip/br/deflate bodies but retains upstream headers.
  // Forwarding their encoding or compressed length makes browsers decode the
  // already-decoded stream again (ERR_CONTENT_DECODING_FAILED, even on HTTP 200).
  const resHeaders = new Headers();
  res.headers.forEach((val, key) => {
    if (!["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) {
      resHeaders.set(key, val);
    }
  });
  resHeaders.set("x-airpulse-backend", usedBackend);

  return new NextResponse(res.body, { status: res.status, headers: resHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
