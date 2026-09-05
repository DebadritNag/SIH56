"""
Yatra OTA Collector for AirPulse.
Implements the first experimental OTA airfare source using AirPulse collection architecture.

Target flow:
SearchRequest -> YatraCollector -> EngineResolver -> Scrapy first -> Playwright only on HTTP 200 JS shell
-> Bounded 10-15 quotes -> raw_fares -> normalize -> validate -> deduplicate -> validated_fares.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.collectors.base import BaseCollector
from app.core.enums import ScrapeFailureStage
from app.core.exceptions import ScraperError
from app.schemas.runs import SearchRequest
from app.scraping.adapters.yatra import YatraAdapter
from app.scraping.resolver import EngineResolver

logger = logging.getLogger(__name__)


class YatraCollector(BaseCollector):
    """
    Collector for Yatra OTA portal adhering to strict zero-evasion ethics:
    - Attempts Scrapy HTTP collection first.
    - Escalates to Playwright only upon HTTP 200 confirmed client JS shell.
    - Halts immediately on 403, 429, or CAPTCHA/challenge without evasion.
    - Enforces bounded collection of maximum 10-15 fare observations.
    """

    def __init__(
        self,
        source_id: str = "yatra",
        source_name: str = "Yatra",
        base_url: Optional[str] = None,
        rate_limit_per_minute: int = 20,
        timeout_seconds: int = 30,
        max_retries: int = 1,
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            collector_version="1.0.0-yatra",
            rate_limit_per_minute=rate_limit_per_minute,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
        )
        self.base_url = base_url
        self.adapter = YatraAdapter(base_url=base_url)
        self.resolver = EngineResolver()

    async def collect(
        self,
        search_request: SearchRequest,
        preferred_engine: Optional[str] = "AUTO",
    ) -> List[Dict[str, Any]]:
        """
        Collects raw airfare observations for search request via EngineResolver.
        Returns raw vendor payloads bounded to max_results (10-15).
        """
        # Ensure max_results is bounded to max 15 per Section 15
        requested_max = getattr(search_request, "max_results", None) or 10
        bounded_max = min(max(1, int(requested_max)), 15)
        search_request.max_results = bounded_max

        logger.info(
            f"[YatraCollector] Dispatching search request: "
            f"{search_request.origin} -> {search_request.destination} on {search_request.departure_date} "
            f"(preferred_engine={preferred_engine}, max_results={bounded_max})"
        )

        res = await self.resolver.resolve_and_execute(
            request=search_request,
            adapter=self.adapter,
            preferred_engine=preferred_engine,
        )

        if res.status != "SUCCESS":
            # Map failure status to ScrapeFailureStage
            failure_stage = ScrapeFailureStage.HTTP_ERROR
            if res.status == "BLOCKED":
                failure_stage = ScrapeFailureStage.BLOCKED
            elif res.status == "CAPTCHA_DETECTED":
                failure_stage = ScrapeFailureStage.CAPTCHA_DETECTED
            elif res.status == "RATE_LIMITED":
                failure_stage = ScrapeFailureStage.RATE_LIMITED
            elif res.status == "TIMEOUT":
                failure_stage = ScrapeFailureStage.TIMEOUT
            elif res.status == "CONTENT_REQUIRES_JS":
                failure_stage = ScrapeFailureStage.CONTENT_REQUIRES_JS
            elif res.status == "PARSE_ERROR":
                failure_stage = ScrapeFailureStage.PARSE_ERROR
            elif res.status == "NO_AVAILABILITY":
                failure_stage = ScrapeFailureStage.NO_AVAILABILITY
            else:
                try:
                    if res.failure_code:
                        failure_stage = ScrapeFailureStage(res.failure_code)
                except Exception:
                    pass

            raise ScraperError(
                stage=failure_stage,
                message=res.failure_message or f"Yatra collection halted with status {res.status}",
                http_status=res.http_status or 200,
            )

        # Convert RawQuote items to dictionaries for raw envelope creation
        raw_quotes: List[Dict[str, Any]] = []
        for q in res.quotes:
            q_dict = q.to_dict() if hasattr(q, "to_dict") else dict(q)
            # Add canonical aliases for FareParser / domain pipeline
            q_dict["src"] = q_dict.get("origin") or search_request.origin.upper()
            q_dict["dst"] = q_dict.get("destination") or search_request.destination.upper()
            q_dict["flight_no"] = q_dict.get("flight_number")
            dep_d = q_dict.get("departure_date") or str(search_request.departure_date)
            dep_t = q_dict.get("departure_time") or "06:00"
            q_dict["departure_iso"] = f"{dep_d}T{dep_t}:00Z"
            raw_quotes.append(q_dict)

        # Cap strictly at bounded_max
        return raw_quotes[:bounded_max]

    def parse(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Pass-through of already structured raw payload."""
        return raw_payload

    async def health_check(self) -> Dict[str, Any]:
        """Checks Yatra availability and status."""
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "status": "CONFIGURED",
            "preferred_engine": "AUTO",
            "rate_limit_per_minute": self.rate_limit_per_minute,
            "timeout_seconds": self.timeout_seconds,
        }
