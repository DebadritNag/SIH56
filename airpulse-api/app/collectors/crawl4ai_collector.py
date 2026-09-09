"""Single-session Crawl4AI engine integrated with BaseCollector and live staging."""
import asyncio
import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
from app.collectors.base import BaseCollector


class CollectionStopped(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(f'{status}: {message}')


def check_access(status, visible_text=''):
    if status == 403:
        raise CollectionStopped('BLOCKED', 'Upstream HTTP 403')
    if status == 429:
        raise CollectionStopped('RATE_LIMITED', 'Upstream HTTP 429')
    if re.search(r'captcha|verify you are human|checking your browser|just a moment|security challenge', visible_text, re.I):
        raise CollectionStopped('CAPTCHA_DETECTED', 'Source presents an access challenge')
    if re.search(r'access denied|request blocked', visible_text, re.I):
        raise CollectionStopped('BLOCKED', 'Source denies access')
    if status == 404:
        raise CollectionStopped('NOT_FOUND', 'Upstream HTTP 404')
    if status and status >= 400:
        raise CollectionStopped('HTTP_ERROR', f'Upstream HTTP {status}')


class Crawl4AICollector(BaseCollector):
    def __init__(self, source_id, source_name='HappyFares'):
        super().__init__(source_id, source_name, 'happyfares-crawl4ai-v1', 1, 120, 0)

    async def collect(self, search_request):
        result = await self.run(search_request)
        if not result['quotes']:
            raise CollectionStopped(result['status'], result.get('failure_reason', result['status']))
        return result['quotes']

    def parse(self, raw_payload):
        return raw_payload

    async def health_check(self):
        from app.config import settings
        return {'source': self.source_name, 'engine': 'CRAWL4AI', 'enabled': settings.CRAWL4AI_ENABLED}

    async def run(self, request, on_progress=None):
        from app.config import settings
        from app.collectors.sources import happyfares as adapter
        result = dict(status='FAILED', quotes=[], collection_engine='CRAWL4AI',
            collector_version=self.collector_version, stages=[], started_at=datetime.now(timezone.utc).isoformat())
        stage = 'POLICY_CHECK'
        timeline = []
        async def enter(name):
            nonlocal stage
            if timeline and timeline[-1]['status'] == 'RUNNING':
                timeline[-1].update(status='COMPLETED', finished_at=datetime.now(timezone.utc).isoformat())
            stage = name
            timeline.append({'stage':name, 'status':'RUNNING', 'started_at':datetime.now(timezone.utc).isoformat()})
            if on_progress:
                await on_progress({'stage':name, 'status':'RUNNING', 'engine':'CRAWL4AI',
                    'updated_at':datetime.now(timezone.utc).isoformat(), 'stages':[dict(s) for s in timeline]})
        try:
            await enter('POLICY_CHECK')
            if not (settings.CRAWL4AI_ENABLED and settings.HAPPYFARES_PROTOTYPE_ENABLED and settings.HAPPYFARES_REVIEW_NOTES.strip()):
                raise CollectionStopped('SKIPPED_POLICY', 'Enable Crawl4AI and configure HappyFares prototype review before collection')
            if request.passengers != 1 or request.currency != 'INR' or request.cabin.value.lower() != 'economy':
                raise CollectionStopped('FAILED', 'This adapter supports Economy, one adult, INR only')
            limit = min(request.max_results, 15)
            url = adapter.search_url(request.origin, request.destination, request.departure_date)
            result['source_url'] = url
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                robots = await client.get('https://www.happyfares.in/robots.txt')
            check_access(robots.status_code, robots.text)
            policy = RobotFileParser()
            policy.parse(robots.text.splitlines())
            if not policy.can_fetch('AirPulseResearch', url):
                raise CollectionStopped('SKIPPED_POLICY', 'robots.txt disallows the public search page')
            await enter('BROWSER_LAUNCH')
            from app.services.memory_budget import require_browser_memory
            require_browser_memory()
            from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
            blocked = []
            hook_failures = []
            async def setup(page, context, **kwargs):
                def response_seen(response):
                    if urlparse(response.url).hostname in ('happyfares.in', 'www.happyfares.in') and response.request.resource_type in ('document', 'xhr', 'fetch') and response.status in (403, 429):
                        blocked.append(response.status)
                page.on('response', response_seen)
                return page
            async def extract(page, context, response=None, **kwargs):
                nonlocal stage
                await enter('RESULT_DETECTION')
                result['http_status'] = response.status if response else None
                async def guard():
                    check_access(blocked[0] if blocked else result.get('http_status'), await page.locator('body').inner_text(timeout=10000))
                await guard()
                # Only the public result page; no private API or booking calls.
                if page.url != url:
                    raise CollectionStopped('NOT_FOUND', 'Public search redirected; requested itinerary cannot be verified')
                for _ in range(30):
                    await guard()
                    if await page.locator(adapter.CARD).count():
                        break
                    body = await page.locator('body').inner_text(timeout=3000)
                    if re.search(r'no flights (?:found|available)|no results found', body, re.I):
                        raise CollectionStopped('NO_AVAILABILITY', 'Source reports no availability')
                    if re.search(r'enable javascript', body, re.I):
                        raise CollectionStopped('CONTENT_REQUIRES_JS', 'Source requires JavaScript that did not render')
                    await asyncio.sleep(1)
                else:
                    raise CollectionStopped('TIMEOUT', 'No visible result cards within 30 seconds')
                await enter('EXTRACT_VALIDATE')
                seen = set()
                observed = datetime.now(timezone.utc).isoformat()
                cards = page.locator(adapter.CARD)
                texts = await cards.evaluate_all('(cards) => cards.filter(c => c.getClientRects().length > 0).slice(0,150).map(c => c.innerText)')
                result['raw_card_samples'] = texts[:5]
                for card_text in texts:
                    quote = adapter.parse_card(card_text, request, observed, page.url)
                    if quote and quote['response_hash'] not in seen:
                        seen.add(quote['response_hash'])
                        result['quotes'].append(quote)
                    if len(result['quotes']) >= limit:
                        break
                await guard()
                return page
            async def guarded_extract(*args, **kwargs):
                try:
                    return await extract(*args, **kwargs)
                except CollectionStopped as exc:
                    # Crawl4AI wraps hook exceptions with source-code excerpts.
                    # Preserve the typed error; never classify those excerpts.
                    hook_failures.append(exc)
                    raise
            async with AsyncWebCrawler(config=BrowserConfig(browser_type='chromium', headless=True, verbose=False)) as crawler:
                await enter('NAVIGATION')
                crawler.crawler_strategy.set_hook('on_page_context_created', setup)
                crawler.crawler_strategy.set_hook('after_goto', guarded_extract)
                crawled = await crawler.arun(url=url, config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS,
                    wait_until='domcontentloaded', page_timeout=45000, screenshot=False, pdf=False,
                    scan_full_page=False, verbose=False, delay_before_return_html=0))
                if blocked:
                    check_access(blocked[0])
                if hook_failures:
                    raise hook_failures[0]
                if not crawled.success:
                    error = crawled.error_message or 'Crawl4AI navigation failed'
                    raise CollectionStopped('TIMEOUT' if 'timeout' in error.lower() else 'HTTP_ERROR', error)
            result['status'] = ('SUCCESS' if len(result['quotes']) >= limit else 'PARTIAL') if result['quotes'] else 'PARSE_ERROR'
            if not result['quotes']:
                result['failure_reason'] = 'No valid observed fares matched the requested route/date'
        except Exception as exc:
            result.update(status=exc.status if isinstance(exc, CollectionStopped) else ('TIMEOUT' if 'timeout' in str(exc).lower() else 'FAILED'), quotes=[], failure_reason=str(exc))
        result['completed_at'] = datetime.now(timezone.utc).isoformat()
        result['observations_found'] = len(result['quotes'])
        result['failure_stage'] = None if result['quotes'] else result['status']
        if timeline:
            timeline[-1].update(status='COMPLETED' if result['quotes'] else 'FAILED',
                count=len(result['quotes']), detail=result.get('failure_reason'), finished_at=result['completed_at'])
        result['stages'] = timeline
        if on_progress:
            await on_progress({'stage':stage, 'status':result['status'], 'engine':'CRAWL4AI',
                'updated_at':result['completed_at'], 'stages':[dict(s) for s in timeline]})
        return result
