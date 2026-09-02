from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Route


class RouteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, route_id: UUID) -> Optional[Route]:
        result = await self.session.execute(select(Route).where(Route.id == route_id))
        return result.scalars().first()

    async def get_by_code(self, route_code: str) -> Optional[Route]:
        result = await self.session.execute(select(Route).where(Route.route_code == route_code))
        return result.scalars().first()

    async def get_by_origin_dest(self, origin: str, dest: str) -> Optional[Route]:
        result = await self.session.execute(
            select(Route).where(Route.route_code == f"{origin.upper()}-{dest.upper()}")
        )
        return result.scalars().first()

    async def list_routes(
        self, active_only: bool = True, limit: int = 100, offset: int = 0
    ) -> Tuple[List[Route], int]:
        query = select(Route)
        count_query = select(func.count()).select_from(Route)

        if active_only:
            query = query.where(Route.active == True)
            count_query = count_query.where(Route.active == True)

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(Route.route_code).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def create(self, route: Route) -> Route:
        self.session.add(route)
        await self.session.flush()
        return route
