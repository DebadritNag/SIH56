"""
Yatra OTA Source Adapter for AirPulse.

Implements strict ethical collection protocols:
- Scrapy first via isolated subprocess runner
- Legitimate Playwright escalation only on confirmed HTTP 200 client JS shell
- Zero-evasion: halts immediately on 403, 429, or CAPTCHA/Challenge
- Bounded collection of maximum 10-15 fares
- Preserves raw values, robust INR price parsing, no synthetic components
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup

from app.core.enums import CollectionEngine, StopReason
from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import RawQuote

logger = logging.getLogger(__name__)

# Price extraction regex
_MONEY_RE = re.compile(r"[\d,]+(?:\.\d+)?")
_TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
_FLIGHT_NO_RE = re.compile(r"\b(6E|AI|QP|IX|SG|UK|I5)[-\s]?(\d{3,4})\b", re.IGNORECASE)

CARRIER_MAP = {
    "6E": "IndiGo",
    "AI": "Air India",
    "QP": "Akasa Air",
    "IX": "Air India Express",
    "SG": "SpiceJet",
    "UK": "Air India",  # Vistara merged into Air India
    "I5": "Air India Express",
}


_CURRENCY_PRICE_RE = re.compile(r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)", re.IGNORECASE)
_TOTAL_KEYWORD_RE = re.compile(r"(?:total\s*(?:fare|price)?|gross\s*(?:total|fare)|final\s*price)[\s:]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)", re.IGNORECASE)


def parse_inr_price(text: Optional[str]) -> Optional[float]:
    """
    Robust INR currency parser.
    Handles '₹6,529', '₹ 6,529', 'INR 6,529', 'Rs 6,529', '6,529'.
    Filters out discounts, EMI, cashbacks, or struck-through prices.
    Prioritizes currency-prefixed numbers to prevent flight numbers (e.g. AI-805)
    from being mistakenly parsed as airfares.
    """
    if not text:
        return None

    # Filter out EMI, discount, or cashback text if isolated
    lowered = text.lower()
    if any(k in lowered for k in ("off", "discount", "cashback", "emi starts", "coupon")):
        if "total" not in lowered and "fare" not in lowered:
            return None

    # 1. Check for explicit total/fare keyword with amount
    total_match = _TOTAL_KEYWORD_RE.search(text)
    if total_match:
        try:
            val = float(total_match.group(1).replace(",", ""))
            if 500.0 <= val <= 500000.0:
                return val
        except ValueError:
            pass

    # 2. Extract all currency-tagged values (₹, Rs, INR)
    currency_matches = _CURRENCY_PRICE_RE.findall(text)
    if currency_matches:
        valid_prices = []
        for m in currency_matches:
            try:
                v = float(m.replace(",", ""))
                if 500.0 <= v <= 500000.0:
                    valid_prices.append(v)
            except ValueError:
                continue
        if valid_prices:
            # Multiple amounts are ambiguous (old fare, discount, or upgrade).
            return valid_prices[0] if len(set(valid_prices)) == 1 else None

    # 3. Fallback: if text itself is just a clean number string (e.g. '6,529' or '6529')
    cleaned = text.replace("\u20b9", "").replace("Rs.", "").replace("Rs", "").replace("INR", "").strip()
    if _MONEY_RE.fullmatch(cleaned):
        try:
            val = float(cleaned.replace(",", ""))
            if 500.0 <= val <= 500000.0:
                return val
        except ValueError:
            pass

    return None


class YatraAdapter(SourceAdapter):
    """Source adapter for Yatra OTA portal."""

    def __init__(self, base_url: Optional[str] = None):
        self._source_id = "yatra"
        self._source_name = "Yatra"
        self._base_url = base_url or "https://flight.yatra.com/air-search-ui/dom2/trigger"

    @property
    def source_id(self) -> str:
        return self._source_id

    @property
    def source_name(self) -> str:
        return self._source_name

    def supports_scrapy(self) -> bool:
        return True

    def supports_playwright(self) -> bool:
        return True

    def requires_javascript(self, request: SearchRequest) -> bool:
        """AUTO mode attempts Scrapy HTTP collection first."""
        return False

    def build_url(self, request: SearchRequest) -> str:
        """
        Builds dynamic Yatra search trigger URL from SearchRequest parameters.
        Format: DD/MM/YYYY for flight_depart_date.
        """
        dep_date = request.departure_date
        if isinstance(dep_date, datetime):
            dep_str = dep_date.strftime("%d/%m/%Y")
        elif hasattr(dep_date, "strftime"):
            dep_str = dep_date.strftime("%d/%m/%Y")
        else:
            # Parse ISO string YYYY-MM-DD
            try:
                parts = str(dep_date).split("-")
                dep_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
            except Exception:
                dep_str = str(dep_date)

        origin = request.origin.upper().strip()
        destination = request.destination.upper().strip()
        passengers = getattr(request, "passengers", 1) or 1
        cabin_raw = getattr(request.cabin, "value", str(request.cabin)) if hasattr(request, "cabin") else "Economy"
        cabin_clean = "Economy" if "eco" in cabin_raw.lower() else ("Business" if "bus" in cabin_raw.lower() else "Economy")

        return (
            f"{self._base_url}"
            f"?type=O&viewName=normal&flexi=0&noOfSegments=1"
            f"&origin={origin}&originCode={origin}"
            f"&destination={destination}&destinationCode={destination}"
            f"&flight_depart_date={dep_str}"
            f"&ADT={passengers}&CHD=0&INF=0&class={cabin_clean}&source=fresco-flights"
        )

    def build_scrapy_request(self, request: SearchRequest) -> Dict[str, Any]:
        """Constructs Scrapy request specification for Yatra."""
        return {
            "url": self.build_url(request),
            "method": "GET",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
            },
            "cookies": {},
            "body": None,
        }

    def is_js_shell(self, body_text: str, http_status: int) -> bool:
        """Positively identifies empty client JavaScript shell requiring Playwright."""
        if http_status != 200 or not body_text:
            return False
        lower = body_text.lower()
        # If Challenge Validation is present, it is a security challenge, NOT a JS shell
        if any(c in lower for c in ("challenge validation", "cp_clge_done", "_sec/verify", "provider=crypto")):
            return False
        # Known Yatra empty shells or generic SPA containers
        spa_markers = [
            '<div id="root"></div>',
            '<div id="app"></div>',
            '<app-root></app-root>',
            'class="dom2-loading"',
            'id="dom2-container"',
            'you need to enable javascript to run this app',
        ]
        return any(m in lower for m in spa_markers)

    def is_empty_availability(self, body_text: str, http_status: int) -> bool:
        """Identifies explicit no-flight availability message."""
        lower = body_text.lower()
        empty_markers = [
            "no flights found",
            "no flights available",
            "no direct or connecting flights",
            "sold out",
            "no seats available",
            "zero flights found",
        ]
        return any(m in lower for m in empty_markers)

    def parse_scrapy_response(
        self,
        response_data: Dict[str, Any],
        request: SearchRequest,
    ) -> List[RawQuote]:
        """Parses server-rendered HTML or API JSON into standard RawQuote list."""
        quotes, _ = self.parse_flight_cards(
            html_content=response_data.get("body", ""),
            request=request,
            engine_name="SCRAPY",
            requested_url=response_data.get("url"),
            http_status=response_data.get("http_status", 200),
            return_metrics=True,
        )
        return quotes

    async def run_playwright_flow(
        self,
        page: Any,
        request: SearchRequest,
    ) -> List[RawQuote]:
        """
        Runs browser extraction in Playwright page and returns standard RawQuote list.
        Bounded to max_results (default 10, cap 15).
        """
        raw_max = getattr(request, "max_results", None) or 10
        bounded_max = min(max(1, int(raw_max)), 15)

        # Wait for either flight tuples or search container
        try:
            await page.wait_for_selector(
                ".tuple, .flight-tuple, .flight-item, [class*='flightItem'], [class*='tuple'], .dom2-flight-tuple, #dom2-container",
                timeout=12000,
            )
            # Allow brief moment for React/DOM hydration
            await page.wait_for_timeout(2000)
        except Exception:
            pass

        content = await page.content()
        quotes, _ = self.parse_flight_cards(
            html_content=content,
            request=request,
            engine_name="PLAYWRIGHT",
            requested_url=page.url,
            http_status=200,
            max_results=bounded_max,
            return_metrics=True,
        )
        return quotes

    def parse_flight_cards(
        self,
        html_content: str,
        request: SearchRequest,
        engine_name: str = "SCRAPY",
        requested_url: Optional[str] = None,
        http_status: int = 200,
        max_results: Optional[int] = None,
        return_metrics: bool = False,
    ) -> Tuple[List[RawQuote], Dict[str, Any]]:
        """
        Extracts structured flight observations from Yatra HTML DOM or mock fixtures.
        Bounded to max_results (default 10, cap 15).
        """
        raw_max = max_results or getattr(request, "max_results", 10) or 10
        bounded_max = min(max(1, int(raw_max)), 15)

        metrics = {
            "results_seen": 0,
            "results_matching": 0,
            "results_collected": 0,
            "max_results": bounded_max,
            "stop_reason": StopReason.PAGE_EXHAUSTED.value,
        }

        if not html_content or not html_content.strip():
            metrics["stop_reason"] = StopReason.NO_AVAILABILITY.value
            return ([], metrics)

        # Fast challenge detection check
        lower_content = html_content.lower()
        if "challenge validation" in lower_content or "cp_clge_done" in lower_content or "_sec/verify" in lower_content:
            metrics["stop_reason"] = StopReason.BLOCKED.value
            return ([], metrics)

        soup = BeautifulSoup(html_content, "html.parser")
        quotes: List[RawQuote] = []
        observed_at = datetime.now(timezone.utc).isoformat()
        origin = request.origin.upper()
        destination = request.destination.upper()
        dep_date_str = str(request.departure_date)

        # Candidate element selectors for Yatra flight result cards
        candidates = soup.select(
            ".tuple, .flight-tuple, .tuple-wrap, div[class*='flightItem'], "
            ".flight-item, div[class*='flight-row'], div[class*='tuple'], "
            ".flight-card, tr.flight-item"
        )

        if not candidates:
            # Fallback scan for candidate blocks containing flight keywords and price
            all_blocks = soup.find_all(["div", "li", "tr"])
            candidates = [
                b for b in all_blocks
                if any(c in b.get_text() for c in ["Air India", "IndiGo", "SpiceJet", "Akasa", "6E", "AI", "SG", "QP", "IX"])
                and any(curr in b.get_text() for curr in ["₹", "INR", "Rs"])
                and len(b.get_text()) < 800
            ]

        seen_signatures = set()
        results_seen = 0
        results_matching = 0

        for card in candidates:
            results_seen += 1
            card_text = card.get_text(separator=" ", strip=True)
            if not card_text:
                continue

            # Check price: check total-price specific element first if present
            total_el = card.select_one(".total-price, .totalPrice, [class*='total-price'], [class*='total_price'], [class*='totalFare']")
            price = parse_inr_price(total_el.get_text(strip=True)) if total_el else None
            if not price:
                price = parse_inr_price(card_text)
            if not price or price <= 0:
                continue

            # Airline identification
            airline_name = None
            carrier_code = None
            for code, name in CARRIER_MAP.items():
                if name.lower() in card_text.lower() or f"{code}-" in card_text or f"{code} " in card_text:
                    airline_name = name
                    carrier_code = code
                    break

            # Flight number extraction
            fn_match = _FLIGHT_NO_RE.search(card_text)
            if fn_match:
                carrier_code = fn_match.group(1).upper()
                flight_no = f"{carrier_code}-{fn_match.group(2)}"
                airline_name = CARRIER_MAP.get(carrier_code, airline_name)
            else:
                # Do NOT generate synthetic flight numbers if unobservable
                flight_no = None

            # Times extraction
            times = _TIME_RE.findall(card_text)
            dep_time = f"{times[0][0]}:{times[0][1]}" if len(times) >= 1 else None
            arr_time = f"{times[1][0]}:{times[1][1]}" if len(times) >= 2 else None

            # Stops extraction
            stops_count = None
            text_lower = card_text.lower()
            if any(m in text_lower for m in ("non-stop", "non stop", "0 stop", "direct")):
                stops_count = 0
            elif "1 stop" in text_lower or "1-stop" in text_lower:
                stops_count = 1
            elif "2 stop" in text_lower or "2-stop" in text_lower:
                stops_count = 2
            if request.is_nonstop is True and stops_count != 0:
                continue

            # Cabin
            cabin_str = getattr(request, "cabin", "economy")
            cabin_val = getattr(cabin_str, "value", str(cabin_str)).lower()

            results_matching += 1

            # Deduplication key across extracted page
            sig = (carrier_code, flight_no, dep_time, arr_time, price)
            if sig in seen_signatures:
                continue
            seen_signatures.add(sig)

            # Fare components: Section 15 requires null / incomplete if source exposes only total
            # Attempt to extract explicit base fare or taxes if present
            base_fare = None
            taxes = None
            mandatory_fees = None
            components_complete = False

            base_match = re.search(r"base\s*(?:fare)?\s*[:₹\s]*([0-9,]+)", card_text, re.I)
            if base_match:
                try:
                    b_val = float(base_match.group(1).replace(",", ""))
                    if 0 < b_val < price:
                        base_fare = b_val
                except ValueError:
                    pass

            tax_match = re.search(r"(?:taxes|surcharges|fee)\s*[:₹\s]*([0-9,]+)", card_text, re.I)
            if tax_match:
                try:
                    t_val = float(tax_match.group(1).replace(",", ""))
                    if 0 < t_val < price:
                        taxes = t_val
                except ValueError:
                    pass

            if base_fare is not None and taxes is not None:
                components_complete = abs(price - (base_fare + taxes)) < 0.01

            provenance = {
                "source": "Yatra",
                "engine": engine_name.upper(),
                "engine_version": "1.0.0",
                "observed_at": observed_at,
                "requested_url": requested_url,
                "http_status": http_status,
                "components_complete": components_complete,
                "stops": stops_count,
                "airline_name": airline_name,
                "raw_card": str(card),
                "raw_price_text": total_el.get_text(strip=True) if total_el else card_text,
            }

            quotes.append(
                RawQuote(
                    carrier=carrier_code,
                    flight_number=flight_no,
                    departure_time=dep_time,
                    arrival_time=arr_time,
                    origin=origin,
                    destination=destination,
                    departure_date=dep_date_str,
                    currency="INR",
                    base_price=base_fare,
                    tax_amount=taxes,
                    mandatory_fees=mandatory_fees,
                    gross_total=price,
                    provenance=provenance,
                    cabin_class=cabin_val,
                    fare_class=None,
                    is_non_stop=(stops_count == 0) if stops_count is not None else None,
                )
            )

            # Bounded stopping: stop when limit reached
            if len(quotes) >= bounded_max:
                metrics["stop_reason"] = StopReason.RESULT_LIMIT_REACHED.value
                break

        metrics["results_seen"] = results_seen
        metrics["results_matching"] = results_matching
        metrics["results_collected"] = len(quotes)
        if len(quotes) >= bounded_max:
            metrics["stop_reason"] = StopReason.RESULT_LIMIT_REACHED.value
        elif len(quotes) == 0:
            metrics["stop_reason"] = StopReason.NO_AVAILABILITY.value

        return quotes, metrics
