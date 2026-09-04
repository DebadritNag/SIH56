from typing import Dict, Optional

from app.collectors.base import BaseCollector
from app.collectors.replay_collector import ReplayCollector
from app.collectors.static_collector import StaticCollector
from app.collectors.synthetic_collector import SyntheticCollector


class CollectorRegistry:
    """Central registry mapping source names/types to collector implementations."""

    _registry: Dict[str, BaseCollector] = {}

    @classmethod
    def register(cls, source_id: str, collector: BaseCollector) -> None:
        cls._registry[str(source_id)] = collector

    @classmethod
    def get_collector(cls, source_id: str) -> BaseCollector:
        if str(source_id) in cls._registry:
            return cls._registry[str(source_id)]
        # Default fallback to ReplayCollector for demo mode resilience
        return ReplayCollector(source_id=str(source_id), source_name="DefaultReplaySource")

    @classmethod
    def build_for_source(
        cls,
        source_id: str,
        source_name: str,
        source_type: str,
        collection_method: Optional[str] = None,
        base_url: Optional[str] = None,
        rate_limit_per_minute: int = 60,
        timeout_seconds: int = 30,
        max_retries: int = 3,
    ) -> BaseCollector:
        """
        Construct the appropriate collector for a source row.

        Selection priority:
          * explicit registration (test/override) wins
          * PLAYWRIGHT airline sources -> concrete live airline adapter (config-driven)
          * SYNTHETIC -> SyntheticCollector
          * REPLAY -> ReplayCollector
          * HTTP/API with base_url -> StaticCollector
          * fallback -> ReplayCollector (demo resilience)

        Live airline adapters are returned even when their selectors are disabled; in that
        state they raise a NOT_CONFIGURED ScraperError on collect() rather than silently
        producing fake data. Callers that want demo data should pick a REPLAY/SYNTHETIC
        source explicitly.
        """
        if str(source_id) in cls._registry:
            return cls._registry[str(source_id)]

        stype = (source_type or "").lower()
        method = (collection_method or "").lower()

        if stype == "synthetic" or method == "synthetic":
            return SyntheticCollector(source_id=str(source_id), source_name=source_name)
        if stype == "replay" or method == "replay":
            return ReplayCollector(source_id=str(source_id), source_name=source_name)

        if method == "playwright" or stype == "airline":
            # Lazy import keeps Playwright fully optional.
            try:
                from app.collectors.airline.adapters import build_airline_collector

                collector = build_airline_collector(
                    source_name=source_name,
                    source_id=str(source_id),
                    rate_limit_per_minute=rate_limit_per_minute,
                    timeout_seconds=timeout_seconds,
                    max_retries=max_retries,
                )
                if collector is not None:
                    return collector
            except Exception:
                pass  # fall through to other options

        if method == "scrapy":
            from app.collectors.scrapy_collector import ScrapyCollector
            return ScrapyCollector(
                source_id=str(source_id),
                source_name=source_name,
                base_url=base_url,
                rate_limit_per_minute=rate_limit_per_minute,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries,
            )

        if method in ("http", "api") and base_url:
            return StaticCollector(source_id=str(source_id), source_name=source_name, base_url=base_url)

        return ReplayCollector(source_id=str(source_id), source_name=source_name)
