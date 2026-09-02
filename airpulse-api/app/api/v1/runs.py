from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, UserContext
from app.db.repositories.runs import RunRepository
from app.db.session import get_db
from app.schemas.runs import CollectionRunDetail, PipelineRunDetail

router = APIRouter(prefix="/runs", tags=["Pipeline Runs"])


@router.get("/collections", response_model=PaginatedResponse[CollectionRunDetail])
async def list_collection_runs(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    repo = RunRepository(db)
    items, total = await repo.list_collection_runs(
        limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[CollectionRunResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/pipelines", response_model=PaginatedResponse[PipelineRunDetail])
async def list_pipeline_runs(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    repo = RunRepository(db)
    items, total = await repo.list_pipeline_runs(
        limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[PipelineRunResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )
