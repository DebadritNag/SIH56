from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AirfareIndex, IndexBasket, IndexBasketRoute, IndexComponent


class IndexRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, index_id: UUID) -> Optional[AirfareIndex]:
        res = await self.session.execute(select(AirfareIndex).where(AirfareIndex.id == index_id))
        return res.scalars().first()

    async def get_latest(
        self, frequency: str = "daily", scope: str = "national", scope_id: Optional[str] = None
    ) -> Optional[AirfareIndex]:
        conditions = [AirfareIndex.frequency == frequency, AirfareIndex.scope == scope]
        if scope_id:
            conditions.append(AirfareIndex.scope_id == scope_id)
        query = (
            select(AirfareIndex)
            .where(and_(*conditions))
            .order_by(desc(AirfareIndex.index_date))
            .limit(1)
        )
        res = await self.session.execute(query)
        return res.scalars().first()

    async def query_indices(
        self,
        frequency: str = "daily",
        scope: str = "national",
        scope_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[AirfareIndex], int]:
        conditions = [AirfareIndex.frequency == frequency, AirfareIndex.scope == scope]
        if scope_id:
            conditions.append(AirfareIndex.scope_id == scope_id)
        if start_date:
            conditions.append(AirfareIndex.index_date >= start_date)
        if end_date:
            conditions.append(AirfareIndex.index_date <= end_date)

        query = select(AirfareIndex).where(and_(*conditions))
        count_query = select(func.count()).select_from(AirfareIndex).where(and_(*conditions))

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(desc(AirfareIndex.index_date)).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def create_index(self, index_record: AirfareIndex) -> AirfareIndex:
        self.session.add(index_record)
        await self.session.flush()
        return index_record

    async def create_components(self, components: List[IndexComponent]) -> None:
        self.session.add_all(components)
        await self.session.flush()

    async def get_basket_by_version(self, version: str) -> Optional[IndexBasket]:
        res = await self.session.execute(
            select(IndexBasket).where(IndexBasket.version == version)
        )
        return res.scalars().first()

    async def get_basket_routes(self, basket_id: UUID) -> List[IndexBasketRoute]:
        res = await self.session.execute(
            select(IndexBasketRoute).where(IndexBasketRoute.basket_id == basket_id)
        )
        return list(res.scalars().all())
