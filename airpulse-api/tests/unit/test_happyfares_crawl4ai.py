from datetime import date
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from app.collectors.crawl4ai_collector import Crawl4AICollector, CollectionStopped, check_access
from app.collectors.registry import CollectorRegistry
from app.collectors.sources.happyfares import parse_card
from app.schemas.runs import SearchRequest
CARD = '''SG-162 | SpiceJet
19:55
NEW DELHI (DEL)
Tue, 08 Sep 2026
02h : 35m
Non- Stop
22:30
MUMBAI (BOM)
Tue, 08 Sep 2026
₹ 5,243.00₹ 4,968.00
₹ 275 Discount Applied
View Fares'''


def request(**kwargs):
    return SearchRequest(origin='DEL', destination='BOM', departure_date=date(2026,9,8), booking_window_days=1, **kwargs)


def test_registry():
    assert isinstance(CollectorRegistry.build_for_source('hf', 'HappyFares', 'ota'), Crawl4AICollector)


def test_complete_public_search_url():
    from urllib.parse import parse_qs, urlparse
    from app.collectors.sources.happyfares import search_url
    url = search_url('DEL', 'BOM', date(2026, 9, 16))
    query = parse_qs(urlparse(url).path.split('/flights/', 1)[1], keep_blank_values=True)
    assert query['originName'] == ['new delhi'] and query['destinationName'] == ['mumbai']
    assert query['BType'] == [''] and query['onward'] == ['16-09-2026']


@pytest.mark.parametrize('http,body,status', [(403,'','BLOCKED'),(429,'','RATE_LIMITED'),(200,'Verify you are human','CAPTCHA_DETECTED'),(404,'','NOT_FOUND')])
def test_access(http, body, status):
    with pytest.raises(CollectionStopped) as exc:
        check_access(http, body)
    assert exc.value.status == status


def test_only_observed_values():
    q = parse_card(CARD, request(), '2026-09-07T10:00:00+00:00', 'https://www.happyfares.in/flights/')
    assert q['gross_total'] == 4968 and q['booking_window_days'] == 1
    assert q['base_price'] is None and q['tax_amount'] is None
    assert q['data_origin'] == 'LIVE' and q['acquisition_method'] == 'CRAWL4AI'
    assert len(q['response_hash']) == 64
    missing = parse_card(CARD.replace('SG-162 | SpiceJet\n',''), request(), q['observed_at'], q['source_url'])
    assert missing['carrier'] is None and missing['flight_number'] is None
    assert parse_card(CARD.replace('₹ 5,243.00₹ 4,968.00','₹ 0.00'), request(), q['observed_at'], q['source_url']) is None
    assert parse_card(CARD.replace('(BOM)','(NMI)'), request(), q['observed_at'], q['source_url']) is None
    breakdown = parse_card(CARD+'\nBase Fare: ₹ 4,000.00\nTaxes\n₹ 968.00', request(), q['observed_at'], q['source_url'])
    assert breakdown['base_price'] == 4000 and breakdown['tax_amount'] == 968


@pytest.mark.asyncio
async def test_disabled_zero_rows_not_success():
    with patch('app.config.settings.CRAWL4AI_ENABLED', False):
        result = await Crawl4AICollector('hf').run(request())
    assert result['status'] == 'SKIPPED_POLICY' and not result['quotes']


@pytest.mark.asyncio
async def test_staging_only_and_hard_cap():
    from app.services.live_acquisition import execute_acquisition
    run_id, source_id, job_id = uuid4(), uuid4(), uuid4()
    q = parse_card(CARD, request(), '2026-09-07T10:00:00+00:00', 'https://www.happyfares.in/flights/')
    collector = AsyncMock()
    collector.run.return_value = {'status':'SUCCESS', 'quotes':[q]*20, 'stages':[], 'collection_engine':'CRAWL4AI'}
    db = AsyncMock()
    inserts = AsyncMock()
    with patch('app.services.live_acquisition.rows', AsyncMock(side_effect=[[{'source_id':source_id}], [{'id':source_id,'name':'happyfares','display_name':'HappyFares'}]])), patch('app.services.live_acquisition.insert', inserts), patch('app.services.live_acquisition.audit', AsyncMock()), patch('app.services.live_acquisition.publish_progress', AsyncMock()), patch.object(CollectorRegistry, 'build_for_source', return_value=collector):
        result = await execute_acquisition(db, {'id':job_id, 'collection_run_id':run_id, 'metadata':{'request':request(max_results=20).model_dump(mode='json')}})
    tables = [call.args[1] for call in inserts.await_args_list]
    assert tables.count('raw_fares') == 15
    assert set(tables) <= {'raw_fares','pipeline_steps'}
    assert result['records_processed'] == 15

@pytest.mark.asyncio
@pytest.mark.parametrize('count,http,body,expected', [(20,200,'Flights','SUCCESS'),(0,200,'Flights','PARSE_ERROR'),(5,403,'Flights','BLOCKED'),(5,429,'Flights','RATE_LIMITED'),(5,200,'captcha','CAPTCHA_DETECTED'),(0,500,'Server error','HTTP_ERROR')])
async def test_crawler_hooks_and_cleanup(count, http, body, expected):
    import sys
    from types import SimpleNamespace
    class Cards:
        async def count(self): return max(count, 1)
        async def evaluate_all(self, expression):
            return [CARD.replace('SG-162', f'SG-{index+100}') for index in range(count)] if count else ['invalid card']
        def nth(self, index):
            card = AsyncMock()
            card.is_visible.return_value = True
            card.inner_text.return_value = CARD.replace('SG-162', f'SG-{index+100}') if count else 'invalid card'
            return card
    class Page:
        def __init__(self): self.url = ''
        def on(self, event, callback): pass
        def locator(self, selector):
            if selector == 'body':
                item = AsyncMock()
                item.inner_text.return_value = body
                return item
            return Cards()
    class Crawler:
        closed = False
        config = None
        def __init__(self, config):
            self.hooks = {}
            self.crawler_strategy = SimpleNamespace(set_hook=lambda name, hook: self.hooks.update({name:hook}))
            Crawler.config = config
        async def __aenter__(self): return self
        async def __aexit__(self, *args): Crawler.closed = True
        async def arun(self, url, config):
            assert config.screenshot is False and config.pdf is False
            page = Page()
            page.url = url
            await self.hooks['on_page_context_created'](page, None)
            try:
                await self.hooks['after_goto'](page, None, response=SimpleNamespace(status=http))
            except CollectionStopped as exc:
                return SimpleNamespace(success=False, error_message=f'{exc}\nCode context: BLOCKED CAPTCHA_DETECTED')
            return SimpleNamespace(success=True)
    fake = SimpleNamespace(AsyncWebCrawler=Crawler, BrowserConfig=lambda **k:SimpleNamespace(**k), CrawlerRunConfig=lambda **k:SimpleNamespace(**k), CacheMode=SimpleNamespace(BYPASS='bypass'))
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.return_value = SimpleNamespace(status_code=200,text='User-agent: *\nAllow: /')
    with patch.dict(sys.modules, {'crawl4ai':fake}), patch('app.collectors.crawl4ai_collector.httpx.AsyncClient', return_value=client), patch('app.services.memory_budget.require_browser_memory'), patch('app.config.settings.CRAWL4AI_ENABLED', True), patch('app.config.settings.HAPPYFARES_PROTOTYPE_ENABLED', True), patch('app.config.settings.HAPPYFARES_REVIEW_NOTES', 'unit test only'):
        progress = AsyncMock()
        result = await Crawl4AICollector('hf').run(request(max_results=20), on_progress=progress)
    assert result['status'] == expected
    assert len(result['quotes']) == (15 if expected == 'SUCCESS' else 0)
    assert Crawler.closed and Crawler.config.headless
    events = [call.args[0] for call in progress.await_args_list]
    assert [event['stage'] for event in events[:3]] == ['POLICY_CHECK', 'BROWSER_LAUNCH', 'NAVIGATION']
    assert events[-1]['status'] == expected
    assert events[-1]['stages'][-1]['status'] == ('COMPLETED' if expected == 'SUCCESS' else 'FAILED')

@pytest.mark.asyncio
async def test_main_api_sends_crawl4ai_request_to_staging():
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from types import SimpleNamespace
    from app.api.v1.live import LiveRequest, collect
    departure = datetime.now(ZoneInfo('Asia/Kolkata')).date()+timedelta(days=7)
    payload = LiveRequest(source='happyfares', origin='DEL', destination='BOM', departure_date=departure, max_results=5)
    enqueue = AsyncMock(return_value={'collection_run_id':str(uuid4()), 'status':'QUEUED'})
    with patch('app.api.v1.live.source_enabled', return_value=True), patch('app.api.v1.live.enqueue_collection', enqueue), patch('app.services.memory_budget.require_browser_memory', side_effect=AssertionError('API must not launch/check worker browser')):
        result = await collect(payload, AsyncMock(), SimpleNamespace(user_id=str(uuid4())))
    assert result['data']['status'] == 'QUEUED'
    sent = enqueue.await_args.args[1]
    assert sent['engine'] == 'CRAWL4AI' and sent['max_results'] == 5
    assert sent['booking_window_days'] == 7 and sent['departure_date'] == str(departure)


@pytest.mark.asyncio
async def test_happyfares_config_checks_browser_on_worker():
    from app.api.v1.live import configuration
    with patch('app.api.v1.live.rows', AsyncMock(return_value=[])), patch('app.config.settings.CRAWL4AI_ENABLED', True), patch('app.config.settings.LIVE_WORKER_ENABLED', False), patch('app.services.memory_budget.require_browser_memory', side_effect=AssertionError('Wrong host')):
        config = (await configuration('happyfares', None, AsyncMock()))['data']
    assert config['engine'] == 'CRAWL4AI' and config['worker_enabled']
    assert config['browser_available'] is None and config['execution_host'] == 'celery'


@pytest.mark.asyncio
async def test_enqueue_dispatches_celery_after_commit():
    from app.services.live_acquisition import enqueue_collection
    from app.workers.collection_tasks import collect_staged_live_task
    source_id, job_id = uuid4(), uuid4()
    source = {'id':source_id, 'name':'happyfares', 'rate_limit_per_minute':1}
    db = AsyncMock()
    def dispatched(*args, **kwargs):
        assert db.commit.await_count == 1
    with patch('app.services.live_acquisition.rows', AsyncMock(side_effect=[[source], [source], []])), patch('app.services.live_acquisition.insert', AsyncMock(side_effect=[uuid4(), job_id])), patch('app.services.live_acquisition.audit', AsyncMock()), patch('app.services.live_acquisition.publish_progress', AsyncMock()), patch.object(collect_staged_live_task, 'apply_async', side_effect=dispatched) as dispatch:
        queued = await enqueue_collection(db, {'source':'happyfares'})
    assert queued['pipeline_run_id'] == str(job_id)
    dispatch.assert_called_once_with(args=[str(job_id)], retry=False)


def test_source_cooldown_deadline_and_expiry():
    from datetime import datetime, timezone, timedelta
    from app.services.live_acquisition import source_cooldown
    now = datetime(2026, 9, 9, 12, 0, tzinfo=timezone.utc)
    assert source_cooldown({}, now) is None
    assert source_cooldown({'last_failure_at': now - timedelta(minutes=2)}, now) == now + timedelta(minutes=3)
    assert source_cooldown({'last_failure_at': now - timedelta(minutes=5)}, now) is None
    assert source_cooldown({'last_failure_at': now - timedelta(minutes=6)}, now) is None
