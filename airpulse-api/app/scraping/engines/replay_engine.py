"""
Replay Collection Engine for AirPulse.
Used for deterministic demo and verification replays.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from app.core.enums import CollectionEngine, EngineOutcome
from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import BaseCollectionEngine, EngineResult, Provenance, RawQuote


class ReplayEngine(BaseCollectionEngine):
    """Deterministic Replay Engine for offline simulation and unit test harness."""

    def __init__(self):
        super().__init__(
            engine_name=CollectionEngine.REPLAY,
            engine_version="replay-1.0.0",
        )

    async def execute(
        self,
        request: SearchRequest,
        adapter: SourceAdapter,
        **kwargs: Any,
    ) -> EngineResult:
        started_at = time.monotonic()
        dep_str = str(request.departure_date)

        quotes = [
            RawQuote(
                carrier="6E",
                flight_number="6E-505",
                departure_time="07:15",
                arrival_time="09:25",
                origin=request.origin.upper(),
                destination=request.destination.upper(),
                departure_date=dep_str,
                currency="INR",
                base_price=4600.0,
                tax_amount=552.0,
                mandatory_fees=148.0,
                gross_total=5300.0,
                provenance={
                    "engine": CollectionEngine.REPLAY.value,
                    "engine_version": "replay-1.0.0",
                    "source": adapter.source_name,
                    "observed_at": "2026-09-04T12:00:00Z",
                },
            ),
            RawQuote(
                carrier="AI",
                flight_number="AI-808",
                departure_time="10:30",
                arrival_time="12:45",
                origin=request.origin.upper(),
                destination=request.destination.upper(),
                departure_date=dep_str,
                currency="INR",
                base_price=5400.0,
                tax_amount=648.0,
                mandatory_fees=202.0,
                gross_total=6250.0,
                provenance={
                    "engine": CollectionEngine.REPLAY.value,
                    "engine_version": "replay-1.0.0",
                    "source": adapter.source_name,
                    "observed_at": "2026-09-04T12:00:00Z",
                },
            ),
        ]
        duration_ms = int((time.monotonic() - started_at) * 1000)
        return EngineResult(
            status=EngineOutcome.SUCCESS.value,
            engine=CollectionEngine.REPLAY.value,
            source_id=adapter.source_id,
            source_name=adapter.source_name,
            http_status=200,
            quotes=[q.to_dict() for q in quotes],
            quotes_found=len(quotes),
            requires_js=False,
            duration_ms=duration_ms,
        )
