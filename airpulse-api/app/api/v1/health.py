from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.common import APIResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=APIResponse)
async def health_check():
    return APIResponse(success=True, data={"status": "healthy", "service": "AirPulse API", "version": "1.0.0"})


@router.get("/ready", response_model=APIResponse)
async def readiness_check():
    return APIResponse(success=True, data={"status": "ready", "database": "connected", "redis": "connected"})


@router.get("/keep-alive", response_model=APIResponse)
async def keep_alive(db: AsyncSession = Depends(get_db)):
    """Lightweight DB keep-alive. Runs a trivial query so the managed Postgres
    (Supabase free tier) is touched and never auto-pauses from inactivity.
    Intended to be pinged by a scheduled job (e.g. every 2 days)."""
    try:
        result = await db.execute(text("SELECT 1"))
        ok = result.scalar() == 1
        return APIResponse(success=True, data={"status": "alive", "database": "reachable" if ok else "unexpected"})
    except Exception as exc:  # noqa: BLE001
        return APIResponse(success=False, data={"status": "degraded", "database": "unreachable", "error": str(exc)[:160]})
