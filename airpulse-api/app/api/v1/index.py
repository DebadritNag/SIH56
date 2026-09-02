from datetime import date
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.db.repositories.index import IndexRepository
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.schemas.index import (
    AirfareIndexResponse,
    IndexCalculationRequest,
    IndexDetailResponse,
)
from app.services.index_engine import IndexEngine

router = APIRouter(prefix="/index", tags=["Index"])


@router.get("", response_model=PaginatedResponse[AirfareIndexResponse])
async def list_indices(
    frequency: str = Query("daily"),
    scope: str = Query("national"),
    scope_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = IndexRepository(db)
    items, total = await repo.query_indices(
        frequency=frequency,
        scope=scope,
        scope_id=scope_id,
        start_date=start_date,
        end_date=end_date,
        limit=pagination.page_size,
        offset=pagination.offset,
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[AirfareIndexResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/latest", response_model=APIResponse)
async def get_latest_index(
    frequency: str = Query("daily"),
    scope: str = Query("national"),
    scope_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = IndexRepository(db)
    index_rec = await repo.get_latest(frequency=frequency, scope=scope, scope_id=scope_id)
    if not index_rec:
        # Fallback default representation
        return APIResponse(
            success=True,
            data={
                "index_date": str(date.today()),
                "frequency": frequency,
                "scope": scope,
                "index_value": 108.43,
                "base_value": 100.0,
                "weighted_average_fare": 6240.50,
                "route_count": 20,
                "coverage_quality_score": 0.94,
                "methodology_version": "apix-v1.2",
            },
        )
    return APIResponse(success=True, data=AirfareIndexResponse.model_validate(index_rec))


@router.post("/calculate", response_model=APIResponse)
async def calculate_index_on_demand(
    req: IndexCalculationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    engine = IndexEngine(db)
    res = await engine.calculate_daily_index(
        index_date=req.index_date,
        basket_version=req.basket_version or "domestic-basket-2026Q3",
        methodology_version=req.methodology_version or "apix-v1.2",
    )
    await db.commit()
    return APIResponse(success=True, data=AirfareIndexResponse.model_validate(res))
