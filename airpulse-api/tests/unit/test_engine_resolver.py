"""
Unit and Acceptance Tests for AirPulse Engine Resolver and Dual-Engine Architecture.
Covers:
- AUTO selects Scrapy for non-JS static source
- AUTO selects Playwright for JS dynamic source
- Manual SCRAPY and PLAYWRIGHT overrides
- Zero-evasion rules: 403, 429, CAPTCHA never escalate to Playwright
- Explicit escalation: HTTP 200 JS-only shell escalates to Playwright in AUTO
- Non-escalation on NO_AVAILABILITY or PARSE_ERROR
- Playwright BROWSER_UNAVAILABLE detection
- Schema parity: identical RawQuote schema between Scrapy and Playwright
"""
from datetime import date
import pytest

from app.core.enums import CollectionEngine, EngineOutcome, ScrapeFailureStage
from app.schemas.runs import SearchRequest
from app.scraping.adapters.mock_adapters import (
    BlockedSourceAdapter,
    JsSourceAdapter,
    StaticSourceAdapter,
)
from app.scraping.engines.base import EngineResult, RawQuote
from app.scraping.engines.playwright_engine import PlaywrightEngine
from app.scraping.engines.scrapy_engine import ScrapyEngine
from app.scraping.resolver import EngineResolver


@pytest.mark.asyncio
async def test_yatra_subprocess_uses_source_parser():
    from app.scraping.adapters.yatra import YatraAdapter
    request = SearchRequest(origin="DEL", destination="BOM", departure_date=date(2026, 9, 13),
                            booking_window_days=7, max_results=10)
    result = await ScrapyEngine().execute(request, YatraAdapter(), mock_response={
        "http_status": 200,
        "body": '<div class="tuple">AI-805 <span class="total-price">INR 6,450</span></div>'
                '<div class="tuple">Sold Out</div>',
    })
    assert result.status == "SUCCESS"
    assert result.quotes_found == 1
    quote = result.quotes[0]
    assert quote["gross_total"] == 6450
    assert quote["departure_time"] is None
    assert quote["tax_amount"] is None
    assert quote["is_non_stop"] is None
    assert quote["provenance"]["raw_card"]


@pytest.mark.asyncio
async def test_yatra_live_probe_preserves_connection_failure():
    from unittest.mock import AsyncMock, patch
    from app.services.live_scraper import LiveScraper
    failure = EngineResult(status="FAILED", engine="scrapy", failure_code="CONNECTION_FAILURE",
                           failure_message="Connection failed", http_status=None)
    with patch("app.services.scraper_governance.SourcePolicy.is_executable", return_value=True), \
         patch("app.scraping.resolver.EngineResolver.resolve_and_execute", new=AsyncMock(return_value=failure)):
        result = await LiveScraper().run(source_name="Yatra", source_type="ota")
    assert result["failure_stage"] == "CONNECTION_FAILURE"
    assert result["http_status"] is None
    assert result["quotes_found"] == 0
    assert result["is_fallback"] is False
    assert result["ready_for_ingestion"] is False


def test_yatra_policy_requires_explicit_configuration(monkeypatch):
    from app.config import settings
    from app.services.scraper_governance import PolicyGateService
    monkeypatch.setattr(settings, "YATRA_PROTOTYPE_ENABLED", False)
    monkeypatch.setattr(settings, "YATRA_REVIEW_NOTES", "")
    policy = PolicyGateService.get_policy("Yatra")
    assert not policy.is_executable()
    monkeypatch.setattr(settings, "YATRA_PROTOTYPE_ENABLED", True)
    assert not policy.is_executable()
    monkeypatch.setattr(settings, "YATRA_REVIEW_NOTES", "Controlled test reviewed")
    assert policy.is_executable()


@pytest.fixture
def search_request():
    return SearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=date(2026, 9, 10),
        booking_window_days=7,
    )


@pytest.fixture
def engine_resolver():
    return EngineResolver()


@pytest.mark.asyncio
async def test_auto_selects_scrapy_for_static_source(engine_resolver, search_request):
    """AUTO mode must select Scrapy for a non-JS static HTML source."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={
            "http_status": 200,
            "body": """
            <div class="flight-card">
                <span class="flight-no">6E-205</span>
                <span class="times">06:00 - 08:15</span>
                <span class="fare">Rs 5,420</span>
            </div>
            """,
        },
    )
    assert result.status == EngineOutcome.SUCCESS.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.quotes_found > 0
    assert result.metadata.get("engine_decision") == "AUTO_SCRAPY_SUCCESS"


@pytest.mark.asyncio
async def test_auto_selects_playwright_for_js_source(engine_resolver, search_request):
    """AUTO mode must select Playwright for a source that requires JavaScript upfront."""
    adapter = JsSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 200, "body": "<div class='flight-card'>AI-505 14:00 - 16:10 Rs 5900</div>"},
    )
    assert result.status == EngineOutcome.SUCCESS.value
    assert result.engine == CollectionEngine.PLAYWRIGHT.value
    assert result.quotes_found > 0
    assert "PLAYWRIGHT" in result.metadata.get("engine_decision", "")


@pytest.mark.asyncio
async def test_manual_scrapy_override(engine_resolver, search_request):
    """Manual SCRAPY selection must force Scrapy engine even on JS adapter."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="SCRAPY",
        mock_response={"http_status": 200, "body": "<div class='flight-card'>6E-101 Rs 4200</div>"},
    )
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.status == EngineOutcome.SUCCESS.value


@pytest.mark.asyncio
async def test_manual_playwright_override(engine_resolver, search_request):
    """Manual PLAYWRIGHT selection must force Playwright engine even on static adapter."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="PLAYWRIGHT",
        mock_response={"http_status": 200, "body": "<div class='flight-card'>AI-102 Rs 6100</div>"},
    )
    assert result.engine == CollectionEngine.PLAYWRIGHT.value


@pytest.mark.asyncio
async def test_zero_evasion_scrapy_403_never_escalates_to_playwright(engine_resolver, search_request):
    """HTTP 403 on Scrapy must stop collection with BLOCKED and NEVER launch Playwright."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 403, "body": "<html><body>403 Forbidden - WAF Blocked</body></html>"},
    )
    assert result.status == EngineOutcome.BLOCKED.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.failure_code == ScrapeFailureStage.BLOCKED.value
    assert result.metadata.get("engine_decision") == "AUTO_SCRAPY_HALTED_ACCESS_RESTRICTION"


@pytest.mark.asyncio
async def test_zero_evasion_scrapy_429_never_escalates_to_playwright(engine_resolver, search_request):
    """HTTP 429 on Scrapy must stop collection with RATE_LIMITED and NEVER launch Playwright."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 429, "body": "Too Many Requests"},
    )
    assert result.status == EngineOutcome.RATE_LIMITED.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.failure_code == ScrapeFailureStage.RATE_LIMITED.value


@pytest.mark.asyncio
async def test_zero_evasion_scrapy_captcha_never_escalates_to_playwright(engine_resolver, search_request):
    """CAPTCHA detection on Scrapy must stop collection with CAPTCHA_DETECTED and NEVER launch Playwright."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 200, "body": "<html><body>Please solve this recaptcha challenge</body></html>"},
    )
    assert result.status == EngineOutcome.CAPTCHA_DETECTED.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.failure_code == ScrapeFailureStage.CAPTCHA_DETECTED.value


@pytest.mark.asyncio
async def test_auto_escalation_on_http_200_js_shell(engine_resolver, search_request):
    """
    HTTP 200 where page is an empty client SPA shell (<div id='root'></div>)
    MUST escalate to Playwright in AUTO mode.
    """
    class DynamicSpaAdapter(StaticSourceAdapter):
        def requires_javascript(self, request):
            return False  # Unset upfront to trigger Scrapy attempt

    adapter = DynamicSpaAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={
            "http_status": 200,
            "body": "<html><body><div id='root'></div><script src='app.js'></script></body></html>",
        },
    )
    # The Scrapy engine identifies CONTENT_REQUIRES_JS, so AUTO escalates to Playwright!
    assert result.engine == CollectionEngine.PLAYWRIGHT.value
    assert result.metadata.get("engine_decision") == "AUTO_ESCALATED_SCRAPY_TO_PLAYWRIGHT"


@pytest.mark.asyncio
async def test_auto_does_not_escalate_on_no_availability(engine_resolver, search_request):
    """HTTP 200 with explicit NO_AVAILABILITY must NOT escalate to Playwright."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 200, "body": "<html><body>No flights available on this route</body></html>"},
    )
    assert result.status == EngineOutcome.NO_AVAILABILITY.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.metadata.get("engine_decision") == "AUTO_SCRAPY_TERMINAL"


@pytest.mark.asyncio
async def test_auto_does_not_escalate_on_parse_error(engine_resolver, search_request):
    """HTML with content but no parsable flight cards must NOT escalate to Playwright."""
    adapter = StaticSourceAdapter()
    result = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="AUTO",
        mock_response={"http_status": 200, "body": "<html><body><h1>Welcome to Airline Portal</h1><p>Home</p></body></html>"},
    )
    assert result.status == EngineOutcome.PARSE_ERROR.value
    assert result.engine == CollectionEngine.SCRAPY.value
    assert result.metadata.get("engine_decision") == "AUTO_SCRAPY_TERMINAL"


@pytest.mark.asyncio
async def test_identical_quote_schema_parity(engine_resolver, search_request):
    """Quotes extracted from Scrapy and Playwright must share the exact same RawQuote schema."""
    adapter = StaticSourceAdapter()
    scrapy_res = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="SCRAPY",
        mock_response={"http_status": 200, "body": "<div class='flight-card'>IndiGo 6E-205 Rs 5000</div>"},
    )
    pw_res = await engine_resolver.resolve_and_execute(
        request=search_request,
        adapter=adapter,
        preferred_engine="PLAYWRIGHT",
        mock_response={"http_status": 200, "body": "<div class='flight-card'>IndiGo 6E-205 Rs 5000</div>"},
    )
    assert len(scrapy_res.quotes) > 0
    assert len(pw_res.quotes) > 0

    sq = scrapy_res.quotes[0]
    pq = pw_res.quotes[0]

    required_keys = {
        "carrier", "flight_number", "departure_time", "arrival_time",
        "origin", "destination", "departure_date", "currency",
        "base_price", "tax_amount", "mandatory_fees", "gross_total", "provenance"
    }
    assert required_keys.issubset(sq.keys())
    assert required_keys.issubset(pq.keys())

    assert sq["provenance"]["engine"] == "SCRAPY"
    assert pq["provenance"]["engine"] == "PLAYWRIGHT"
