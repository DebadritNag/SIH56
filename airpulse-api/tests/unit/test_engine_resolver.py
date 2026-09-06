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
async def test_http_startup_does_not_wait_for_database(monkeypatch):
    import asyncio
    from contextlib import asynccontextmanager
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app import main
    from app.services.browser_service import SharedBrowserService
    @asynccontextmanager
    async def stalled_connection():
        await asyncio.sleep(60)
        yield None
    fake_engine = SimpleNamespace(connect=stalled_connection,dispose=AsyncMock())
    monkeypatch.setattr(main,'engine',fake_engine)
    monkeypatch.setattr(main.settings,'LIVE_WORKER_ENABLED',False)
    monkeypatch.setattr(SharedBrowserService,'run_startup_self_test',AsyncMock())
    context = main.lifespan(main.app)
    await asyncio.wait_for(context.__aenter__(),timeout=0.5)
    await asyncio.sleep(0)
    await asyncio.wait_for(context.__aexit__(None,None,None),timeout=0.5)
    fake_engine.dispose.assert_awaited_once()


YATRA_CARD = '''<div class="airline-name"><span title="Akasa Air">Akasa Air</span><p class="fl-no">QP-1833</p></div>
<div class="depart-details"><p class="mob-origin">New Delhi(DEL)</p><p class="mob-time">06:50</p><p class="mob-date">20 Sep</p></div>
<div class="arrival-details"><p class="mob-origin">Mumbai(BOM)</p><p class="mob-time">09:10</p><p class="mob-date">20 Sep</p></div>
<div class="stops-details"><span class="mob-duration">Non Stop</span></div>
<p autom="durationLabel">2h 20m</p><p class="ow-price-above-btn">₹6,310</p>'''


def test_yatra_observed_card_rejects_nearby_airports_dates_and_bad_fields():
    from app.scraping.yatra_browser import parse_card, verify_search_url, date_label
    request = SearchRequest(origin='DEL',destination='BOM',departure_date=date(2026,9,20),booking_window_days=14,max_results=10)
    url = 'https://flight.yatra.com/air-search?type=O&origin=DEL&destination=BOM&flight_depart_date=20%2F09%2F2026&ADT=1&class=Economy'
    query = verify_search_url(url,request)
    parsed = parse_card(YATRA_CARD,query,url,'2026-09-06T00:00:00+00:00')
    assert parsed['gross_total']==6310 and parsed['origin']=='DEL' and parsed['destination']=='BOM'
    assert parsed['base_price'] is None and parsed['tax_amount'] is None
    for card in [YATRA_CARD.replace('(DEL)','(DXN)'),YATRA_CARD.replace('(BOM)','(NMI)'),
                 YATRA_CARD.replace('20 Sep','21 Sep'),YATRA_CARD.replace('06:50','26:50'),
                 YATRA_CARD.replace('₹6,310','Unavailable')]:
        assert parse_card(card,query,url,'2026-09-06T00:00:00+00:00') is None
    for changed in [url.replace('type=O','type=R'),url.replace('ADT=1','ADT=2'),url.replace('destination=BOM','destination=NMI')]:
        with pytest.raises(ValueError):
            verify_search_url(changed,request)
    assert date_label(date(2026,9,21)) == 'Choose Monday, September 21st, 2026'


@pytest.mark.asyncio
@pytest.mark.parametrize('disable_http2', [False, True])
@pytest.mark.parametrize('result_limit', [5, 10, 15])
@pytest.mark.parametrize('load_timeout', [False, True])
async def test_yatra_homepage_success_dedups_and_closes_chrome(monkeypatch, disable_http2, result_limit, load_timeout):
    from unittest.mock import AsyncMock, MagicMock
    from types import SimpleNamespace
    from playwright.async_api import TimeoutError
    from app.scraping.yatra_browser import YatraBrowserCollector
    from app.config import settings
    monkeypatch.setattr(settings,'YATRA_BROWSER_HEADLESS',False)
    monkeypatch.setattr(settings,'YATRA_DISABLE_HTTP2',disable_http2)
    request = SearchRequest(origin='DEL',destination='BOM',departure_date=date(2026,9,20),booking_window_days=14,max_results=result_limit)
    page = MagicMock()
    page.url = 'https://flight.yatra.com/air-search?type=O&origin=DEL&destination=BOM&flight_depart_date=20%2F09%2F2026&ADT=1&class=Economy'
    page.goto = AsyncMock(return_value=SimpleNamespace(status=200))
    if load_timeout:
        page.goto.side_effect = TimeoutError('DOMContentLoaded delayed')
    page.get_by_text.return_value.is_visible = AsyncMock(return_value=True)
    page.wait_for_url = AsyncMock()
    page.wait_for_function = AsyncMock(side_effect=TimeoutError('no growth'))
    page.get_by_text.return_value.click = AsyncMock()
    cards = MagicMock()
    cards.first.wait_for = AsyncMock()
    cards.last.scroll_into_view_if_needed = AsyncMock()
    cards.count = AsyncMock(return_value=22)
    cards.all = AsyncMock(return_value=[SimpleNamespace(is_visible=AsyncMock(return_value=True),inner_html=AsyncMock(return_value=h))
        for h in [YATRA_CARD,YATRA_CARD,YATRA_CARD.replace('(BOM)','(NMI)')]
        + [YATRA_CARD.replace('06:50', f'{hour:02d}:50') for hour in range(7, 24)]])
    page.locator.return_value = cards
    browser = SimpleNamespace(version='test',new_context=AsyncMock(return_value=SimpleNamespace(new_page=AsyncMock(return_value=page))),close=AsyncMock())
    launch = AsyncMock(return_value=browser)
    manager = MagicMock()
    manager.__aenter__ = AsyncMock(return_value=SimpleNamespace(chromium=SimpleNamespace(launch=launch)))
    manager.__aexit__ = AsyncMock()
    monkeypatch.setattr('app.scraping.yatra_browser.async_playwright',lambda:manager)
    collector = YatraBrowserCollector()
    collector.guard = AsyncMock()
    collector.airport = AsyncMock()
    collector.calendar = AsyncMock()
    collector.travellers = AsyncMock()
    result = await collector.execute(request)
    assert result.status=='SUCCESS' and len(result.quotes)==result_limit
    assert result.stop_reason == 'RESULT_LIMIT_REACHED'
    cards.last.scroll_into_view_if_needed.assert_not_awaited()
    page.goto.assert_awaited_once()
    options = dict(channel='chrome',headless=False)
    if disable_http2:
        options['args'] = ['--disable-http2']
    launch.assert_awaited_once_with(**options)
    assert result.metadata['http2_disabled'] == disable_http2
    browser.close.assert_awaited_once()
    assert page.goto.call_args.args[0]=='https://www.yatra.com/'


@pytest.mark.asyncio
async def test_yatra_missing_chrome_is_explicit(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    from types import SimpleNamespace
    from app.scraping.yatra_browser import YatraBrowserCollector
    manager = MagicMock()
    manager.__aenter__ = AsyncMock(return_value=SimpleNamespace(chromium=SimpleNamespace(launch=AsyncMock(side_effect=RuntimeError('chrome not found')))))
    manager.__aexit__ = AsyncMock()
    monkeypatch.setattr('app.scraping.yatra_browser.async_playwright',lambda:manager)
    result = await YatraBrowserCollector().execute(SearchRequest(origin='DEL',destination='BOM',departure_date=date(2026,9,20),booking_window_days=14))
    assert result.failure_code=='BROWSER_UNAVAILABLE' and result.quotes==[]
    assert result.metadata['failed_stage']=='BROWSER_LAUNCH'


def test_live_request_rejects_invalid_scope():
    from app.api.v1.live import LiveRequest
    from datetime import timedelta
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        LiveRequest(origin='DEL',destination='DEL',departure_date=date.today()+timedelta(days=7))
    with pytest.raises(ValidationError):
        LiveRequest(origin='DEL',destination='BOM',departure_date=date.today()-timedelta(days=1))
    with pytest.raises(ValidationError):
        LiveRequest(origin='DEL',destination='BOM',departure_date=date.today()+timedelta(days=7),max_results=16)


def test_live_canonical_provenance_and_daily_dedup():
    from app.services.live_processing import normalize_quote
    from datetime import datetime, timezone, timedelta
    from uuid import uuid4
    now = datetime.now(timezone.utc)
    depart = (now+timedelta(days=7)).date()
    raw = dict(id=uuid4(),source_id=uuid4(),collection_run_id=uuid4(),data_origin='LIVE',
        origin_requested='DEL',destination_requested='BOM',departure_requested=depart,
        raw_payload=dict(origin='DEL',destination='BOM',currency='INR',gross_total=6500,
            carrier='Example',flight_number='TEST123',departure_date=str(depart),departure_time='12:30',
            provenance={'observed_at':now.isoformat()}))
    first = normalize_quote(raw)
    assert first['base_fare'] is None and first['taxes'] is None
    assert first['total_fare']==6500 and first['collected_at']==now
    assert normalize_quote(raw)['quote_hash']==first['quote_hash']
    raw['raw_payload']['provenance']['observed_at']=(now+timedelta(days=1)).isoformat()
    assert normalize_quote(raw)['quote_hash']!=first['quote_hash']
    raw['data_origin']='IMPORTED'
    with pytest.raises(ValueError,match='only live'):
        normalize_quote(raw)


@pytest.mark.asyncio
async def test_live_policy_failure_has_no_collection_engine(monkeypatch):
    from app.config import settings
    from app.services.live_scraper import LiveScraper
    from datetime import timedelta
    monkeypatch.setattr(settings,'YATRA_PROTOTYPE_ENABLED',False)
    result = await LiveScraper().run(source_name='yatra',source_type='ota',origin='DEL',destination='BOM',
        departure=date.today()+timedelta(days=7),booking_window_days=7,engine='AUTO',max_results=10)
    assert result['failure_stage']=='POLICY_RESTRICTED'
    assert result['collection_engine']=='NONE'
    assert result['stop_reason']=='POLICY_RESTRICTED'


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
