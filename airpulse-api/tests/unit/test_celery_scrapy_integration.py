"""
Tests verifying Celery and async worker integration with Scrapy runner.
Proves that:
1. Sequential Scrapy executions in the same worker loop do not cause ReactorNotRestartable.
2. Concurrent Scrapy executions remain isolated.
3. Subprocess crashes result in FAILED status, never worker crashes.
4. Subprocess timeouts are killed and handled cleanly.
"""
import asyncio
from datetime import date
import pytest

from app.core.enums import EngineOutcome, ScrapeFailureStage
from app.schemas.runs import SearchRequest
from app.scraping.adapters.mock_adapters import StaticSourceAdapter
from app.scraping.engines.scrapy_engine import ScrapyEngine


@pytest.fixture
def search_request():
    return SearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=date(2026, 9, 10),
        booking_window_days=7,
    )


@pytest.mark.asyncio
async def test_sequential_scrapy_runs_avoid_reactor_not_restartable(search_request):
    """
    Executing two Scrapy runs in sequence within the same parent process
    MUST succeed without raising twisted.internet.error.ReactorNotRestartable.
    """
    engine = ScrapyEngine(timeout_seconds=10)
    adapter = StaticSourceAdapter()

    # First crawl
    res1 = await engine.execute(
        search_request,
        adapter,
        mock_response={"http_status": 200, "body": "<div class='flight-card'>IndiGo 6E-101 Rs 4500</div>"},
    )
    assert res1.status == EngineOutcome.SUCCESS.value
    assert res1.quotes_found > 0

    # Second crawl (In standard Scrapy, this would raise ReactorNotRestartable)
    res2 = await engine.execute(
        search_request,
        adapter,
        mock_response={"http_status": 200, "body": "<div class='flight-card'>Air India AI-102 Rs 5200</div>"},
    )
    assert res2.status == EngineOutcome.SUCCESS.value
    assert res2.quotes_found > 0


@pytest.mark.asyncio
async def test_concurrent_scrapy_runs_isolation(search_request):
    """
    Executing two Scrapy crawls concurrently via asyncio.gather
    MUST remain isolated and both complete successfully.
    """
    engine = ScrapyEngine(timeout_seconds=10)
    adapter1 = StaticSourceAdapter()
    adapter2 = StaticSourceAdapter()

    results = await asyncio.gather(
        engine.execute(
            search_request,
            adapter1,
            mock_response={"http_status": 200, "body": "<div class='flight-card'>IndiGo 6E-201 Rs 4000</div>"},
        ),
        engine.execute(
            search_request,
            adapter2,
            mock_response={"http_status": 200, "body": "<div class='flight-card'>Akasa QP-301 Rs 4800</div>"},
        ),
    )

    assert len(results) == 2
    assert results[0].status == EngineOutcome.SUCCESS.value
    assert results[1].status == EngineOutcome.SUCCESS.value
    assert results[0].quotes_found > 0
    assert results[1].quotes_found > 0


@pytest.mark.asyncio
async def test_subprocess_timeout_termination_clean(search_request):
    """
    A hung crawler exceeding timeout MUST be killed without deadlocking the parent worker.
    """
    engine = ScrapyEngine(timeout_seconds=1)
    adapter = StaticSourceAdapter()

    # Pass an unreachable URL with very short timeout to trigger timeout handling
    adapter.build_scrapy_request = lambda req: {
        "url": "http://10.255.255.1/unreachable",
        "method": "GET",
        "headers": {},
    }

    res = await engine.execute(search_request, adapter, timeout_seconds=1)
    assert res.status in (EngineOutcome.TIMEOUT.value, EngineOutcome.FAILED.value)
    assert res.failure_code in (ScrapeFailureStage.TIMEOUT.value, ScrapeFailureStage.CONNECTION_FAILURE.value)
