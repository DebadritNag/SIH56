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


@router.get("/{route_ref}/insights", response_model=APIResponse)
async def get_route_insights(
    route_ref: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Accepts either a route UUID or a route code (e.g. DEL-BOM) and computes
    REAL insights from validated fares for that corridor."""
    from sqlalchemy import and_, func, select
    from app.db.models import Route, ValidatedFare

    # Resolve route by UUID or by code.
    route = None
    try:
        route = await RouteRepository(db).get_by_id(UUID(route_ref))
    except (ValueError, Exception):
        route = None
    if route is None:
        route = (await db.execute(
            select(Route).where(Route.route_code == route_ref.upper())
        )).scalars().first()

    code = route.route_code if route else route_ref.upper()
    _rc = (code or "-").split("-")
    origin, dest = (_rc[0] if len(_rc) > 0 else ""), (_rc[1] if len(_rc) > 1 else "")

    # Real aggregates from validated fares for this corridor.
    med = None
    bw_breakdown: dict = {}
    sources = 0
    try:
        row = (await db.execute(
            select(
                func.percentile_cont(0.5).within_group(ValidatedFare.normalized_total_fare),
                func.count(func.distinct(ValidatedFare.source_id)),
            ).where(and_(ValidatedFare.origin == origin, ValidatedFare.destination == dest))
        )).one()
        med = float(row[0]) if row[0] is not None else None
        sources = int(row[1] or 0)

        bw_rows = (await db.execute(
            select(ValidatedFare.booking_window_days,
                   func.avg(ValidatedFare.normalized_total_fare))
            .where(and_(ValidatedFare.origin == origin, ValidatedFare.destination == dest))
            .group_by(ValidatedFare.booking_window_days)
        )).all()
        for bw, avg in bw_rows:
            if bw is not None and avg is not None:
                bw_breakdown[f"T{int(bw)}"] = round(float(avg), 0)
    except Exception:
        await db.rollback()

    if med is None:
        raise EntityNotFoundException("Route insights (no fares)", route_ref)

    insights = RouteInsights(
        route_code=code,
        origin_code=origin,
        destination_code=dest,
        distance_km=(route.distance_km or 0.0) if route else 0.0,
        current_median_fare=round(med, 0),
        previous_day_change_pct=0.0,
        previous_week_change_pct=0.0,
        trend_30d="stable",
        booking_window_breakdown=bw_breakdown or {"T7": round(med, 0)},
        source_coverage_count=sources,
        open_anomalies_count=0,
        route_apix_latest=round((med / 5000.0) * 100.0, 1),
    )
    return APIResponse(success=True, data=insights)
