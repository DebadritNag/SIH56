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


@router.get("")
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
    from app.services.live_store import rows
    where = """index_type=:scope AND (CAST(:scope_id AS text) IS NULL OR route_id::text=CAST(:scope_id AS text))
        AND (CAST(:start AS date) IS NULL OR index_date>=:start)
        AND (CAST(:end AS date) IS NULL OR index_date<=:end)"""
    params = dict(scope=scope,scope_id=scope_id,start=start_date,end=end_date)
    items = await rows(db,f"SELECT * FROM airfare_index WHERE {where} ORDER BY index_date DESC,calculated_at DESC LIMIT :limit OFFSET :offset",
                       **params,limit=pagination.page_size,offset=pagination.offset)
    total = (await rows(db,f"SELECT count(*) AS n FROM airfare_index WHERE {where}",**params))[0]['n']
    return dict(success=True,data=items,meta=dict(page=pagination.page,page_size=pagination.page_size,
        total=total,total_pages=(total+pagination.page_size-1)//pagination.page_size))


@router.get("/latest", response_model=APIResponse)
async def get_latest_index(
    frequency: str = Query("daily"),
    scope: str = Query("national"),
    scope_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    from app.services.live_store import rows
    records = await rows(db, """SELECT * FROM airfare_index WHERE index_type=:scope
        AND (CAST(:scope_id AS text) IS NULL OR route_id::text=CAST(:scope_id AS text))
        ORDER BY index_date DESC,calculated_at DESC LIMIT 1""", scope=scope, scope_id=scope_id)
    return APIResponse(success=True, data=records[0] if records else None)


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


@router.get('/{index_id}/components', response_model=APIResponse)
async def persisted_components(index_id: UUID, db: AsyncSession = Depends(get_db), current_user: UserContext = Depends(require_viewer)):
    from app.services.live_store import rows
    return APIResponse(success=True, data=await rows(db, '''SELECT c.*,r.route_code FROM index_components c
        JOIN routes r ON r.id=c.route_id WHERE airfare_index_id=:id ORDER BY r.route_code,c.booking_window_days''',id=index_id))
