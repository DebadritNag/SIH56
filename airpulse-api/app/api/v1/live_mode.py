"""Live Mode status endpoint.

GET /api/v1/live-mode/status

Returns the canonical DataContextResolver output:
  - mode (HYBRID | LIVE_DATA | IMPORTED_FALLBACK | EMPTY)
  - mode_label
  - health_badge (optional, e.g. "LIVE SOURCE DEGRADED")
  - live_count, imported_count, total_eligible
  - routes, booking_windows, booking_window_buckets
  - historical_days
  - apix_available / apix_count
  - latest run IDs
  - benchmark availability

Frontend polls this (or receives Realtime invalidation) to update
the Live Mode badge and determine which pages/components are populated.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_viewer, UserContext
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.services.data_context_resolver import DataContextResolver

router = APIRouter(prefix="/live-mode", tags=["Live Mode"])


@router.get("/status", response_model=APIResponse)
async def live_mode_status(
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Returns canonical Live Mode context: mode, counts, routes, windows, run history.

    The frontend should use this as the single source of truth for Live Mode
    badge/label and for determining which dashboard components have real data.
    Caller must never use SYNTHETIC/REPLAY counts for Live Mode display.
    """
    ctx = await DataContextResolver(db).resolve()
    return APIResponse(success=True, data=ctx.to_dict())
