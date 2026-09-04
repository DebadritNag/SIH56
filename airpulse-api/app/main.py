import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text

from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import AirPulseException
from app.logging_config import setup_logging
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: configure logging and verify DB connectivity.
    # Schema is owned exclusively by Alembic migrations (single source of truth) —
    # the application never runs create_all against Supabase PostgreSQL.
    setup_logging(settings.LOG_LEVEL)
    # Verify DB connectivity but never block startup on a transient DB hiccup
    # (Render health checks must be able to reach the app immediately).
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger("airpulse").warning("DB not reachable at startup: %s", exc)

    # Startup: Run browser capability discovery and verified self-test
    try:
        from app.services.browser_service import SharedBrowserService
        self_test_res = await SharedBrowserService.run_startup_self_test()
        import logging
        logging.getLogger("airpulse").info(
            "Browser Engine Startup Self-Test: %s (engine=%s, version=%s, status=%s, js_verified=%s, duration=%sms)",
            self_test_res.get("self_test_status"),
            self_test_res.get("browser_engine"),
            self_test_res.get("browser_version"),
            self_test_res.get("browser_launch_status"),
            self_test_res.get("js_execution_verified"),
            self_test_res.get("duration_ms"),
        )
        await SharedBrowserService.get_instance().close_all()
        import gc
        gc.collect()
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger("airpulse").warning("Browser engine self-test encountered an exception: %s", exc)

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="AirPulse Airfare Price Intelligence API (SIH26056)",
    description=(
        "Production-grade backend for MoSPI / RBI analysts to collect, normalize, validate, analyze, "
        "and index domestic airfare data for inflation measurement (APIx) and explainable anomaly detection."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # Allow any Vercel deployment (production + preview) without hardcoding the URL.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Enforces request_id assignment and execution duration logging."""
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = req_id
    start_time = time.time()

    response = await call_next(request)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Response-Time-MS"] = str(duration_ms)
    return response


@app.exception_handler(AirPulseException)
async def airpulse_exception_handler(request: Request, exc: AirPulseException):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            "request_id": req_id,
        },
        headers=_cors_headers(request),
    )


def _cors_headers(request: Request) -> dict:
    """Echo CORS headers on error responses so the browser shows the real error
    instead of a misleading 'No Access-Control-Allow-Origin' block."""
    origin = request.headers.get("origin")
    if not origin:
        return {}
    import re
    allowed = origin in settings.CORS_ORIGINS or bool(re.match(r"https://.*\.vercel\.app", origin))
    if not allowed:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc) if settings.DEBUG else "An unexpected internal server error occurred.",
                "details": [],
            },
            "request_id": req_id,
        },
        headers=_cors_headers(request),
    )


# Register API v1
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Root health probes for container runtimes and automated test suites
@app.get("/health", tags=["Health"])
async def root_health_check():
    from app.api.v1.health import health_check
    return await health_check()


@app.get("/ready", tags=["Health"])
async def root_readiness_check():
    from app.api.v1.health import readiness_check
    return await readiness_check()

