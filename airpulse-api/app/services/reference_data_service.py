from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.db.models import BenchmarkFare, ReferenceDataset, Route, RouteTrafficWeight, Source
from app.collectors.government.mospi_esankhyiki import MospiESankhyikiAdapter
from app.collectors.government.dgca import DgcaAdapter


class ReferenceDataService:
    """Synchronizes official reference datasets (MoSPI eSankhyiki and DGCA).
    Updates route passenger traffic weights and macro benchmark series."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def sync_mospi_dataset(self, dataset_code: str = "MOSPI_CPI_TRANSPORT_2026") -> ReferenceDataset:
        adapter = MospiESankhyikiAdapter()
        meta = await adapter.fetch_metadata(dataset_code)
        payload = await adapter.fetch_dataset(dataset_code)

        # Check or create government source
        src_res = await self.session.execute(
            select(Source).where(Source.name == "MoSPI eSankhyiki")
        )
        src = src_res.scalars().first()
        if not src:
            src = Source(
                id=uuid4(),
                name="MoSPI eSankhyiki",
                display_name="Ministry of Statistics and Programme Implementation",
                source_type="government_api",
                base_url="https://esankhyiki.mospi.gov.in",
                collection_method="api",
            )
            self.session.add(src)
            await self.session.flush()

        ref_ds = ReferenceDataset(
            id=uuid4(),
            source_id=src.id,
            dataset_name="MoSPI CPI Transport Sub-Index Series",
            dataset_code=dataset_code,
            dataset_version="2026.08",
            reference_period_start=date(2026, 8, 1),
            reference_period_end=date(2026, 8, 31),
            retrieved_at=utc_now(),
            source_url="https://esankhyiki.mospi.gov.in",
            checksum=payload["checksum"],
            format="json",
            status="verified",
            dataset_metadata=meta,
            created_at=utc_now(),
        )
        self.session.add(ref_ds)

        # Ingest benchmark series records
        for item in payload["data"]["indices"]:
            b_fare = BenchmarkFare(
                id=uuid4(),
                reference_dataset_id=ref_ds.id,
                route_id=None,
                period_start=date(2026, 8, 1),
                period_end=date(2026, 8, 31),
                benchmark_type="mospi_cpi_transport",
                value=item["index_value"],
                unit="Index Point (2012=100)",
                benchmark_metadata=item,
            )
            self.session.add(b_fare)

        await self.session.commit()
        return ref_ds

    async def sync_dgca_traffic(self, dataset_code: str = "DGCA_CITY_PAIR_TRAFFIC_2026") -> ReferenceDataset:
        adapter = DgcaAdapter()
        meta = await adapter.fetch_metadata(dataset_code)
        payload = await adapter.fetch_dataset(dataset_code)

        src_res = await self.session.execute(
            select(Source).where(Source.name == "DGCA Reference Feed")
        )
        src = src_res.scalars().first()
        if not src:
            src = Source(
                id=uuid4(),
                name="DGCA Reference Feed",
                display_name="Directorate General of Civil Aviation",
                source_type="government_api",
                base_url="https://www.dgca.gov.in",
                collection_method="api",
            )
            self.session.add(src)
            await self.session.flush()

        ref_ds = ReferenceDataset(
            id=uuid4(),
            source_id=src.id,
            dataset_name="DGCA Domestic City-Pair Traffic Statistics",
            dataset_code=dataset_code,
            dataset_version="2026.Q2",
            reference_period_start=date(2026, 4, 1),
            reference_period_end=date(2026, 6, 30),
            retrieved_at=utc_now(),
            source_url="https://www.dgca.gov.in",
            checksum=payload["checksum"],
            format="json",
            status="verified",
            dataset_metadata=meta,
            created_at=utc_now(),
        )
        self.session.add(ref_ds)
        await self.session.flush()

        # Update route traffic weights dynamically in routes table
        routes_res = await self.session.execute(select(Route))
        routes_map = {r.route_code: r for r in routes_res.scalars().all()}

        for item in payload["data"]["traffic_data"]:
            r_code = f"{item['origin']}-{item['destination']}"
            r_obj = routes_map.get(r_code)
            if r_obj:
                r_obj.weight = item["traffic_share"]
                rtw = RouteTrafficWeight(
                    id=uuid4(),
                    reference_dataset_id=ref_ds.id,
                    route_id=r_obj.id,
                    period="2026-Q2",
                    passenger_count=item["passengers_monthly"],
                    traffic_share=item["traffic_share"],
                    weight=item["traffic_share"],
                    source="DGCA",
                    created_at=utc_now(),
                )
                self.session.add(rtw)

        await self.session.commit()
        return ref_ds
