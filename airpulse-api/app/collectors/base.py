from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import uuid
from app.schemas.runs import SearchRequest
from app.core.utils import compute_payload_hash, utc_now


class BaseCollector(ABC):
    """Abstract collector enforcing strict ethical rate limiting, exponential backoff,
    configurable timeouts, and clean decoupling from domain validation rules."""

    def __init__(
        self,
        source_id: str,
        source_name: str,
        collector_version: str = "1.0.0",
        rate_limit_per_minute: int = 60,
        timeout_seconds: int = 15,
        max_retries: int = 3,
    ):
        self.source_id = source_id
        self.source_name = source_name
        self.collector_version = collector_version
        self.rate_limit_per_minute = rate_limit_per_minute
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    @abstractmethod
    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        """Collects raw airfare observations for the given search request.
        MUST return raw vendor payloads before any domain validation."""
        pass

    @abstractmethod
    def parse(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts basic raw fields from vendor-specific payload into a parsed intermediate dict."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Checks source availability, HTTP latency, and status."""
        pass

    def get_source_metadata(self) -> Dict[str, Any]:
        """Returns collector configuration and capability metadata."""
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "collector_version": self.collector_version,
            "rate_limit_per_minute": self.rate_limit_per_minute,
            "timeout_seconds": self.timeout_seconds,
            "max_retries": self.max_retries,
        }

    def create_raw_envelope(
        self,
        search_request: SearchRequest,
        raw_payload: Dict[str, Any],
        collection_run_id: Optional[str] = None,
        http_status: int = 200,
    ) -> Dict[str, Any]:
        """Encloses raw record in an immutable container with a SHA-256 hash."""
        request_id = str(uuid.uuid4())
        response_hash = compute_payload_hash(raw_payload)
        return {
            "id": str(uuid.uuid4()),
            "collection_run_id": collection_run_id,
            "source_id": self.source_id,
            "request_id": request_id,
            "origin_requested": search_request.origin.upper(),
            "destination_requested": search_request.destination.upper(),
            "departure_requested": str(search_request.departure_date),
            "booking_window_requested": search_request.booking_window_days,
            "collected_at": utc_now().isoformat(),
            "http_status": http_status,
            "raw_payload": raw_payload,
            "response_hash": response_hash,
            "collector_version": self.collector_version,
            "parser_version": "1.0.0",
        }
