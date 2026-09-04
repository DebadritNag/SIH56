"""
Playwright Collection Engine for AirPulse.

Executes JavaScript-rendered search workflows using the 5-tier Browser Capability Resolver.
Strictly reports BROWSER_UNAVAILABLE if no browser binary is installed (never fakes telemetry).
"""
from __future__ import annotations

import asyncio
import gc
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional

from app.core.enums import CollectionEngine, EngineOutcome, ScrapeFailureStage, StopReason
from app.schemas.runs import SearchRequest
from app.services.browser_service import SharedBrowserService, get_shared_browser_service
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import BaseCollectionEngine, EngineResult, Provenance, RawQuote
from app.scraping.parsers import parse_flight_cards_html

logger = logging.getLogger(__name__)


class PlaywrightEngine(BaseCollectionEngine):
    """
    Playwright collection engine for true JavaScript requirements.
    Respects system browser capabilities, isolated contexts, and ethical zero-evasion rules.
    """

    def __init__(self, timeout_seconds: int = 30):
        super().__init__(
            engine_name=CollectionEngine.PLAYWRIGHT,
            engine_version="playwright-1.44.0",
        )
        self.timeout_seconds = timeout_seconds

    async def execute(
        self,
        request: SearchRequest,
        adapter: SourceAdapter,
        **kwargs: Any,
    ) -> EngineResult:
        started_at = time.monotonic()

        raw_max = getattr(request, "max_results", None) or kwargs.get("max_results", 15)
        try:
            bounded_max = min(max(1, int(raw_max)), 20)
        except (TypeError, ValueError):
            bounded_max = 15

        is_nonstop = (
            getattr(request, "is_nonstop", None)
            if getattr(request, "is_nonstop", None) is not None
            else kwargs.get("is_nonstop")
        )
        cabin = getattr(request, "cabin", None) or kwargs.get("cabin")

        # Allow mock_response bypass for tests / unit verification
        mock_response = kwargs.get("mock_response")
        if mock_response is not None:
            duration_ms = int((time.monotonic() - started_at) * 1000)
            status_code = mock_response.get("http_status", 200)
            body = mock_response.get("body", "")
            if status_code == 403:
                return EngineResult(
                    status=EngineOutcome.BLOCKED.value,
                    engine=CollectionEngine.PLAYWRIGHT.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=403,
                    quotes=[],
                    quotes_found=0,
                    requires_js=True,
                    failure_code=ScrapeFailureStage.BLOCKED.value,
                    failure_message="HTTP 403 Forbidden.",
                    duration_ms=duration_ms,
                    results_seen=0,
                    results_matching=0,
                    results_collected=0,
                    pages_requested=1,
                    max_results=bounded_max,
                    stop_reason=StopReason.BLOCKED.value,
                )
            quotes, metrics = parse_flight_cards_html(
                html_content=body,
                origin=request.origin,
                destination=request.destination,
                departure_date=str(request.departure_date),
                source_name=adapter.source_name,
                engine_name=CollectionEngine.PLAYWRIGHT.value,
                http_status=status_code,
                max_results=bounded_max,
                is_nonstop=is_nonstop,
                cabin=cabin,
                return_metrics=True,
            )
            return EngineResult(
                status=EngineOutcome.SUCCESS.value if quotes else EngineOutcome.NO_AVAILABILITY.value,
                engine=CollectionEngine.PLAYWRIGHT.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=status_code,
                quotes=[q.to_dict() for q in quotes],
                quotes_found=len(quotes),
                requires_js=True,
                failure_code=None if quotes else ScrapeFailureStage.NO_AVAILABILITY.value,
                failure_message=None if quotes else "Zero flight quotes extracted.",
                duration_ms=duration_ms,
                results_seen=metrics["results_seen"],
                results_matching=metrics["results_matching"],
                results_collected=metrics["results_collected"],
                pages_requested=1,
                max_results=bounded_max,
                stop_reason=metrics["stop_reason"],
            )

        browser_service = get_shared_browser_service()
        capability = browser_service.get_capability()

        # Strict browser availability gate
        if capability.launch_status != "SUCCESS":
            duration_ms = int((time.monotonic() - started_at) * 1000)
            return EngineResult(
                status=EngineOutcome.BROWSER_UNAVAILABLE.value,
                engine=CollectionEngine.PLAYWRIGHT.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=None,
                quotes=[],
                quotes_found=0,
                requires_js=True,
                failure_code=ScrapeFailureStage.BROWSER_UNAVAILABLE.value,
                failure_message=f"No compatible browser binary found. Resolver status: {capability.launch_status}",
                duration_ms=duration_ms,
                metadata=capability.to_dict(),
                results_seen=0,
                results_matching=0,
                results_collected=0,
                pages_requested=0,
                max_results=bounded_max,
                stop_reason=StopReason.ERROR.value,
            )

        page = None
        context = None
        try:
            target_url = adapter.build_url(request)
            page, context = await browser_service.create_isolated_page(
                source_key=adapter.source_id,
                block_heavy_resources=True,
            )

            http_status, title, body_text = await browser_service.navigate_safely(
                page=page,
                url=target_url,
                nav_timeout_ms=self.timeout_seconds * 1000,
                wait_until="commit",
            )

            # Check for security challenges
            challenge_res = await browser_service.check_for_challenges(
                page=page,
                http_status=http_status,
                title=title,
                content=body_text,
            )
            if challenge_res.detected:
                duration_ms = int((time.monotonic() - started_at) * 1000)
                stage = challenge_res.stage or ScrapeFailureStage.BLOCKED
                outcome = (
                    EngineOutcome.CAPTCHA_DETECTED.value
                    if stage == ScrapeFailureStage.CAPTCHA_DETECTED
                    else EngineOutcome.BLOCKED.value
                )
                stop_reason = (
                    StopReason.CAPTCHA_DETECTED.value
                    if stage == ScrapeFailureStage.CAPTCHA_DETECTED
                    else StopReason.BLOCKED.value
                )
                return EngineResult(
                    status=outcome,
                    engine=CollectionEngine.PLAYWRIGHT.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=http_status,
                    quotes=[],
                    quotes_found=0,
                    requires_js=True,
                    failure_code=stage.value,
                    failure_message=challenge_res.reason or "Security challenge detected.",
                    duration_ms=duration_ms,
                    results_seen=0,
                    results_matching=0,
                    results_collected=0,
                    pages_requested=1,
                    max_results=bounded_max,
                    stop_reason=stop_reason,
                )

            # Let adapter run custom Playwright DOM interactions or parse hydrated page
            quotes: List[RawQuote] = []
            metrics: Dict[str, Any] = {
                "results_seen": 0,
                "results_matching": 0,
                "results_collected": 0,
                "max_results": bounded_max,
                "stop_reason": StopReason.PAGE_EXHAUSTED.value,
            }
            try:
                raw_adapter_quotes = await adapter.run_playwright_flow(page, request)
                seen_count = len(raw_adapter_quotes)
                filtered_quotes: List[RawQuote] = []
                for q in raw_adapter_quotes:
                    if len(filtered_quotes) >= bounded_max:
                        break
                    filtered_quotes.append(q)
                quotes = filtered_quotes
                stop_reason = (
                    StopReason.RESULT_LIMIT_REACHED.value
                    if len(quotes) >= bounded_max
                    else (
                        StopReason.PAGE_EXHAUSTED.value
                        if len(quotes) > 0
                        else StopReason.NO_AVAILABILITY.value
                    )
                )
                metrics = {
                    "results_seen": seen_count,
                    "results_matching": seen_count,
                    "results_collected": len(quotes),
                    "max_results": bounded_max,
                    "stop_reason": stop_reason,
                }
            except NotImplementedError:
                # Bounded incremental scroll: do not scroll endlessly, check card count and stop once bounded_max is met
                card_selector = ".flight-card, .flight-row, tr.flight-item, div.fare-card, [data-testid='flight-card']"
                current_card_count = 0
                try:
                    cards = await page.query_selector_all(card_selector)
                    current_card_count = len(cards)
                except Exception:
                    pass

                # If initial cards < bounded_max, scroll in small increments up to 4 times
                scroll_steps = 0
                while current_card_count < bounded_max and scroll_steps < 4:
                    scroll_steps += 1
                    try:
                        await page.evaluate("window.scrollBy(0, 800)")
                        await asyncio.sleep(0.4)
                        cards = await page.query_selector_all(card_selector)
                        if len(cards) <= current_card_count:
                            # Reached bottom or no new cards rendered
                            break
                        current_card_count = len(cards)
                    except Exception:
                        break

                content = await page.content()
                quotes, metrics = parse_flight_cards_html(
                    html_content=content,
                    origin=request.origin,
                    destination=request.destination,
                    departure_date=str(request.departure_date),
                    source_name=adapter.source_name,
                    engine_name=CollectionEngine.PLAYWRIGHT.value,
                    requested_url=target_url,
                    http_status=http_status,
                    max_results=bounded_max,
                    is_nonstop=is_nonstop,
                    cabin=cabin,
                    return_metrics=True,
                )

            evidence = await browser_service.capture_audit_evidence(page, http_status=http_status)
            duration_ms = int((time.monotonic() - started_at) * 1000)

            if not quotes:
                outcome = (
                    EngineOutcome.NO_AVAILABILITY.value
                    if adapter.is_empty_availability(body_text, http_status) or metrics.get("results_seen", 0) == 0
                    else EngineOutcome.CONTENT_NOT_FOUND.value
                )
                return EngineResult(
                    status=outcome,
                    engine=CollectionEngine.PLAYWRIGHT.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=http_status,
                    quotes=[],
                    quotes_found=0,
                    requires_js=True,
                    failure_code=outcome,
                    failure_message="No flight cards detected in rendered DOM.",
                    duration_ms=duration_ms,
                    raw_payload_hash=evidence.response_hash,
                    results_seen=metrics.get("results_seen", 0),
                    results_matching=metrics.get("results_matching", 0),
                    results_collected=0,
                    pages_requested=1,
                    max_results=bounded_max,
                    stop_reason=metrics.get("stop_reason", StopReason.NO_AVAILABILITY.value),
                )

            return EngineResult(
                status=EngineOutcome.SUCCESS.value,
                engine=CollectionEngine.PLAYWRIGHT.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=http_status,
                quotes=[q.to_dict() for q in quotes],
                quotes_found=len(quotes),
                requires_js=True,
                failure_code=None,
                failure_message=None,
                duration_ms=duration_ms,
                raw_payload_hash=evidence.response_hash,
                raw_artifact_id=f"pw_{evidence.response_hash[:16]}",
                results_seen=metrics.get("results_seen", len(quotes)),
                results_matching=metrics.get("results_matching", len(quotes)),
                results_collected=len(quotes),
                pages_requested=1,
                max_results=bounded_max,
                stop_reason=metrics.get("stop_reason", StopReason.RESULT_LIMIT_REACHED.value),
            )

        except Exception as exc:
            duration_ms = int((time.monotonic() - started_at) * 1000)
            logger.exception(f"PlaywrightEngine failed for {adapter.source_name}: {exc}")
            is_timeout = isinstance(exc, asyncio.TimeoutError) or "timeout" in str(exc).lower()
            return EngineResult(
                status=EngineOutcome.TIMEOUT.value if is_timeout else EngineOutcome.FAILED.value,
                engine=CollectionEngine.PLAYWRIGHT.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=None,
                quotes=[],
                quotes_found=0,
                requires_js=True,
                failure_code=ScrapeFailureStage.TIMEOUT.value if is_timeout else "PLAYWRIGHT_EXCEPTION",
                failure_message=str(exc),
                duration_ms=duration_ms,
                results_seen=0,
                results_matching=0,
                results_collected=0,
                pages_requested=1,
                max_results=bounded_max,
                stop_reason=StopReason.TIMEOUT.value if is_timeout else StopReason.ERROR.value,
            )
        finally:
            if page is not None:
                try:
                    await page.close()
                except Exception:
                    pass
            if context is not None:
                try:
                    await context.close()
                except Exception:
                    pass
            await browser_service.close_all()
            gc.collect()
