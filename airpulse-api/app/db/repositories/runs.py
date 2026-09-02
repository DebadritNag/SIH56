from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AuditEvent, CollectionRun, PipelineRun


class RunRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_collection_run(self, run: CollectionRun) -> CollectionRun:
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_collection_run(self, run_id: UUID) -> Optional[CollectionRun]:
        res = await self.session.execute(
            select(CollectionRun).where(CollectionRun.id == run_id)
        )
        return res.scalars().first()

    async def list_collection_runs(
        self, limit: int = 50, offset: int = 0
    ) -> Tuple[List[CollectionRun], int]:
        total_res = await self.session.execute(select(func.count()).select_from(CollectionRun))
        total = total_res.scalar() or 0

        res = await self.session.execute(
            select(CollectionRun).order_by(desc(CollectionRun.started_at)).offset(offset).limit(limit)
        )
        return list(res.scalars().all()), total

    async def create_pipeline_run(self, run: PipelineRun) -> PipelineRun:
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_pipeline_run(self, run_id: UUID) -> Optional[PipelineRun]:
        res = await self.session.execute(
            select(PipelineRun).where(PipelineRun.id == run_id)
        )
        return res.scalars().first()

    async def list_pipeline_runs(
        self, limit: int = 50, offset: int = 0
    ) -> Tuple[List[PipelineRun], int]:
        total_res = await self.session.execute(select(func.count()).select_from(PipelineRun))
        total = total_res.scalar() or 0

        res = await self.session.execute(
            select(PipelineRun).order_by(desc(PipelineRun.started_at)).offset(offset).limit(limit)
        )
        return list(res.scalars().all()), total

    async def create_audit_event(self, event: AuditEvent) -> AuditEvent:
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_audit_events(
        self, limit: int = 50, offset: int = 0
    ) -> Tuple[List[AuditEvent], int]:
        total_res = await self.session.execute(select(func.count()).select_from(AuditEvent))
        total = total_res.scalar() or 0

        res = await self.session.execute(
            select(AuditEvent).order_by(desc(AuditEvent.timestamp)).offset(offset).limit(limit)
        )
        return list(res.scalars().all()), total
