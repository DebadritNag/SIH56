"""
Registry for AirPulse Source Adapters.
Maps source IDs, names, or slugs to concrete SourceAdapter implementations.
"""
from __future__ import annotations

from typing import Dict, Optional, Type

from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.adapters.mock_adapters import (
    BlockedSourceAdapter,
    JsSourceAdapter,
    StaticSourceAdapter,
)
from app.scraping.engines.base import RawQuote
from app.scraping.parsers import parse_flight_cards_html


class GenericPortalAdapter(SourceAdapter):
    """Generic adapter for portals using standard selectors/templates."""

    def __init__(
        self,
        source_id: str,
        source_name: str,
        base_url: Optional[str] = None,
        requires_js: bool = False,
    ):
        self._source_id = source_id
        self._source_name = source_name
        self._base_url = base_url or "https://www.google.com/travel/flights"
        self._requires_js = requires_js

    @property
    def source_id(self) -> str:
        return self._source_id

    @property
    def source_name(self) -> str:
        return self._source_name

    def requires_javascript(self, request: SearchRequest) -> bool:
        return self._requires_js

    def build_url(self, request: SearchRequest) -> str:
        dep_str = str(request.departure_date)
        norm_name = (self.source_name or "").lower()
        if "makemytrip" in norm_name:
            cabin_val = getattr(request.cabin, "value", "E") if hasattr(request.cabin, "value") else "E"
            return f"https://www.makemytrip.com/flight/search?itinerary={request.origin}-{request.destination}-{dep_str}&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass={cabin_val}"
        elif "indigo" in norm_name:
            return f"https://www.goindigo.in/booking/search-flights?origin={request.origin}&destination={request.destination}&departure={dep_str}&adults=1&class=E"
        elif "airindia" in norm_name or "air_india" in norm_name:
            return f"https://www.airindia.com/in/en/booking/flight-search?from={request.origin}&to={request.destination}&departDate={dep_str}&adult=1&cabin=Economy"
        elif self._base_url and "google.com" not in self._base_url:
            return f"{self._base_url}/search?origin={request.origin}&destination={request.destination}&date={dep_str}"
        return f"{self._base_url}?q=Flights+from+{request.origin}+to+{request.destination}+on+{dep_str}&curr=INR"

    def parse_scrapy_response(self, response_data: dict, request: SearchRequest):
        return parse_flight_cards_html(
            html_content=response_data.get("body", ""),
            origin=request.origin,
            destination=request.destination,
            departure_date=str(request.departure_date),
            source_name=self.source_name,
            engine_name="SCRAPY",
            http_status=response_data.get("http_status", 200),
        )


class AdapterRegistry:
    """Registry managing source adapters."""

    _registry: Dict[str, SourceAdapter] = {
        "test_static_source": StaticSourceAdapter(),
        "test_js_source": JsSourceAdapter(),
        "test_blocked_source": BlockedSourceAdapter(),
    }

    @classmethod
    def register(cls, source_id: str, adapter: SourceAdapter) -> None:
        cls._registry[str(source_id)] = adapter

    @classmethod
    def get_adapter(
        cls,
        source_id: Optional[str] = None,
        source_name: Optional[str] = None,
        base_url: Optional[str] = None,
        requires_js: bool = False,
    ) -> SourceAdapter:
        # Check by ID
        if source_id and str(source_id) in cls._registry:
            return cls._registry[str(source_id)]

        # Check by normalized name
        norm_name = (source_name or "").lower().strip()
        for key, adapter in cls._registry.items():
            if key.lower() in norm_name or adapter.source_name.lower() in norm_name:
                return adapter

        # Known airline/OTA types
        is_ota = any(k in norm_name for k in ("ota", "makemytrip", "easemytrip", "cleartrip"))
        is_airline = any(k in norm_name for k in ("indigo", "air india", "spicejet", "akasa"))

        # Airlines and OTAs typically require client JS rendering on their portals
        needs_js = requires_js or is_airline or is_ota

        return GenericPortalAdapter(
            source_id=source_id or "generic_source",
            source_name=source_name or "Generic Portal",
            base_url=base_url,
            requires_js=needs_js,
        )
