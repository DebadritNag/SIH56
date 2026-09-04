"""
Controlled Live Scraping Verification Endpoints.
Provides POST /api/v1/scraping/test adhering to Section 15 of Live Scraper Specification.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
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
    "airline direct (akasa air portal)": "akasa",
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
    engine: Optional[str] = "AUTO"  # AUTO, SCRAPY, PLAYWRIGHT
    compare: Optional[bool] = False
    max_results: Optional[int] = Field(15, ge=1, le=20)
    is_nonstop: Optional[bool] = None


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
    today_val = date.today()
    bw = max(1, payload.booking_window_days or 7)
    if payload.departure_date and payload.departure_date >= today_val:
        dep = payload.departure_date
        delta = (payload.departure_date - today_val).days
        if delta >= 0:
            bw = delta
    else:
        dep = today_val + timedelta(days=bw)

    raw_query = (payload.source_name or (src.display_name if src else "")).lower()
    is_ota = any(k in raw_query for k in ("ota", "cleartrip", "makemytrip", "easemytrip"))
    source_type = "ota" if is_ota else str(getattr(src, "source_type", "airline") if src else "airline")

    # If payload.compare is requested, execute both engines and return comparison
    if payload.compare:
        res_scrapy = await scraper.run(
            source_name=(src.display_name if src else (payload.source_name or "AirPulse Test Source")),
            source_type=source_type,
            base_url=getattr(src, "base_url", None) if src else None,
            origin=payload.origin,
            destination=payload.destination,
            departure=dep,
            booking_window_days=bw,
            source_id=str(src.id) if src else None,
            engine="SCRAPY",
            max_results=payload.max_results,
            is_nonstop=payload.is_nonstop,
        )
        res_pw = await scraper.run(
            source_name=(src.display_name if src else (payload.source_name or "AirPulse Test Source")),
            source_type=source_type,
            base_url=getattr(src, "base_url", None) if src else None,
            origin=payload.origin,
            destination=payload.destination,
            departure=dep,
            booking_window_days=bw,
            source_id=str(src.id) if src else None,
            engine="PLAYWRIGHT",
            max_results=payload.max_results,
            is_nonstop=payload.is_nonstop,
        )
        return {
            "status": "COMPARED",
            "compare_mode": True,
            "scrapy_result": res_scrapy,
            "playwright_result": res_pw,
            "comparison": {
                "scrapy_status": res_scrapy.get("status"),
                "scrapy_quotes": res_scrapy.get("quotes_found", 0),
                "scrapy_duration_ms": res_scrapy.get("duration_ms", 0),
                "scrapy_results_matching": res_scrapy.get("results_matching", 0),
                "scrapy_stop_reason": res_scrapy.get("stop_reason"),
                "playwright_status": res_pw.get("status"),
                "playwright_quotes": res_pw.get("quotes_found", 0),
                "playwright_duration_ms": res_pw.get("duration_ms", 0),
                "playwright_results_matching": res_pw.get("results_matching", 0),
                "playwright_stop_reason": res_pw.get("stop_reason"),
            },
        }

    result = await scraper.run(
        source_name=(src.display_name if src else (payload.source_name or "AirPulse Test Source")),
        source_type=source_type,
        base_url=getattr(src, "base_url", None) if src else None,
        origin=payload.origin,
        destination=payload.destination,
        departure=dep,
        booking_window_days=bw,
        source_id=str(src.id) if src else None,
        engine=payload.engine or "AUTO",
        max_results=payload.max_results,
        is_nonstop=payload.is_nonstop,
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


@router.get("/browser-capability", response_model=APIResponse)
async def get_browser_capability(
    run_test: bool = False,
    current_user: UserContext = Depends(require_viewer),
):
    """Returns resolved browser capability metadata and optionally executes an isolated self-test."""
    from app.services.browser_service import SharedBrowserService
    service = SharedBrowserService.get_instance()
    if run_test:
        test_res = await SharedBrowserService.run_startup_self_test()
        return APIResponse(success=(test_res.get("self_test_status") == "PASSED"), data=test_res)
    cap = service.get_capability()
    return APIResponse(success=(cap.launch_status == "SUCCESS"), data=cap.to_dict())

