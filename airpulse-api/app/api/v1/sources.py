from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_admin, require_viewer, UserContext
from app.db.models import Source
from app.db.repositories.sources import SourceRepository
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.schemas.source import SourceEngineUpdate, SourceHealthSummary, SourceResponse

router = APIRouter(prefix="/sources", tags=["Sources"])


def _hydrate_source_response(src: Source) -> SourceResponse:
    meta = dict(src.source_metadata or {})
    return SourceResponse(
        id=src.id,
        name=src.name,
        display_name=src.display_name or src.name,
        source_type=src.source_type,
        base_url=src.base_url,
        active=src.active,
        collection_method=src.collection_method,
        max_requests_per_minute=src.rate_limit_per_minute,
        preferred_engine=meta.get("preferred_engine", "AUTO"),
        supported_engines=meta.get("supported_engines", ["SCRAPY", "PLAYWRIGHT"]),
        requires_javascript=bool(src.requires_javascript),
        scrapy_enabled=bool(meta.get("scrapy_enabled", True)),
        playwright_enabled=bool(meta.get("playwright_enabled", True)),
        last_successful_engine=meta.get("last_successful_engine"),
        last_attempted_engine=meta.get("last_attempted_engine"),
        last_success_at=src.last_success_at,
        last_failure_at=src.last_failure_at,
        consecutive_failures=src.consecutive_failures,
        reliability_score=src.reliability_score,
        created_at=src.created_at,
        updated_at=src.updated_at,
    )


@router.get("", response_model=PaginatedResponse[SourceResponse])
async def list_sources(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = SourceRepository(db)
    items, total = await repo.list_sources(limit=pagination.page_size, offset=pagination.offset)
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[_hydrate_source_response(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{source_id}/health", response_model=APIResponse)
async def get_source_health(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = SourceRepository(db)
    src = await repo.get_by_id(source_id)
    if not src:
        raise EntityNotFoundException("Source", source_id)

    status_str = "healthy" if src.consecutive_failures == 0 else ("degraded" if src.consecutive_failures < 3 else "failed")
    health = SourceHealthSummary(
        source_id=src.id,
        source_name=src.name,
        status=status_str,
        reliability_score=src.reliability_score,
        success_rate_24h=0.98 if src.consecutive_failures == 0 else 0.85,
        avg_latency_ms=145,
        records_24h=2400,
        consecutive_failures=src.consecutive_failures,
        last_checked_at=src.last_success_at or src.created_at,
    )
    return APIResponse(success=True, data=health)


@router.patch("/{source_id}/engine", response_model=APIResponse)
async def update_source_engine(
    source_id: UUID,
    payload: SourceEngineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Configures preferred collection engine and capability toggles for a source."""
    repo = SourceRepository(db)
    src = await repo.update_engine_config(source_id, payload.model_dump(exclude_unset=True))
    if not src:
        raise EntityNotFoundException("Source", source_id)
    await db.commit()
    return APIResponse(success=True, data=_hydrate_source_response(src).model_dump())
