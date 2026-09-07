"""Bounded public result-page collection; no private API or booking requests."""
import asyncio
import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qs
from urllib.robotparser import RobotFileParser
import httpx
from playwright.async_api import async_playwright

CARD = '.row.text-center.py-2:has(button#OnwardBook)'

def search_url(origin, destination, departure):
    return 'https://www.happyfares.in/flights/' + urlencode(dict(
        origin=origin, destination=destination, onward=departure.strftime('%d-%m-%Y'),
        return_='', type='DOMESTIC', **{'class':'ECONOMY'}, adult=1, child=0, infant=0,
        direct='', discount='', nocache='', defence='', student='', senior='', doctor='', ccode='IN')).replace('return_=', 'return=')

def parse_card(text, origin, destination, departure, observed_at, url):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    airline = next((re.fullmatch(r'([A-Z0-9][A-Z0-9\-, ]+)\s*\|\s*(.+)', line) for line in lines if '|' in line), None)
    times = [re.fullmatch(r'((?:[01]\d|2[0-3]):[0-5]\d)(?: \+\d+ day)?', line) for line in lines]
    times = [m[1] for m in times if m]
    codes = [m[1] for line in lines for m in [re.search(r'\(([A-Z]{3})\)',line)] if m]
    dates = []
    for line in lines:
        try:
            dates.append(datetime.strptime(line, '%a, %d %b %Y').date())
        except ValueError:
            pass
    price_lines = [line for line in lines if re.fullmatch(r'(?:₹\s*[\d,]+\.\d{2}\s*){1,2}',line)]
    if not airline or len(times)!=2 or codes != [origin,destination] or len(dates)!=2 or dates[0]!=departure or len(price_lines)!=1:
        return None
    prices = re.findall(r'₹\s*([\d,]+\.\d{2})',price_lines[0])
    amount = float(prices[-1].replace(',',''))
    if not 500 <= amount <= 500000:
        return None
    dep = datetime.fromisoformat(f'{dates[0]}T{times[0]}')
    arr = datetime.fromisoformat(f'{dates[1]}T{times[1]}')
    if not 0 < (arr-dep).total_seconds() <= 24*3600:
        return None
    return dict(carrier=airline[2].strip(),flight_number=airline[1].strip(),origin=codes[0],destination=codes[1],
        departure_date=str(dates[0]),arrival_date=str(dates[1]),departure_time=times[0],arrival_time=times[1],
        gross_total=amount,currency='INR',cabin_class='economy',base_price=None,tax_amount=None,
        mandatory_fees=None,is_non_stop=any(re.fullmatch(r'Non-\s*Stop',line,re.I) for line in lines),
        provenance=dict(source='HappyFares',engine='PLAYWRIGHT',observed_at=observed_at,requested_url=url,
            response_hash=hashlib.sha256(text.encode()).hexdigest(),raw_card_text=text,
            price_basis='displayed_search_total_after_displayed_discount; checkout not verified',
            undiscounted_displayed_fare=float(prices[0].replace(',','')) if len(prices)>1 else None))

async def collect(origin, destination, departure, limit=10, is_nonstop=None):
    from app.config import settings
    from app.services.memory_budget import require_browser_memory
    result = dict(status='FAILED',quotes=[],collector_version='happyfares-public-v1',collection_engine='PLAYWRIGHT',stages=[])
    stage = 'POLICY_CHECK'
    browser = None
    try:
        if not settings.HAPPYFARES_PROTOTYPE_ENABLED or not settings.HAPPYFARES_REVIEW_NOTES.strip():
            raise PermissionError('HappyFares remains MANUAL_REVIEW_REQUIRED. Configure HAPPYFARES_PROTOTYPE_ENABLED and HAPPYFARES_REVIEW_NOTES after review.')
        url = search_url(origin,destination,departure)
        async with httpx.AsyncClient(timeout=15,follow_redirects=True) as client:
            robots = await client.get('https://www.happyfares.in/robots.txt')
            robots.raise_for_status()
        policy = RobotFileParser()
        policy.parse(robots.text.splitlines())
        if not policy.can_fetch('AirPulseResearch',url):
            raise PermissionError('robots.txt disallows the public search page')
        stage = 'BROWSER_LAUNCH'
        require_browser_memory()
        async with async_playwright() as pw:
            try:
                browser = await pw.chromium.launch(channel='chrome',headless=False)
                page = await browser.new_page(locale='en-IN',viewport={'width':1280,'height':800})
                blocked = []
                def check_response(response):
                    if urlparse(response.url).hostname not in ('happyfares.in','www.happyfares.in'):
                        return
                    if response.request.resource_type == 'document':
                        result['http_status'] = response.status
                    if response.status in (403,429) and response.request.resource_type in ('document','xhr','fetch'):
                        blocked.append(response.status)
                page.on('response',check_response)
                stage = 'PUBLIC_SEARCH'
                response = await page.goto('https://www.happyfares.in/',wait_until='domcontentloaded',timeout=45000)
                result['http_status'] = response.status if response else None
                async def guard():
                    if blocked:
                        raise PermissionError(f'Upstream HTTP {blocked[0]}')
                    from app.services.browser_service import get_shared_browser_service
                    challenge = await get_shared_browser_service().check_for_challenges(page=page,http_status=result['http_status'],title=await page.title(),content='')
                    if challenge.detected:
                        raise PermissionError(challenge.reason or 'Access challenge')
                    if result['http_status'] and result['http_status'] >= 400:
                        raise ConnectionError(f"Source document returned HTTP {result['http_status']}")
                await guard()
                stage = 'SEARCH_CONTROLS'
                await page.get_by_text(re.compile(r'[A-Z]{3},\s*\d{2} [A-Z]{3}')).filter(visible=True).first.click()
                # The calendar shows current and next month, each with a header
                # table followed by its date table. Match the observed month.
                month = departure.strftime('%B - %Y')
                for _ in range(13):
                    header = page.get_by_role('cell',name=month,exact=True)
                    if await header.count():
                        break
                    await page.get_by_text('arrow_forward',exact=True).filter(visible=True).click()
                else:
                    raise ValueError('Requested month not available in bounded calendar')
                calendar = header.locator('xpath=ancestor::table[1]/following::table[1]')
                await calendar.get_by_role('cell',name=re.compile(rf'^{departure.day}(?: ₹ [\d,]+)?$')).first.click()
                for placeholder, code in [('Select Origin City',origin),('Select Destination City',destination)]:
                    await page.get_by_role('textbox',name=placeholder,exact=True).fill(code,timeout=30000)
                    await page.get_by_text(code,exact=True).filter(visible=True).click(timeout=15000)
                    await guard()
                if '/flights/origin=' not in page.url:
                    await page.get_by_role('button',name='Search',exact=True).click()
                await page.wait_for_url('**/flights/origin=*',timeout=30000)
                if urlparse(page.url).hostname not in ('happyfares.in','www.happyfares.in'):
                    raise ValueError('Search left the approved source domain')
                actual = parse_qs(urlparse(page.url).path.split('/flights/',1)[1])
                expected = dict(origin=origin,destination=destination,onward=departure.strftime('%d-%m-%Y'),adult='1',child='0',infant='0',**{'class':'ECONOMY'})
                if any(actual.get(k)!=[v] for k,v in expected.items()) or actual.get('return'):
                    raise ValueError('Search itinerary did not match the request')
                stage = 'RESULT_DETECTION'
                for _ in range(45):
                    await guard()
                    if await page.locator(CARD).count():
                        break
                    await asyncio.sleep(1)
                else:
                    raise TimeoutError('No flight cards appeared within 45 seconds')
                stage = 'EXTRACT_VALIDATE'
                observed = datetime.now(timezone.utc).isoformat()
                seen = set()
                cards = page.locator(CARD)
                for i in range(min(await cards.count(),150)):
                    await guard()
                    quote = parse_card(await cards.nth(i).inner_text(),origin,destination,departure,observed,page.url)
                    if quote is None or (is_nonstop and not quote['is_non_stop']):
                        continue
                    key = (quote['flight_number'],quote['departure_time'],quote['gross_total'])
                    if key not in seen:
                        seen.add(key)
                        result['quotes'].append(quote)
                    if len(result['quotes']) >= min(limit,15):
                        break
                result['status'] = 'PASSED' if result['quotes'] else 'FAILED'
                if not result['quotes']:
                    result.update(failure_stage='VALIDATION_ERROR',failure_reason='No cards matched the exact requested itinerary')
                result['stages'].append({'stage':stage,'status':'COMPLETED','count':len(result['quotes'])})
            except Exception:
                from pathlib import Path
                from contextlib import suppress
                target = Path('scratch/happyfares-failure.txt')
                target.parent.mkdir(exist_ok=True)
                with suppress(Exception):
                    target.write_text(page.url + '\n' + await page.locator('body').inner_text(timeout=3000),encoding='utf-8')
                raise
            finally:
                if browser:
                    await browser.close()
    except Exception as exc:
        result.update(failure_stage=stage,failure_reason=str(exc),status='FAILED',quotes=[])
        result['stages'].append({'stage':stage,'status':'FAILED','detail':str(exc)})
    return result
