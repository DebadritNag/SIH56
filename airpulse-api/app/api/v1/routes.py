from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_viewer, UserContext
from app.db.repositories.routes import RouteRepository
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.schemas.route import RouteInsights, RouteResponse

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.get("", response_model=PaginatedResponse[RouteResponse])
async def list_routes(
    active_only: bool = True,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = RouteRepository(db)
    items, total = await repo.list_routes(
        active_only=active_only, limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[RouteResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{route_id}", response_model=APIResponse)
async def get_route(
    route_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = RouteRepository(db)
    route = await repo.get_by_id(route_id)
    if not route:
        raise EntityNotFoundException("Route", route_id)
    return APIResponse(success=True, data=RouteResponse.model_validate(route))


@router.get("/{route_id}/insights", response_model=APIResponse)
async def get_route_insights(
    route_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = RouteRepository(db)
    route = await repo.get_by_id(route_id)
    if not route:
        raise EntityNotFoundException("Route", route_id)

    insights = RouteInsights(
        route_code=route.route_code,
        origin_code=route.origin_code,
        destination_code=route.destination_code,
        distance_km=route.distance_km,
        current_median_fare=5420.0,
        previous_day_change_pct=0.85,
        previous_week_change_pct=2.40,
        trend_30d="upward",
        booking_window_breakdown={"T1": 8900.0, "T7": 6200.0, "T15": 5100.0, "T30": 4600.0},
        source_coverage_count=4,
        open_anomalies_count=2,
        route_apix_latest=104.2,
    )
    return APIResponse(success=True, data=insights)
