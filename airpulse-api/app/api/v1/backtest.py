from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import EntityNotFoundException
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.db.models import BacktestRun
from app.db.session import get_db
from app.schemas.backtest import BacktestRequest, BacktestResponse
from app.schemas.common import APIResponse
from app.services.backtest_service import BacktestService
from sqlalchemy import desc, func, select

router = APIRouter(prefix="/backtest", tags=["Backtest"])


@router.post("/run", response_model=APIResponse)
async def run_backtest(
    req: BacktestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_analyst),
):
    service = BacktestService(db)
    run = await service.execute_backtest(
        start_date=req.start_date,
        end_date=req.end_date,
        benchmark_dataset_id=req.benchmark_dataset_id,
        benchmark_type=req.benchmark_type,
        methodology_version=req.methodology_version or "apix-v1.2",
        actor_id=getattr(current_user, "user_id", None),
    )
    await db.commit()
    return APIResponse(success=True, data=BacktestResponse.model_validate(run))


@router.get("/runs", response_model=PaginatedResponse[BacktestResponse])
async def list_backtest_runs(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    total_res = await db.execute(select(func.count()).select_from(BacktestRun))
    total = total_res.scalar() or 0

    res = await db.execute(
        select(BacktestRun).order_by(desc(BacktestRun.created_at)).offset(pagination.offset).limit(pagination.page_size)
    )
    items = list(res.scalars().all())
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[BacktestResponse.model_validate(i) for i in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/runs/{run_id}", response_model=APIResponse)
async def get_backtest_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    res = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    run = res.scalars().first()
    if not run:
        raise EntityNotFoundException("BacktestRun", run_id)
    return APIResponse(success=True, data=BacktestResponse.model_validate(run))
