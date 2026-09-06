"""Yatra's one-way React search, in a fresh installed-Chrome session.

No direct trigger URL, shared browser, stealth, or retry after an access block.
"""
import hashlib
import logging
import re
import time
from contextlib import suppress
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

from app.config import settings
from app.scraping.engines.base import EngineResult
from app.scraping.adapters.yatra import parse_inr_price
from app.services.browser_service import get_shared_browser_service

CARDS = '.flightItem:not(.banner) .flight-det'


def date_label(day):
    suffix = 'th' if 10 < day.day % 100 < 14 else {1:'st',2:'nd',3:'rd'}.get(day.day % 10,'th')
    return f"Choose {day.strftime('%A, %B')} {day.day}{suffix}, {day.year}"


def verify_search_url(url, request):
    parsed = urlparse(url)
    if parsed.hostname != 'flight.yatra.com' or not parsed.path.startswith('/air-search'):
        raise ValueError('Search did not reach flight.yatra.com/air-search')
    query = parse_qs(parsed.query)
    cabin = getattr(request.cabin,'value',request.cabin).replace('_',' ').title()
    cabin = 'Special' if cabin == 'Premium Economy' else cabin
    expected = dict(origin=request.origin,destination=request.destination,
                    flight_depart_date=request.departure_date.strftime('%d/%m/%Y'),
                    ADT=str(request.passengers),**{'class':cabin})
    for name, value in expected.items():
        if query.get(name) != [value]:
            raise ValueError(f'Search URL {name} mismatch: expected {value}, received {query.get(name)}')
    if query.get('type') != ['O'] or query.get('noOfSegments',['1']) != ['1'] or any(query.get(k,['0']) != ['0'] for k in ('CHD','INF')):
        raise ValueError('Search is not the requested adults-only one-way journey')
    return query


def parse_card(html, query, url, observed_at):
    """Card evidence only; verified URL supplies the searched date/cabin context."""
    soup = BeautifulSoup(html,'html.parser')
    for element in soup.select('del,s,strike,[aria-hidden="true"]'):
        element.decompose()
    def field(selector):
        element = soup.select_one(selector)
        return element.get_text(' ',strip=True) if element else ''
    origin_text = field('.depart-details .mob-origin')
    destination_text = field('.arrival-details .mob-origin')
    origin = re.search(r'\(([A-Z]{3})\)',origin_text)
    destination = re.search(r'\(([A-Z]{3})\)',destination_text)
    if not origin or not destination or [origin[1],destination[1]] != [query['origin'][0],query['destination'][0]]:
        return None
    departure_time = field('.depart-details .mob-time')
    arrival_time = field('.arrival-details .mob-time')
    if not all(re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',v) for v in (departure_time,arrival_time)):
        return None
    amount = parse_inr_price(field('.ow-price-above-btn'))
    if amount is None:
        return None
    search_date = datetime.strptime(query['flight_depart_date'][0],'%d/%m/%Y').date()
    displayed_date = field('.depart-details .mob-date')
    try:
        departure_date = datetime.strptime(f'{displayed_date} {search_date.year}','%d %b %Y').date()
    except ValueError:
        return None
    if departure_date != search_date:
        return None
    stops_text = field('.stops-details span.mob-duration')
    stops = False if re.search(r'\b[1-9]\s*stops?\b',stops_text,re.I) else True if re.fullmatch(r'non[ -]?stop',stops_text,re.I) else None
    return dict(carrier=field('.airline-name > span[title]') or None,flight_number=field('.fl-no') or None,
        origin=origin[1],destination=destination[1],departure_time=departure_time,arrival_time=arrival_time,
        departure_date=departure_date.isoformat(),arrival_date_text=field('.arrival-details .mob-date') or None,
        duration=field('[autom="durationLabel"]') or None,stops_text=stops_text or None,
        cabin_class='premium_economy' if query['class'][0]=='Special' else query['class'][0].lower(),currency='INR',gross_total=amount,
        base_price=None,tax_amount=None,mandatory_fees=None,fare_class=None,is_non_stop=stops,seats_available=None,
        provenance=dict(source='Yatra',engine='PLAYWRIGHT',engine_version='yatra-homepage-v1',
            observed_at=observed_at,requested_url=url,response_hash=hashlib.sha256(html.encode()).hexdigest(),
            raw_card=html,date_basis='displayed_card_date_with_verified_search_year',cabin_basis='verified_search_url'))



class YatraBrowserCollector:
    def __init__(self):
        self.stage = 'BROWSER_LAUNCH'
        self.control = 'installed Google Chrome'
        self.events = []
        self.blocked = None
        self.http_status = None
        self.browser_version = None
        self.final_url = None

    async def guard(self, page):
        if self.blocked:
            raise PermissionError(f'HTTP {self.blocked}: Yatra access restricted')
        result = await get_shared_browser_service().check_for_challenges(
            page=page,http_status=self.http_status,title=await page.title(),content='')
        if result.detected:
            raise PermissionError(result.reason or 'Yatra access challenge')

    async def action(self, page, stage, control, operation):
        self.stage, self.control = stage, control
        await self.guard(page)
        result = await operation()
        await self.guard(page)
        self.events.append(dict(stage=stage,control=control,status='COMPLETED',finished_at=datetime.now(timezone.utc).isoformat()))
        return result

    async def airport(self,page,label,code):
        # Selecting origin can automatically activate destination. Never click a
        # label over an already-open input; check its nearest labelled container.
        field = page.locator('#input-with-icon-adornment:visible')
        self.control = label
        active = await field.count() == 1 and await field.evaluate('(e) => document.activeElement === e')
        if not active:
            await page.get_by_text(label,exact=True).click()
        self.control = f'{label}: #input-with-icon-adornment'
        await field.fill(code)
        self.control = f'{label}: exact {code} suggestion'
        await page.get_by_text(code,exact=True).click()

    async def calendar(self,page,day):
        option = page.get_by_role('option',name=date_label(day),exact=True)
        if not await page.get_by_role('button',name='Next Month',exact=True).is_visible():
            await page.get_by_text('Departure Date',exact=True).click()
        for _ in range(13):
            await self.guard(page)
            if await option.is_visible():
                self.control = date_label(day)
                await option.click()
                return
            next_month = page.get_by_role('button',name='Next Month',exact=True)
            self.control = 'Next Month / calendar transition'
            old = await page.locator('.react-datepicker__current-month').all_text_contents()
            await next_month.click()
            await page.wait_for_function('(old) => JSON.stringify(Array.from(document.querySelectorAll(".react-datepicker__current-month"), e=>e.textContent)) !== JSON.stringify(old)',arg=old)
        raise ValueError(f'Date not found after 13 calendar months: {date_label(day)}')

    async def travellers(self,page,request):
        panel = page.locator('#traveller_container')
        if not await panel.is_visible():
            self.control = 'Travellers class inputbox'
            await page.get_by_role('combobox',name='Travellers class inputbox',exact=True).click()
        await panel.wait_for(state='visible')
        adults = page.locator('#travellers_card_section0 [aria-label="Adult"]').locator('..')
        self.control = f'Adult: Select age {request.passengers}'
        await adults.get_by_label(f'Select age {request.passengers}',exact=True).click()
        cabin = getattr(request.cabin,'value',request.cabin).replace('_',' ').title()
        self.control = f'label[role=radio]: {cabin}'
        await panel.locator('label[role=radio]').filter(has_text=re.compile('^'+re.escape(cabin)+'$')).click()
        self.control = 'Done'
        await page.get_by_text('Done',exact=True).click()

    async def execute(self,request):
        started = time.monotonic()
        browser = None
        page = None
        quotes = []
        seen = set()
        limit = min(request.max_results,15)
        result = EngineResult(status='FAILED',engine='PLAYWRIGHT',source_id='yatra',source_name='Yatra',
                              max_results=limit,requires_js=True)
        try:
            async with async_playwright() as pw:
                try:
                    launch_options = dict(channel='chrome', headless=settings.YATRA_BROWSER_HEADLESS)
                    if settings.YATRA_DISABLE_HTTP2:
                        launch_options['args'] = ['--disable-http2']
                    logging.getLogger(__name__).info(
                        'Yatra Chrome launch: headless=%s http2_disabled=%s args=%s',
                        settings.YATRA_BROWSER_HEADLESS, settings.YATRA_DISABLE_HTTP2,
                        launch_options.get('args', []),
                    )
                    browser = await pw.chromium.launch(**launch_options)
                    self.browser_version = browser.version
                    context = await browser.new_context(locale='en-IN')
                    page = await context.new_page()
                    page.set_default_timeout(15000)
                    def response_received(response):
                        host = urlparse(response.url).hostname or ''
                        if host == 'yatra.com' or host.endswith('.yatra.com'):
                            if response.request.resource_type == 'document':
                                self.http_status = response.status
                            if response.status in (403,429) and response.request.resource_type in ('document','xhr','fetch'):
                                self.blocked = response.status
                    page.on('response',response_received)
                    self.stage,self.control = 'HOMEPAGE','https://www.yatra.com/'
                    response = await page.goto('https://www.yatra.com/',wait_until='domcontentloaded',timeout=30000)
                    self.http_status = response.status if response else None
                    await self.guard(page)
                    await self.action(page,'TRIP_TYPE','One Way',lambda:page.get_by_text('One Way',exact=True).click())
                    await self.action(page,'ORIGIN','Departure From / IATA suggestion',lambda:self.airport(page,'Departure From',request.origin))
                    await self.action(page,'DESTINATION','Arrival At / IATA suggestion',lambda:self.airport(page,'Arrival At',request.destination))
                    await self.action(page,'DATE',date_label(request.departure_date),lambda:self.calendar(page,request.departure_date))
                    await self.action(page,'TRAVELLERS','Adults / cabin / Done',lambda:self.travellers(page,request))
                    await self.action(page,'SEARCH','Search',lambda:page.get_by_text('Search',exact=True).click())
                    self.stage,self.control = 'VERIFY_SEARCH','flight.yatra.com/air-search query parameters'
                    await page.wait_for_url(re.compile(r'https://flight\.yatra\.com/air-search'),wait_until='domcontentloaded',timeout=30000)
                    await self.guard(page)
                    query = verify_search_url(page.url,request)
                    self.final_url = page.url
                    self.stage,self.control = 'RESULT_CARDS',CARDS
                    cards = page.locator(CARDS)
                    await cards.first.wait_for(state='visible',timeout=30000)
                    for batch in range(8):
                        await self.guard(page)
                        count = await cards.count()
                        for card in await cards.all():
                            if not await card.is_visible():
                                continue
                            html = await card.inner_html()
                            quote = parse_card(html,query,page.url,datetime.now(timezone.utc).isoformat())
                            if not quote or (request.is_nonstop is True and quote['is_non_stop'] is not True):
                                continue
                            signature = tuple(quote[k] for k in ('carrier','flight_number','departure_time','arrival_time','origin','destination','gross_total'))
                            if signature not in seen:
                                seen.add(signature)
                                quotes.append(quote)
                            if len(quotes)>=limit:
                                break
                        result.results_seen = max(result.results_seen,count)
                        if len(quotes)>=limit:
                            break
                        await cards.last.scroll_into_view_if_needed()
                        try:
                            await page.wait_for_function('(s) => document.querySelectorAll(s.selector).length > s.count',arg={'selector':CARDS,'count':count},timeout=5000)
                        except PlaywrightTimeout:
                            break
                    await self.guard(page)
                    result.quotes = quotes
                    result.quotes_found = result.results_collected = result.results_matching = len(quotes)
                    result.status = 'SUCCESS' if quotes else 'PARSE_ERROR'
                    result.stop_reason = 'RESULT_LIMIT_REACHED' if len(quotes)>=limit else 'PAGE_EXHAUSTED'
                    if not quotes:
                        result.failure_code,result.failure_message = 'PARSE_ERROR','Visible cards did not contain valid matching routes, times and prices'
                except Exception as exc:
                    if page:
                        # A control timeout caused by a challenge remains blocked.
                        try:
                            await self.guard(page)
                        except PermissionError as block:
                            exc = block
                        except Exception:
                            pass
                    code = 'BLOCKED' if isinstance(exc,PermissionError) else 'TIMEOUT' if isinstance(exc,PlaywrightTimeout) else 'BROWSER_UNAVAILABLE' if self.stage=='BROWSER_LAUNCH' else 'CONTROL_ERROR'
                    if code == 'CONTROL_ERROR' and 'net::ERR_' in str(exc):
                        code = 'NETWORK_ERROR'
                    result.status = result.failure_code = code
                    result.stop_reason = 'BLOCKED' if code=='BLOCKED' else 'TIMEOUT' if code=='TIMEOUT' else 'ERROR'
                    result.failure_message = f'{self.stage} [{self.control}]: {exc}'
                    if page and settings.YATRA_SAVE_DIAGNOSTICS:
                        from pathlib import Path
                        target = Path('scratch/yatra-browser-failure.html')
                        target.parent.mkdir(exist_ok=True)
                        with suppress(Exception):
                            target.write_text(await page.content(),encoding='utf-8')
                finally:
                    if page:
                        self.final_url = page.url
                    if browser:
                        with suppress(Exception):
                            await browser.close()
        finally:
            result.http_status = self.blocked or self.http_status
            result.duration_ms = int((time.monotonic()-started)*1000)
            result.metadata = dict(workflow='homepage-one-way',channel='chrome',headless=settings.YATRA_BROWSER_HEADLESS,
                                   http2_disabled=settings.YATRA_DISABLE_HTTP2,
                                   browser_version=self.browser_version,browser_launch_status='SUCCESS' if self.browser_version else 'UNAVAILABLE',
                                   final_url=self.final_url,
                                   failed_stage=self.stage if result.status!='SUCCESS' else None,control=self.control,stages=self.events)
        return result
