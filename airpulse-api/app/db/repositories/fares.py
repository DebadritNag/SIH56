from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import RawFare, Source, ValidatedFare, FareIndexEligibility
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
        from app.services.data_context_resolver import live_fare_predicate
        conditions = [live_fare_predicate()]
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
            ranges = {1: (0, 2), 7: (3, 10), 15: (11, 20), 30: (21, 35), 45: (36, 365)}
            conditions.append(ValidatedFare.booking_window_days.between(*ranges[filters.booking_window]) if filters.booking_window in ranges else ValidatedFare.booking_window_days == filters.booking_window)
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

        # Attach source identity fields so ValidatedFareResponse can include them
        # without requiring a second query per row on the API layer.
        # Collect unique source IDs first, then bulk-fetch once.
        source_ids = {item.source_id for item in items if item.source_id is not None}
        source_map: dict = {}
        if source_ids:
            src_res = await self.session.execute(
                select(Source).where(Source.id.in_(source_ids))
            )
            for src in src_res.scalars().all():
                source_map[src.id] = src

        for item in items:
            src = source_map.get(item.source_id) if item.source_id else None
            # Dynamically set these so Pydantic from_attributes picks them up.
            item._source_name = src.name if src else None
            item._source_display_name = src.display_name if src else None
            # Prefer collection_method from Source; fall back based on data_origin.
            if src:
                item._acquisition_method = src.collection_method or (
                    "CSV_IMPORT" if item.data_origin == "IMPORTED" else "HTTP"
                )
            else:
                item._acquisition_method = "CSV_IMPORT" if item.data_origin == "IMPORTED" else None

        return items, total

    async def record_eligibility(self, eligibility: FareIndexEligibility) -> FareIndexEligibility:
        self.session.add(eligibility)
        await self.session.flush()
        return eligibility
