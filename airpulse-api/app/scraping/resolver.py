"""
Engine Resolver for AirPulse Collection.

Implements deterministic decision logic for AUTO, SCRAPY, and PLAYWRIGHT engines.
Enforces zero-evasion rules: 403, 429, CAPTCHA, or access challenges strictly HALT collection
and MUST NOT trigger fallback/escalation to Playwright.
Escalation to Playwright is permitted ONLY upon HTTP 200 where the source adapter positively
identifies that required fare content depends on client-side JavaScript execution.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.core.enums import CollectionEngine, EngineOutcome, ScrapeFailureStage
from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import BaseCollectionEngine, EngineResult
from app.scraping.engines.playwright_engine import PlaywrightEngine
from app.scraping.engines.replay_engine import ReplayEngine
from app.scraping.engines.scrapy_engine import ScrapyEngine

logger = logging.getLogger(__name__)


class EngineResolver:
    """
    Central Engine Resolver coordinating Scrapy, Playwright, and Replay engines.
    """

    def __init__(
        self,
        scrapy_engine: Optional[ScrapyEngine] = None,
        playwright_engine: Optional[PlaywrightEngine] = None,
        replay_engine: Optional[ReplayEngine] = None,
    ):
        self.scrapy_engine = scrapy_engine or ScrapyEngine()
        self.playwright_engine = playwright_engine or PlaywrightEngine()
        self.replay_engine = replay_engine or ReplayEngine()

    async def resolve_and_execute(
        self,
        request: SearchRequest,
        adapter: SourceAdapter,
        preferred_engine: Optional[str] = "AUTO",
        source_config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> EngineResult:
        """
        Resolves the appropriate collection engine and executes the search request.
        """
        cfg = source_config or {}
        pref = (preferred_engine or cfg.get("preferred_engine") or "AUTO").upper()

        # Handle explicit Replay
        if pref == "REPLAY":
            return await self.replay_engine.execute(request, adapter, **kwargs)

        # Handle explicit manual override for PLAYWRIGHT
        if pref == "PLAYWRIGHT":
            if not adapter.supports_playwright():
                return EngineResult(
                    status=EngineOutcome.FAILED.value,
                    engine=CollectionEngine.PLAYWRIGHT.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    failure_code="UNSUPPORTED_ENGINE",
                    failure_message=f"Source {adapter.source_name} does not support Playwright.",
                )
            return await self.playwright_engine.execute(request, adapter, **kwargs)

        # Handle explicit manual override for SCRAPY
        if pref == "SCRAPY":
            if not adapter.supports_scrapy():
                return EngineResult(
                    status=EngineOutcome.FAILED.value,
                    engine=CollectionEngine.SCRAPY.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    failure_code="UNSUPPORTED_ENGINE",
                    failure_message=f"Source {adapter.source_name} does not support Scrapy.",
                )
            return await self.scrapy_engine.execute(request, adapter, **kwargs)

        # -------------------------------------------------------------
        # AUTO MODE DECISION LOGIC
        # -------------------------------------------------------------
        requires_js = adapter.requires_javascript(request) or cfg.get("requires_javascript", False)

        # 1. If source is known to require JS upfront -> Use Playwright directly
        if requires_js:
            if adapter.supports_playwright():
                logger.info(f"[EngineResolver] AUTO: Source {adapter.source_name} requires JavaScript. Selecting Playwright.")
                res = await self.playwright_engine.execute(request, adapter, **kwargs)
                res.metadata["engine_decision"] = "AUTO_DIRECT_PLAYWRIGHT_JS_REQUIRED"
                return res

        # 2. Otherwise try Scrapy / HTTP collection first
        if adapter.supports_scrapy():
            logger.info(f"[EngineResolver] AUTO: Attempting Scrapy collection for {adapter.source_name}.")
            scrapy_res = await self.scrapy_engine.execute(request, adapter, **kwargs)

            # Check for Access Restrictions / Challenges (Zero-Evasion: MUST STOP)
            if scrapy_res.status in (
                EngineOutcome.BLOCKED.value,
                EngineOutcome.CAPTCHA_DETECTED.value,
                EngineOutcome.RATE_LIMITED.value,
                EngineOutcome.AUTH_REQUIRED.value,
            ):
                logger.warning(
                    f"[EngineResolver] AUTO: Scrapy encountered access restriction ({scrapy_res.status}). "
                    f"Zero-evasion policy active: HALTING collection without browser fallback."
                )
                scrapy_res.metadata["engine_decision"] = "AUTO_SCRAPY_HALTED_ACCESS_RESTRICTION"
                return scrapy_res

            # Check for explicit No Availability or Parse Error (DO NOT ESCALATE)
            if scrapy_res.status in (
                EngineOutcome.NO_AVAILABILITY.value,
                EngineOutcome.PARSE_ERROR.value,
            ):
                logger.info(f"[EngineResolver] AUTO: Scrapy completed with {scrapy_res.status}. Not escalating to browser.")
                scrapy_res.metadata["engine_decision"] = "AUTO_SCRAPY_TERMINAL"
                return scrapy_res

            # Check for Success
            if scrapy_res.status == EngineOutcome.SUCCESS.value and scrapy_res.quotes_found > 0:
                scrapy_res.metadata["engine_decision"] = "AUTO_SCRAPY_SUCCESS"
                return scrapy_res

            # 3. Check for Permitted Escalation to Playwright:
            # Condition: HTTP 200 + no challenge/block + confirmed client JS shell (CONTENT_REQUIRES_JS)
            if (
                scrapy_res.http_status == 200
                and scrapy_res.status == EngineOutcome.CONTENT_REQUIRES_JS.value
                and adapter.supports_playwright()
            ):
                logger.info(
                    f"[EngineResolver] AUTO: Scrapy received HTTP 200 JS shell for {adapter.source_name}. "
                    f"Escalating to Playwright for client DOM rendering."
                )
                pw_res = await self.playwright_engine.execute(request, adapter, **kwargs)
                pw_res.metadata["engine_decision"] = "AUTO_ESCALATED_SCRAPY_TO_PLAYWRIGHT"
                pw_res.metadata["escalation_reason"] = scrapy_res.failure_message or "HTTP 200 client JS shell detected"
                pw_res.metadata["initial_scrapy_status"] = scrapy_res.status
                return pw_res

            # Any other failure status (Timeout, 5xx error, etc.) -> Return Scrapy outcome
            scrapy_res.metadata["engine_decision"] = "AUTO_SCRAPY_FAILED"
            return scrapy_res

        # Fallback if source does not support Scrapy
        if adapter.supports_playwright():
            return await self.playwright_engine.execute(request, adapter, **kwargs)

        return EngineResult(
            status=EngineOutcome.FAILED.value,
            engine="NONE",
            source_id=adapter.source_id,
            source_name=adapter.source_name,
            failure_code="NO_SUPPORTED_ENGINE",
            failure_message="No supported collection engine found for source.",
        )
