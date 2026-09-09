/** Compatibility route for older clients. Current clients use /backend-api rewrites. */
import { type NextRequest, NextResponse } from "next/server";
const CONFIGURED_BACKEND = (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
const API_PREFIX = `/${(process.env.NEXT_PUBLIC_API_V1_PREFIX || "/api/v1").replace(/^\/+|\/+$/g, "")}`;

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

  if (!res) {
    const upstream = `${CONFIGURED_BACKEND}${API_PREFIX}/${pathStr}${search}`;
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
          : "The proxy could not connect to the configured backend. Check server-only BACKEND_ORIGIN and EC2 service status.",
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
