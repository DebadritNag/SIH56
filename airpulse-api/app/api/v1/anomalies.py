from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.core.utils import utc_now
from app.db.models import AnomalyReview
from app.db.repositories.anomalies import AnomalyRepository
from app.db.session import get_db
from app.schemas.anomaly import AnomalyResponse, AnomalyReviewRequest
from app.schemas.common import APIResponse
from app.services.audit_service import AuditService

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])


@router.get("", response_model=PaginatedResponse[AnomalyResponse])
async def list_anomalies(
    severity: Optional[str] = Query(None),
    anomaly_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = AnomalyRepository(db)
    items, total = await repo.list_anomalies(
        severity=severity,
        anomaly_type=anomaly_type,
        status=status,
        limit=pagination.page_size,
        offset=pagination.offset,
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[AnomalyResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{anomaly_id}", response_model=APIResponse)
async def get_anomaly(
    anomaly_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = AnomalyRepository(db)
    anom = await repo.get_by_id(anomaly_id)
    if not anom:
        raise EntityNotFoundException("Anomaly", anomaly_id)
    return APIResponse(success=True, data=AnomalyResponse.model_validate(anom))


@router.post("/{anomaly_id}/review", response_model=APIResponse)
async def review_anomaly(
    anomaly_id: UUID,
    review_req: AnomalyReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    """Government analyst review workflow: Confirm, dismiss, or categorize suspicious price movements."""
    repo = AnomalyRepository(db)
    audit = AuditService(db)

    anom = await repo.get_by_id(anomaly_id)
    if not anom:
        raise EntityNotFoundException("Anomaly", anomaly_id)

    before_status = anom.status
    new_status = "confirmed" if review_req.decision in ["confirm", "genuine_price_shock"] else "dismissed"
    await repo.update_status(anomaly_id, new_status)

    review = AnomalyReview(
        id=uuid4(),
        anomaly_id=anomaly_id,
        reviewer_id=current_user.email or current_user.user_id,
        decision=review_req.decision.value,
        comment=review_req.comment,
        created_at=utc_now(),
    )
    await repo.create_review(review)

    # Log to audit_events
    await audit.log_event(
        actor_id=current_user.email or current_user.user_id,
        action="ANOMALY_REVIEWED",
        entity_type="anomaly",
        entity_id=str(anomaly_id),
        before_state={"status": before_status},
        after_state={"status": new_status, "decision": review_req.decision.value},
    )

    await db.commit()
    return APIResponse(
        success=True,
        data={
            "anomaly_id": str(anomaly_id),
            "decision": review_req.decision.value,
            "status": new_status,
            "reviewed_by": current_user.email or current_user.user_id,
        },
    )
