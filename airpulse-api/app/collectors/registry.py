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

        if (source_name or '').lower() == 'happyfares' or str(source_id).lower() == 'happyfares':
            from app.collectors.crawl4ai_collector import Crawl4AICollector
            return Crawl4AICollector(str(source_id), 'HappyFares')

        if stype == "synthetic" or method == "synthetic":
            return SyntheticCollector(source_id=str(source_id), source_name=source_name)
        if stype == "replay" or method == "replay":
            return ReplayCollector(source_id=str(source_id), source_name=source_name)

        # Check for Yatra / OTA Source 04
        s_low = (source_name or "").lower()
        if "yatra" in s_low or "ota_source_04" in s_low or "ota source 04" in s_low or str(source_id).lower() in ("yatra", "ota_source_04"):
            from app.collectors.yatra import YatraCollector
            return YatraCollector(
                source_id=str(source_id),
                source_name=source_name or "Yatra",
                base_url=base_url,
                rate_limit_per_minute=rate_limit_per_minute,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries,
            )

        if method == "playwright" or stype in ("airline", "ota"):
            # Check for Google Flights / OTA Source 03 live aggregator
            if "google" in s_low or "ota_source_03" in s_low or "ota source 03" in s_low or str(source_id) == "6d555db5-5edd-4a25-b0be-90846646eb52":
                try:
                    from app.collectors.airline.google_flights_collector import GoogleFlightsCollector
                    return GoogleFlightsCollector(
                        source_id=str(source_id),
                        source_name=source_name or "Live Portal Aggregator (Google Flights)",
                        rate_limit_per_minute=rate_limit_per_minute,
                        timeout_seconds=timeout_seconds,
                    )
                except Exception:
                    pass

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
