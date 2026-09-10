from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.db.repositories.alerts import AlertRepository
from app.db.session import get_db
from app.schemas.alert import AlertResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=PaginatedResponse[AlertResponse])
async def list_alerts(
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = AlertRepository(db)
    items, total = await repo.list_alerts(
        status=status, limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[AlertResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get('/confirmed-shocks', response_model=APIResponse)
async def confirmed_shocks(db: AsyncSession = Depends(get_db), current_user: UserContext = Depends(require_viewer)):
    from app.services.live_store import rows
    from app.services.confirmed_shocks import confirmed_live_shock
    alerts = await rows(db, """SELECT a.id,a.alert_type,a.status,a.metadata,a.created_at,r.route_code
        FROM alerts a LEFT JOIN routes r ON r.id=a.route_id
        WHERE UPPER(a.alert_type)='PRICE_SHOCK' AND UPPER(a.status::text) IN ('OPEN','ACKNOWLEDGED')
        ORDER BY a.created_at DESC""")
    shocks = [shock for alert in alerts if (shock := confirmed_live_shock(alert)) is not None]
    return APIResponse(success=True, data={'items':shocks, 'active_count':len(shocks)})


@router.post("/{alert_id}/acknowledge", response_model=APIResponse)
async def acknowledge_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    repo = AlertRepository(db)
    alert = await repo.update_status(alert_id, "acknowledged")
    if not alert:
        raise EntityNotFoundException("Alert", alert_id)
    await db.commit()
    return APIResponse(success=True, data=AlertResponse.model_validate(alert))


@router.post("/{alert_id}/resolve", response_model=APIResponse)
async def resolve_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    repo = AlertRepository(db)
    alert = await repo.update_status(alert_id, "resolved")
    if not alert:
        raise EntityNotFoundException("Alert", alert_id)
    await db.commit()
    return APIResponse(success=True, data=AlertResponse.model_validate(alert))
