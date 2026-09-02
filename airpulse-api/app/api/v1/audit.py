from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_admin, UserContext
from app.db.repositories.runs import RunRepository
from app.db.session import get_db
from app.schemas.audit import AuditEventResponse

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("/events", response_model=PaginatedResponse[AuditEventResponse])
async def list_audit_events(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_admin),
):
    repo = RunRepository(db)
    items, total = await repo.list_audit_events(
        limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[AuditEventResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )
