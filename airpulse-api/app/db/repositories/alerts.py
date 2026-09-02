from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.utils import utc_now
from app.db.models import Alert


class AlertRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, alert_id: UUID) -> Optional[Alert]:
        res = await self.session.execute(select(Alert).where(Alert.id == alert_id))
        return res.scalars().first()

    async def list_alerts(
        self, status: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> Tuple[List[Alert], int]:
        query = select(Alert)
        count_query = select(func.count()).select_from(Alert)

        if status:
            query = query.where(Alert.status == status)
            count_query = count_query.where(Alert.status == status)

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(desc(Alert.created_at)).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def create(self, alert: Alert) -> Alert:
        self.session.add(alert)
        await self.session.flush()
        return alert

    async def update_status(self, alert_id: UUID, status: str) -> Optional[Alert]:
        alert = await self.get_by_id(alert_id)
        if alert:
            alert.status = status
            if status == "resolved":
                alert.resolved_at = utc_now()
            await self.session.flush()
        return alert
