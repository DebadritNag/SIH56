"""HappyFares public-card extraction. Missing optional values stay null."""
import hashlib
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.scraping.happyfares_browser import CARD, search_url as legacy_search_url
from urllib.parse import quote


def search_url(origin, destination, departure):
    # Labels and BType were present in the public URL captured by the working UI.
    # This first adapter is verified only for the requested DEL/BOM prototype.
    names = {'DEL': 'new delhi', 'BOM': 'mumbai'}
    if origin not in names or destination not in names:
        raise ValueError('HappyFares Crawl4AI currently supports DEL and BOM only')
    url = legacy_search_url(origin, destination, departure)
    return url.replace('&student=', f'&originName={quote(names[origin])}&destinationName={quote(names[destination])}&BType=&student=')


def parse_card(text, request, observed_at, url):
    lines = [s.strip() for s in text.splitlines() if s.strip()]
    codes = [m[1] for line in lines for m in [re.search(r'\(([A-Z]{3})\)', line)] if m]
    dates = []
    for line in lines:
        try:
            dates.append(datetime.strptime(line, '%a, %d %b %Y').date())
        except ValueError:
            pass
    components = {'base_price': None, 'tax_amount': None}
    component_lines = set()
    for i, line in enumerate(lines):
        match = re.fullmatch(r'(Base Fare|Taxes(?: and fees)?)\s*:?\s*(₹\s*[\d,]+(?:\.\d{2})?)?', line, re.I)
        if not match:
            continue
        amount = match[2]
        if amount is None and i+1 < len(lines) and re.fullmatch(r'₹\s*[\d,]+(?:\.\d{2})?', lines[i+1]):
            amount = lines[i+1]
            component_lines.add(i+1)
        if amount:
            components['base_price' if match[1].lower() == 'base fare' else 'tax_amount'] = float(amount.replace('₹','').replace(',','').strip())
    prices = [line for i, line in enumerate(lines) if i not in component_lines and re.fullmatch(r'(?:₹\s*[\d,]+(?:\.\d{2})?\s*){1,2}', line)]
    if codes != [request.origin, request.destination] or not dates or dates[0] != request.departure_date or len(prices) != 1:
        return None
    total = float(re.findall(r'₹\s*([\d,]+(?:\.\d{2})?)', prices[0])[-1].replace(',', ''))
    if total <= 0:
        return None
    airline = next((re.fullmatch(r'([A-Z0-9][A-Z0-9\-, ]+)\s*\|\s*(.+)', line) for line in lines if '|' in line), None)
    time_lines = [line for line in lines if re.fullmatch(r'\d{2}:\d{2}(?: \+\d+ day)?', line)]
    times = [line[:5] for line in time_lines if re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d(?: \+\d+ day)?', line)]
    if len(time_lines) != len(times):
        return None
    if len(times) == 2 and len(dates) == 2:
        dep = datetime.fromisoformat(f'{dates[0]}T{times[0]}')
        arr = datetime.fromisoformat(f'{dates[1]}T{times[1]}')
        if not 0 < (arr-dep).total_seconds() <= 24*3600:
            return None
    stops = next((False if re.fullmatch(r'Non-\s*Stop', s, re.I) else True for s in lines if re.fullmatch(r'(?:Non-\s*Stop|\d+ Stops?)', s, re.I)), None)
    if request.is_nonstop and stops is not False:
        return None
    checksum = hashlib.sha256(text.encode()).hexdigest()
    observed = datetime.fromisoformat(observed_at.replace('Z', '+00:00'))
    return dict(source='HappyFares', source_url=url, observed_at=observed_at,
        origin=codes[0], destination=codes[1], departure_date=str(dates[0]),
        arrival_date=str(dates[1]) if len(dates) == 2 else None,
        carrier=airline[2].strip() if airline else None, flight_number=airline[1].strip() if airline else None,
        departure_time=times[0] if len(times) == 2 else None, arrival_time=times[1] if len(times) == 2 else None,
        **components, mandatory_fees=None, gross_total=total, currency='INR',
        cabin_class='economy', is_non_stop=None if stops is None else not stops,
        booking_window_days=(dates[0]-observed.astimezone(ZoneInfo('Asia/Kolkata')).date()).days,
        acquisition_method='CRAWL4AI', data_origin='LIVE', raw_evidence=text, response_hash=checksum,
        provenance=dict(source='HappyFares', engine='CRAWL4AI', acquisition_method='CRAWL4AI',
            observed_at=observed_at, requested_url=url, response_hash=checksum, raw_card_text=text,
            price_basis='displayed search total; checkout not verified'))
