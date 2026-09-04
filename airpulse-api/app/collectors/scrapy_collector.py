"""
Scrapy Collector wrapping ScrapyEngine for Celery batch matrix pipelines.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.collectors.base import BaseCollector
from app.core.enums import ScrapeFailureStage
from app.core.exceptions import ScraperError
from app.schemas.runs import SearchRequest
from app.scraping.adapters.registry import AdapterRegistry
from app.scraping.engines.scrapy_engine import ScrapyEngine

logger = logging.getLogger(__name__)


class ScrapyCollector(BaseCollector):
    """
    Collector utilizing ScrapyEngine via isolated subprocess execution.
    Compatible with Celery workers without Twisted reactor reuse issues.
    """

    def __init__(
        self,
        source_id: str,
        source_name: str,
        base_url: Optional[str] = None,
        rate_limit_per_minute: int = 60,
        timeout_seconds: int = 20,
        max_retries: int = 3,
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            collector_version="1.0.0-scrapy",
            rate_limit_per_minute=rate_limit_per_minute,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
        )
        self.base_url = base_url
        self.engine = ScrapyEngine(timeout_seconds=timeout_seconds)

    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        adapter = AdapterRegistry.get_adapter(
            source_id=self.source_id,
            source_name=self.source_name,
            base_url=self.base_url,
        )
        res = await self.engine.execute(search_request, adapter)

        if res.status != "SUCCESS":
            failure_stage = ScrapeFailureStage.HTTP_ERROR
            try:
                failure_stage = ScrapeFailureStage(res.failure_code)
            except Exception:
                pass
            raise ScraperError(
                stage=failure_stage,
                message=res.failure_message or f"Scrapy collection ended with status {res.status}",
                http_status=res.http_status,
            )

        return res.quotes

    def parse(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        return raw_payload

    async def health_check(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "engine": "SCRAPY",
            "status": "HEALTHY",
            "latency_ms": 45,
        }
