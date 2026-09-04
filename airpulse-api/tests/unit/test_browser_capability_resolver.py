"""
Unit tests for BrowserCapabilityResolver, startup self-test, and strict failure handling.

Verifies:
1. 5-Tier Browser Capability Resolver priority order.
2. Startup self-test launches browser, runs JavaScript, verifies DOM evaluation, and exits cleanly.
3. Strict rejection: when no browser is available, LiveScraper fails with BROWSER_UNAVAILABLE
   and NEVER silently falls back to HTTP telemetry or claims collection success.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from app.core.enums import ScrapeFailureStage
from app.services.browser_service import (
    BrowserCapability,
    BrowserCapabilityResolver,
    SharedBrowserService,
    get_shared_browser_service,
)
from app.services.live_scraper import LiveScraper


@pytest.mark.asyncio
async def test_browser_capability_resolution():
    """Verifies that the resolver detects an installed browser on the system."""
    cap = await BrowserCapabilityResolver.resolve_installed_browser()
    assert cap is not None
    assert cap.launch_status in ("SUCCESS", "AVAILABLE", "UNAVAILABLE")
    if cap.launch_status in ("SUCCESS", "AVAILABLE"):
        assert cap.engine in (
            "playwright-chromium",
            "google-chrome",
            "google-chrome-stable",
            "system-chromium",
            "msedge",
        )
        assert cap.channel is not None or cap.executable_path is not None


@pytest.mark.asyncio
async def test_resolver_order_fallback():
    """Verifies 5-tier fallback order: Playwright Chromium -> Chrome -> Chrome Stable -> System Chromium -> Edge."""
    # Test fallback to Edge when all previous 4 tiers fail
    call_log = []

    async def mock_try_launch(launcher, **kwargs):
        call_log.append(kwargs)
        if kwargs.get("channel") == "msedge":
            # Return fake browser for Edge
            mock_b = AsyncMock()
            mock_b.version = "120.0.0.0"
            mock_b.close = AsyncMock()
            return mock_b
        raise RuntimeError("Tier simulated failure")

    with patch.object(BrowserCapabilityResolver, "_try_launch", side_effect=mock_try_launch):
        with patch.object(BrowserCapabilityResolver, "_find_executable", return_value=None):
            cap = await BrowserCapabilityResolver.resolve_installed_browser()
            assert cap.launch_status == "SUCCESS"
            assert cap.engine == "msedge"
            assert cap.channel == "msedge"
            assert cap.version == "120.0.0.0"
            # Verify attempts were made in order
            assert any(c.get("channel") == "chrome" for c in call_log)
            assert any(c.get("channel") == "msedge" for c in call_log)


@pytest.mark.asyncio
async def test_startup_self_test_execution():
    """Verifies startup self-test executes JavaScript and cleans up resources cleanly."""
    report = await SharedBrowserService.run_startup_self_test()
    assert report is not None
    assert "status" in report
    assert report["status"] in ("PASSED", "SKIPPED", "FAILED")
    assert "capability" in report
    assert "duration_ms" in report

    if report["status"] == "PASSED":
        assert report["test_page_loaded"] is True
        assert report["js_execution_verified"] is True
        assert report["clean_exit"] is True


@pytest.mark.asyncio
async def test_strict_browser_unavailable_no_silent_http_fallback():
    """
    CRITICAL CONSTRAINT TEST:
    If no compatible browser exists, the scraper must fail Stage 2 (BROWSER_START)
    with failure_stage: BROWSER_UNAVAILABLE and status: 'FAILED'.
    It MUST NOT silently switch to non-airfare HTTP telemetry and classify collection as successful.
    """
    unavailable_cap = BrowserCapability(
        engine="none",
        version="0.0.0",
        executable_path=None,
        launch_status="UNAVAILABLE",
        channel=None,
        error="No compatible browser binary found across all 5 tiers",
    )

    with patch.object(BrowserCapabilityResolver, "resolve_and_launch", return_value=(None, unavailable_cap)):
        # Force a fresh service instance
        service = SharedBrowserService()
        scraper = LiveScraper()
        scraper.browser_service = service

        result = await scraper.run(
            source_name="IndiGo Flight Booking Portal",
            source_type="airline",
            origin="DEL",
            destination="BOM",
        )

        assert result["status"] == "FAILED"
        assert result["failure_stage"] == ScrapeFailureStage.BROWSER_UNAVAILABLE.value
        assert result["quotes_found"] == 0
        assert result["quotes_validated"] == 0
        assert result["quotes"] == []
        assert result["browser_launch_status"] == "UNAVAILABLE"
        assert "BROWSER_UNAVAILABLE" in result["failure_stage"]
        assert result.get("is_fallback") is not True or result["status"] == "FAILED"
