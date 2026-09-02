from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Anomaly, AnomalyReview, ShapExplanation


class AnomalyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, anomaly_id: UUID) -> Optional[Anomaly]:
        res = await self.session.execute(select(Anomaly).where(Anomaly.id == anomaly_id))
        return res.scalars().first()

    async def list_anomalies(
        self,
        severity: Optional[str] = None,
        anomaly_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Anomaly], int]:
        conditions = []
        if severity:
            conditions.append(Anomaly.severity == severity)
        if anomaly_type:
            conditions.append(Anomaly.anomaly_type == anomaly_type)
        if status:
            conditions.append(Anomaly.status == status)

        query = select(Anomaly)
        count_query = select(func.count()).select_from(Anomaly)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(desc(Anomaly.created_at)).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def create(self, anomaly: Anomaly) -> Anomaly:
        self.session.add(anomaly)
        await self.session.flush()
        return anomaly

    async def update_status(self, anomaly_id: UUID, status: str) -> Optional[Anomaly]:
        anomaly = await self.get_by_id(anomaly_id)
        if anomaly:
            anomaly.status = status
            await self.session.flush()
        return anomaly

    async def create_review(self, review: AnomalyReview) -> AnomalyReview:
        self.session.add(review)
        await self.session.flush()
        return review

    async def get_shap_explanation(self, fare_id: UUID) -> Optional[ShapExplanation]:
        res = await self.session.execute(
            select(ShapExplanation).where(ShapExplanation.fare_id == fare_id)
        )
        return res.scalars().first()

    async def create_shap_explanation(self, shap: ShapExplanation) -> ShapExplanation:
        self.session.add(shap)
        await self.session.flush()
        return shap
