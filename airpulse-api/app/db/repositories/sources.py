from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Source, SourceHealthLog


class SourceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, source_id: UUID) -> Optional[Source]:
        result = await self.session.execute(select(Source).where(Source.id == source_id))
        return result.scalars().first()

    async def get_by_name(self, name: str) -> Optional[Source]:
        result = await self.session.execute(select(Source).where(Source.name == name))
        return result.scalars().first()

    async def list_sources(
        self, active_only: bool = False, limit: int = 100, offset: int = 0
    ) -> Tuple[List[Source], int]:
        query = select(Source)
        count_query = select(func.count()).select_from(Source)

        if active_only:
            query = query.where(Source.active == True)
            count_query = count_query.where(Source.active == True)

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(Source.name).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def create(self, source: Source) -> Source:
        self.session.add(source)
        await self.session.flush()
        return source

    async def log_health(self, log: SourceHealthLog) -> SourceHealthLog:
        self.session.add(log)
        await self.session.flush()
        return log
