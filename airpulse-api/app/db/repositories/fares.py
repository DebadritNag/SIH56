from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import RawFare, ValidatedFare, FareIndexEligibility
from app.schemas.fare import FareFilterParams


class FareRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_raw_fare(self, raw_fare: RawFare) -> RawFare:
        self.session.add(raw_fare)
        await self.session.flush()
        return raw_fare

    async def get_raw_fare(self, raw_fare_id: UUID) -> Optional[RawFare]:
        res = await self.session.execute(select(RawFare).where(RawFare.id == raw_fare_id))
        return res.scalars().first()

    async def create_validated_fare(self, val_fare: ValidatedFare) -> ValidatedFare:
        self.session.add(val_fare)
        await self.session.flush()
        return val_fare

    async def get_validated_fare_by_id(self, fare_id: UUID) -> Optional[ValidatedFare]:
        res = await self.session.execute(select(ValidatedFare).where(ValidatedFare.id == fare_id))
        return res.scalars().first()

    async def get_validated_fare_by_quote_hash(self, quote_hash: str) -> Optional[ValidatedFare]:
        res = await self.session.execute(
            select(ValidatedFare).where(ValidatedFare.quote_hash == quote_hash)
        )
        return res.scalars().first()

    async def list_validated_fares(
        self, filters: FareFilterParams, limit: int = 50, offset: int = 0
    ) -> Tuple[List[ValidatedFare], int]:
        conditions = []
        if filters.origin:
            conditions.append(ValidatedFare.origin == filters.origin.upper())
        if filters.destination:
            conditions.append(ValidatedFare.destination == filters.destination.upper())
        if filters.airline:
            conditions.append(ValidatedFare.airline == filters.airline.upper())
        if filters.date_from:
            conditions.append(func.date(ValidatedFare.departure_at) >= filters.date_from)
        if filters.date_to:
            conditions.append(func.date(ValidatedFare.departure_at) <= filters.date_to)
        if filters.booking_window is not None:
            conditions.append(ValidatedFare.booking_window_days == filters.booking_window)
        if filters.min_fare is not None:
            conditions.append(ValidatedFare.normalized_total_fare >= filters.min_fare)
        if filters.max_fare is not None:
            conditions.append(ValidatedFare.normalized_total_fare <= filters.max_fare)
        if filters.validation_status:
            conditions.append(ValidatedFare.validation_status == filters.validation_status)

        query = select(ValidatedFare)
        count_query = select(func.count()).select_from(ValidatedFare)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(desc(ValidatedFare.collected_at)).offset(offset).limit(limit)
        items_res = await self.session.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    async def record_eligibility(self, eligibility: FareIndexEligibility) -> FareIndexEligibility:
        self.session.add(eligibility)
        await self.session.flush()
        return eligibility
