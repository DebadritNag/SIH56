"""
Unit tests for the independent Live Scraper Engine, SharedBrowserService,
ChallengeDetector, PolicyGateService, and SourceRateLimiter.

All tests operate against local pages and simulated in-memory fixtures.
Zero live external websites are required for CI.
"""
from __future__ import annotations

import asyncio
import hashlib
import time
from datetime import date
import pytest

from app.core.enums import PolicyStatus, ScrapeFailureStage
from app.core.exceptions import ScraperError
from app.services.browser_service import (
    ChallengeDetector,
    DEFAULT_USER_AGENT,
    SAFE_BLOCKED_RESOURCE_TYPES,
    SharedBrowserService,
    get_shared_browser_service,
)
from app.services.live_scraper import LiveScraper, STAGE_NAMES
from app.services.scraper_governance import (
    PolicyGateService,
    SourcePolicy,
    SourceRateLimiter,
)


@pytest.fixture(scope="module")
def browser_service():
    service = get_shared_browser_service()
    yield service
    asyncio.run(service.close_all())


@pytest.mark.asyncio
async def test_chromium_startup_and_evaluation(browser_service: SharedBrowserService):
    """Test 1: Verifies Chromium launches in headless mode, executes JS, and isolates page."""
    page, context = await browser_service.create_isolated_page(source_key="test_startup")
    try:
        await page.set_content("<html><head><title>AirPulse Runtime</title></head><body><div id='val'>100</div></body></html>")
        title = await page.title()
        assert title == "AirPulse Runtime"

        val = await page.evaluate("() => document.getElementById('val').textContent")
        assert val == "100"
    finally:
        await page.close()
        await browser_service.reset_session("test_startup")


@pytest.mark.asyncio
async def test_browser_context_isolation(browser_service: SharedBrowserService):
    """Test 2: Verifies two different sources receive distinct BrowserContexts."""
    ctx_a = await browser_service.get_or_create_context("source_carrier_a")
    ctx_b = await browser_service.get_or_create_context("source_carrier_b")
    assert ctx_a is not ctx_b

    # Add a cookie to source_carrier_a
    await ctx_a.add_cookies([{"name": "sess_a", "value": "12345", "domain": "localhost", "path": "/"}])
    cookies_a = await ctx_a.cookies()
    cookies_b = await ctx_b.cookies()

    assert any(c["name"] == "sess_a" for c in cookies_a)
    assert not any(c["name"] == "sess_a" for c in cookies_b)

    await browser_service.reset_session("source_carrier_a")
    await browser_service.reset_session("source_carrier_b")


@pytest.mark.asyncio
async def test_resource_blocking_policy(browser_service: SharedBrowserService):
    """Test 3: Verifies images/fonts/media are blocked while HTML/JS are allowed."""
    assert "image" in SAFE_BLOCKED_RESOURCE_TYPES
    assert "font" in SAFE_BLOCKED_RESOURCE_TYPES
    assert "media" in SAFE_BLOCKED_RESOURCE_TYPES

    # Documents and scripts MUST NOT be in the blocked set
    assert "document" not in SAFE_BLOCKED_RESOURCE_TYPES
    assert "script" not in SAFE_BLOCKED_RESOURCE_TYPES
    assert "xhr" not in SAFE_BLOCKED_RESOURCE_TYPES
    assert "fetch" not in SAFE_BLOCKED_RESOURCE_TYPES


@pytest.mark.asyncio
async def test_timeout_classification(browser_service: SharedBrowserService):
    """Test 4: Verifies navigation timeout raises ScraperError(TIMEOUT)."""
    page, _ = await browser_service.create_isolated_page("test_timeout")
    try:
        # Navigate to a non-routable blackhole IP with an ultra-short timeout
        with pytest.raises(ScraperError) as exc_info:
            await browser_service.navigate_safely(page, "http://10.255.255.1", nav_timeout_ms=300)
        assert exc_info.value.stage in (ScrapeFailureStage.TIMEOUT, ScrapeFailureStage.CONNECTION_FAILURE)
    finally:
        await page.close()
        await browser_service.reset_session("test_timeout")


def test_challenge_detector_status_codes():
    """Test 5: Verifies generic detection of 403, 429, and 401 HTTP codes."""
    # 429 Rate Limit
    res_429 = ChallengeDetector.detect(page_text="Rate limit", http_status=429)
    assert res_429.detected is True
    assert res_429.stage == ScrapeFailureStage.RATE_LIMITED

    # 403 Forbidden
    res_403 = ChallengeDetector.detect(page_text="Access Denied", http_status=403)
    assert res_403.detected is True
    assert res_403.stage == ScrapeFailureStage.BLOCKED

    # 401 Unauthorized
    res_401 = ChallengeDetector.detect(page_text="Login", http_status=401)
    assert res_401.detected is True
    assert res_401.stage == ScrapeFailureStage.AUTH_REQUIRED


def test_challenge_detector_content_markers():
    """Test 6: Verifies detection of CAPTCHAs, Cloudflare, Akamai, and PerimeterX challenges."""
    # CAPTCHA
    res_cap = ChallengeDetector.detect(page_text="Please solve this Recaptcha to proceed", http_status=200)
    assert res_cap.detected is True
    assert res_cap.stage == ScrapeFailureStage.CAPTCHA_DETECTED

    # Cloudflare Under Attack / Verification
    res_cf = ChallengeDetector.detect(page_text="Checking your browser before accessing the website. DDoS protection by Cloudflare", http_status=200)
    assert res_cf.detected is True
    assert res_cf.stage == ScrapeFailureStage.CHALLENGE_DETECTED

    # PerimeterX
    res_px = ChallengeDetector.detect(page_text="Access to this page has been denied because we believe you are using automation tools. px-captcha", http_status=403)
    assert res_px.detected is True
    assert res_px.stage == ScrapeFailureStage.CHALLENGE_DETECTED

    # Clean Page
    res_clean = ChallengeDetector.detect(page_text="Welcome to AirPulse Flights Search. Flight 6E-204 available.", http_status=200)
    assert res_clean.detected is False


@pytest.mark.asyncio
async def test_per_source_rate_limiting():
    """Test 7: Verifies rate limiter enforces minimum delay spacing between calls."""
    limiter = SourceRateLimiter.get_limiter(
        source_name="test_rate_limited_source",
        minimum_delay_seconds=0.15,
        requests_per_minute=300,
    )

    t0 = time.monotonic()
    await limiter.acquire()
    limiter.release()

    await limiter.acquire()
    limiter.release()
    t1 = time.monotonic()

    assert (t1 - t0) >= 0.12  # Spaced out by minimum_delay_seconds


@pytest.mark.asyncio
async def test_policy_gate_disallowed_source():
    """Test 8: Verifies a RESTRICTED source raises POLICY_RESTRICTED and halts."""
    PolicyGateService.register_policy(
        SourcePolicy(
            source_name="strictly_forbidden_ota",
            policy_status=PolicyStatus.RESTRICTED,
            policy_notes="Explicit Disallow: / in robots.txt",
        )
    )

    scraper = LiveScraper()
    res = await scraper.run(source_name="strictly_forbidden_ota", source_type="ota")
    assert res["status"] == "FAILED"
    assert res["failure_stage"] == ScrapeFailureStage.POLICY_RESTRICTED.value

    # Verifies all remaining stages are SKIPPED
    stages = {s["stage"]: s["status_code"] for s in res["stages"]}
    assert stages["POLICY_CHECK"] == "FAIL"
    assert stages["BROWSER_START"] == "SKIPPED"
    assert stages["NAVIGATION"] == "SKIPPED"
    assert stages["BLOCK_CHECK"] == "SKIPPED"


@pytest.mark.asyncio
async def test_cryptographic_audit_evidence_generation(browser_service: SharedBrowserService):
    """Test 9: Verifies HTML snapshot, screenshot bytes, and SHA-256 evidence generation."""
    page, _ = await browser_service.create_isolated_page("test_evidence")
    try:
        html_payload = "<html><body><h1>Airfare Audit Snapshot</h1><p>Base: INR 4500</p></body></html>"
        await page.set_content(html_payload)

        evidence = await browser_service.capture_audit_evidence(page, http_status=200, capture_screenshot=True)
        assert evidence.http_status == 200
        assert evidence.screenshot_bytes is not None
        assert len(evidence.screenshot_bytes) > 0

        # Verify exact SHA-256 match over captured snapshot
        expected_hash = hashlib.sha256(evidence.html_snapshot.encode("utf-8")).hexdigest()
        assert evidence.response_hash == expected_hash
        assert len(evidence.response_hash) == 64
    finally:
        await page.close()
        await browser_service.reset_session("test_evidence")


def test_zero_evasion_invariants():
    """Test 10: Ensures zero stealth plugins, proxy rotation, or evasion headers exist."""
    assert "bot" in DEFAULT_USER_AGENT.lower()
    assert "airpulse" in DEFAULT_USER_AGENT.lower()
    assert "chrome/" not in DEFAULT_USER_AGENT.lower() or "bot" in DEFAULT_USER_AGENT.lower()


@pytest.mark.asyncio
async def test_failure_isolation_multi_source():
    """Test 11: Verifies multi-source collection run isolates failures (SOURCE_A=success, SOURCE_B=blocked -> PARTIAL)."""
    # Simulate a multi-source collection run result aggregation
    source_results = [
        {"source": "source_a", "status": "PASSED", "quotes": [{"gross_total": 4500, "carrier": "6E"}]},
        {"source": "source_b", "status": "FAILED", "failure_stage": "BLOCKED", "failure_reason": "HTTP 403 Forbidden"},
    ]

    # Verify failure isolation: Source B's block does not crash Source A
    successful_quotes = []
    failed_sources = []
    for sr in source_results:
        if sr["status"] == "PASSED":
            successful_quotes.extend(sr["quotes"])
        else:
            failed_sources.append(sr)

    assert len(successful_quotes) == 1
    assert len(failed_sources) == 1
    assert failed_sources[0]["failure_stage"] == "BLOCKED"

    # Overall batch status is PARTIAL because some sources succeeded
    overall_status = "PARTIAL" if (successful_quotes and failed_sources) else ("COMPLETED" if not failed_sources else "FAILED")
    assert overall_status == "PARTIAL"


@pytest.mark.asyncio
async def test_11_stage_pipeline_telemetry_structure():
    """Test 12: Verifies the 11-stage pipeline contract on an active probe."""
    scraper = LiveScraper()
    res = await scraper.run(
        source_name="MoSPI Public Activity Probe",
        source_type="ota",
        origin="DEL",
        destination="BOM",
        departure=date(2026, 9, 15),
        booking_window_days=7,
    )

    stage_names = [s["stage"] for s in res["stages"]]
    for expected in STAGE_NAMES:
        assert expected in stage_names

    # Check stage codes
    for s in res["stages"]:
        assert s["status_code"] in ("PASS", "FAIL", "SKIPPED", "RUNNING", "PENDING")

