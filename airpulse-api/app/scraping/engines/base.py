"""
Base interfaces, schemas, and result containers for collection engines.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.core.enums import CollectionEngine, EngineOutcome, ScrapeFailureStage
from app.schemas.runs import SearchRequest


@dataclass
class Provenance:
    engine: str  # "SCRAPY", "PLAYWRIGHT", "REPLAY"
    engine_version: str
    observed_at: str
    source: str
    requested_url: Optional[str] = None
    collection_run_id: Optional[str] = None
    http_status: Optional[int] = None
    response_hash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RawQuote:
    carrier: str
    flight_number: str
    departure_time: str
    arrival_time: str
    origin: str
    destination: str
    departure_date: str
    currency: str
    base_price: float
    tax_amount: float
    mandatory_fees: float
    gross_total: float
    provenance: Dict[str, Any]
    cabin_class: str = "economy"
    fare_class: str = "STANDARD"
    is_non_stop: bool = True
    seats_available: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EngineResult:
    status: str  # e.g. "SUCCESS", "CONTENT_REQUIRES_JS", "BLOCKED", etc.
    engine: str  # "SCRAPY", "PLAYWRIGHT", "REPLAY"
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    http_status: Optional[int] = None
    quotes: List[Dict[str, Any]] = field(default_factory=list)
    quotes_found: int = 0
    results_seen: int = 0
    results_matching: int = 0
    results_collected: int = 0
    pages_requested: int = 1
    max_results: int = 15
    stop_reason: str = "PAGE_EXHAUSTED"
    requires_js: bool = False
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    duration_ms: int = 0
    raw_artifact_id: Optional[str] = None
    raw_payload_hash: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


class BaseCollectionEngine(ABC):
    """Abstract base for AirPulse collection engines (Scrapy, Playwright, Replay)."""

    def __init__(self, engine_name: CollectionEngine, engine_version: str):
        self.engine_name = engine_name
        self.engine_version = engine_version

    @abstractmethod
    async def execute(
        self,
        request: SearchRequest,
        adapter: Any,
        **kwargs: Any,
    ) -> EngineResult:
        """Executes a single search request and returns structured EngineResult."""
        pass
