"""
Unit Tests for Bounded Collection and Early Stopping across Scrapy and Playwright.

Covers:
1. max_results = 15 collects at most 15 matching fares
2. max_results = 5 collects at most 5 matching fares
3. max_results = 50 is capped at 20 (hard safety cap)
4. Scrapy stops following pages once max_results is collected
5. Playwright stops scrolling/loading once max_results is collected
6. Filtered-out cards (stops/cabin/route) do NOT count towards max_results
7. Reaching max_results results in status == SUCCESS and stop_reason == RESULT_LIMIT_REACHED
8. Page running out before max_results sets stop_reason == PAGE_EXHAUSTED
"""
from datetime import date
import pytest

from app.core.enums import CollectionEngine, EngineOutcome, StopReason
from app.schemas.runs import SearchRequest
from app.scraping.adapters.mock_adapters import StaticSourceAdapter
from app.scraping.engines.playwright_engine import PlaywrightEngine
from app.scraping.engines.scrapy_engine import ScrapyEngine
from app.scraping.parsers import parse_flight_cards_html


def generate_flight_cards_html(count: int, carrier: str = "6E", is_nonstop: bool = True) -> str:
    """Helper generating count mock flight cards with valid markup."""
    cards = []
    stop_text = "Non-stop" if is_nonstop else "1 Stop via HYD"
    for i in range(1, count + 1):
        flight_no = f"{carrier}-{100 + i}"
        dep_hour = f"{(5 + (i % 15)):02d}:00"
        arr_hour = f"{(7 + (i % 15)):02d}:15"
        price = 4500 + (i * 120)
        cards.append(f"""
        <div class="flight-card">
            <span class="carrier">{carrier}</span>
            <span class="flight-no">{flight_no}</span>
            <span class="departure-time">{dep_hour}</span>
            <span class="arrival-time">{arr_hour}</span>
            <span class="route">DEL - BOM</span>
            <span class="stops">{stop_text}</span>
            <span class="cabin">Economy</span>
            <span class="price">Rs {price:,}</span>
        </div>
        """)
    return f"<html><body><div class='results-container'>{''.join(cards)}</div></body></html>"


@pytest.fixture
def search_request_base():
    return SearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=date(2026, 9, 10),
        booking_window_days=7,
    )


# 1. max_results = 15 collects at most 15 matching fares
def test_max_results_15_collects_at_most_15():
    html = generate_flight_cards_html(30)
    quotes, metrics = parse_flight_cards_html(
        html_content=html,
        origin="DEL",
        destination="BOM",
        departure_date="2026-09-10",
        max_results=15,
        return_metrics=True,
    )
    assert len(quotes) == 15
    assert metrics["results_collected"] == 15
    assert metrics["max_results"] == 15
    assert metrics["results_seen"] >= 15
    assert metrics["results_matching"] >= 15
    assert metrics["stop_reason"] == StopReason.RESULT_LIMIT_REACHED.value


# 2. max_results = 5 collects at most 5 matching fares
def test_max_results_5_collects_at_most_5():
    html = generate_flight_cards_html(20)
    quotes, metrics = parse_flight_cards_html(
        html_content=html,
        origin="DEL",
        destination="BOM",
        departure_date="2026-09-10",
        max_results=5,
        return_metrics=True,
    )
    assert len(quotes) == 5
    assert metrics["results_collected"] == 5
    assert metrics["max_results"] == 5
    assert metrics["stop_reason"] == StopReason.RESULT_LIMIT_REACHED.value


# 3. max_results = 50 is capped at 20 (hard safety cap)
def test_hard_safety_cap_at_20():
    html = generate_flight_cards_html(35)
    # Parser level
    quotes, metrics = parse_flight_cards_html(
        html_content=html,
        origin="DEL",
        destination="BOM",
        departure_date="2026-09-10",
        max_results=50,  # exceeds safety cap
        return_metrics=True,
    )
    assert len(quotes) == 20
    assert metrics["max_results"] == 20
    assert metrics["results_collected"] == 20
    assert metrics["stop_reason"] == StopReason.RESULT_LIMIT_REACHED.value

    # Schema validation cap
    with pytest.raises(Exception):
        SearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=date(2026, 9, 10),
            booking_window_days=7,
            max_results=25,  # Schema le=20 must reject
        )


# 4. Scrapy stops following pages / parsing once max_results is collected
@pytest.mark.asyncio
async def test_scrapy_stops_at_max_results(search_request_base):
    req = search_request_base.model_copy(update={"max_results": 10})
    adapter = StaticSourceAdapter()
    engine = ScrapyEngine()
    html = generate_flight_cards_html(25)

    result = await engine.execute(
        request=req,
        adapter=adapter,
        mock_response={"http_status": 200, "body": html},
    )

    assert result.status == EngineOutcome.SUCCESS.value
    assert result.quotes_found == 10
    assert len(result.quotes) == 10
    assert result.results_collected == 10
    assert result.max_results == 10
    assert result.stop_reason == StopReason.RESULT_LIMIT_REACHED.value


# 5. Playwright stops once max_results is collected
@pytest.mark.asyncio
async def test_playwright_stops_at_max_results(search_request_base):
    req = search_request_base.model_copy(update={"max_results": 7})
    adapter = StaticSourceAdapter()
    engine = PlaywrightEngine()
    html = generate_flight_cards_html(20)

    result = await engine.execute(
        request=req,
        adapter=adapter,
        mock_response={"http_status": 200, "body": html},
    )

    assert result.status == EngineOutcome.SUCCESS.value
    assert result.quotes_found == 7
    assert len(result.quotes) == 7
    assert result.results_collected == 7
    assert result.max_results == 7
    assert result.stop_reason == StopReason.RESULT_LIMIT_REACHED.value


# 6. Filtered-out cards do NOT count towards max_results
def test_filtered_out_cards_do_not_count():
    # 5 nonstop + 15 connecting (1-stop) cards = 20 total cards
    nonstop_html = generate_flight_cards_html(5, carrier="6E", is_nonstop=True)
    connecting_html = generate_flight_cards_html(15, carrier="AI", is_nonstop=False)
    combined_html = f"<html><body>{nonstop_html}{connecting_html}</body></html>"

    # Request nonstop only with max_results=10
    quotes, metrics = parse_flight_cards_html(
        html_content=combined_html,
        origin="DEL",
        destination="BOM",
        departure_date="2026-09-10",
        max_results=10,
        is_nonstop=True,
        return_metrics=True,
    )

    # Only the 5 nonstop cards should be collected
    assert len(quotes) == 5
    assert metrics["results_collected"] == 5
    assert metrics["results_matching"] == 5
    # The page ran out of matching cards before reaching 10
    assert metrics["stop_reason"] == StopReason.PAGE_EXHAUSTED.value


# 7. Reaching max_results results in status == SUCCESS and stop_reason == RESULT_LIMIT_REACHED
@pytest.mark.asyncio
async def test_reaching_max_results_is_success_not_error(search_request_base):
    req = search_request_base.model_copy(update={"max_results": 12})
    adapter = StaticSourceAdapter()
    engine = ScrapyEngine()
    html = generate_flight_cards_html(20)

    result = await engine.execute(
        request=req,
        adapter=adapter,
        mock_response={"http_status": 200, "body": html},
    )

    assert result.status == EngineOutcome.SUCCESS.value
    assert result.failure_code is None
    assert result.failure_message is None
    assert result.stop_reason == StopReason.RESULT_LIMIT_REACHED.value
    assert result.results_collected == 12


# 8. Page running out before max_results sets stop_reason == PAGE_EXHAUSTED
@pytest.mark.asyncio
async def test_page_exhausted_before_max_results(search_request_base):
    req = search_request_base.model_copy(update={"max_results": 15})
    adapter = StaticSourceAdapter()
    engine = ScrapyEngine()
    html = generate_flight_cards_html(4)  # Only 4 available

    result = await engine.execute(
        request=req,
        adapter=adapter,
        mock_response={"http_status": 200, "body": html},
    )

    assert result.status == EngineOutcome.SUCCESS.value
    assert result.quotes_found == 4
    assert result.results_collected == 4
    assert result.results_matching == 4
    assert result.max_results == 15
    assert result.stop_reason == StopReason.PAGE_EXHAUSTED.value
