"""
Controlled Live Scraping Verification Endpoints.
Provides POST /api/v1/scraping/test adhering to Section 15 of Live Scraper Specification.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_viewer, UserContext
from app.db.models import Source
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.services.live_scraper import get_live_scraper

router = APIRouter(prefix="/scraping", tags=["Live Scraping Engine"])

SOURCE_ALIASES = {
    "airline direct (indigo portal)": "indigo",
    "indigo direct": "indigo",
    "airline direct (air india portal)": "air_india",
    "air india direct": "air_india",
    "airline direct (spicejet portal)": "spicejet",
    "airline direct (akasa air portal)": "akasa_air",
    "airline direct (air india express portal)": "air_india_express",
    "ota source 01 (makemytrip)": "ota_source_01",
    "ota source 02 (easemytrip)": "ota_source_02",
    "ota source 03 (cleartrip)": "ota_source_03",
}


class ScrapingTestRequest(BaseModel):
    source_name: Optional[str] = None
    source_id: Optional[UUID] = None
    origin: str = "DEL"
    destination: str = "BOM"
    departure_date: Optional[date] = None
    booking_window_days: int = 7
    mode: str = "LIVE"


async def execute_live_scraping_test(
    payload: ScrapingTestRequest,
    db: AsyncSession,
) -> dict:
    src = None
    if payload.source_id:
        src = (await db.execute(select(Source).where(Source.id == payload.source_id))).scalars().first()
    elif payload.source_name:
        raw_name = payload.source_name.strip()
        norm_key = raw_name.lower()
        target_name = SOURCE_ALIASES.get(norm_key, raw_name)

        src = (await db.execute(select(Source).where(Source.name == target_name))).scalars().first()
        if not src:
            src = (await db.execute(select(Source).where(Source.display_name.ilike(f"%{raw_name}%")))).scalars().first()
        if not src and target_name != raw_name:
            src = (await db.execute(select(Source).where(Source.name.ilike(f"%{target_name}%")))).scalars().first()

    scraper = get_live_scraper()
    dep = payload.departure_date or date.today()
    raw_query = (payload.source_name or (src.display_name if src else "")).lower()
    is_ota = any(k in raw_query for k in ("ota", "cleartrip", "makemytrip", "easemytrip"))
    source_type = "ota" if is_ota else str(getattr(src, "source_type", "airline") if src else "airline")

    result = await scraper.run(
        source_name=(src.display_name if src else (payload.source_name or "AirPulse Test Source")),
        source_type=source_type,
        base_url=getattr(src, "base_url", None) if src else None,
        origin=payload.origin,
        destination=payload.destination,
        departure=dep,
        booking_window_days=payload.booking_window_days,
        source_id=str(src.id) if src else None,
    )
    return result


@router.post("/test", response_model=APIResponse)
async def run_scraping_test(
    payload: ScrapingTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Executes a controlled single-request live extraction probe and returns 11-stage telemetry."""
    result = await execute_live_scraping_test(payload, db)
    return APIResponse(success=(result["status"] in ("PASSED", "PARTIAL")), data=result)
