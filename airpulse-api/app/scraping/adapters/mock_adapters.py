"""
Standard Acceptance Test Adapters for AirPulse dual-engine architecture:
- StaticSourceAdapter (supports Scrapy + Playwright, server-rendered fares, AUTO -> Scrapy)
- JsSourceAdapter (requires JavaScript, returns SPA shell on HTTP, AUTO -> Playwright)
- BlockedSourceAdapter (returns 403 Forbidden, AUTO -> BLOCKED, never bypasses)
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import RawQuote
from app.scraping.parsers import parse_flight_cards_html


class StaticSourceAdapter(SourceAdapter):
    """
    Acceptance test adapter for a static server-rendered HTML portal.
    Supports both Scrapy and Playwright; contains actual fares in HTML.
    AUTO must choose Scrapy.
    """

    @property
    def source_id(self) -> str:
        return "test_static_source"

    @property
    def source_name(self) -> str:
        return "Static Airline Portal"

    def supports_scrapy(self) -> bool:
        return True

    def supports_playwright(self) -> bool:
        return True

    def requires_javascript(self, request: SearchRequest) -> bool:
        return False

    def build_url(self, request: SearchRequest) -> str:
        return f"https://mock-static.airpulse.local/search?from={request.origin}&to={request.destination}&date={request.departure_date}"

    def parse_scrapy_response(
        self,
        response_data: Dict[str, Any],
        request: SearchRequest,
    ) -> List[RawQuote]:
        html = response_data.get("body", "")
        if not html:
            # Provide standard test fixture if body was mocked empty
            html = f"""
            <html>
                <body>
                    <div class="flight-card">
                        <span class="carrier">IndiGo</span>
                        <span class="flight-no">6E-205</span>
                        <span class="times">06:00 - 08:15</span>
                        <span class="fare">₹5,420</span>
                    </div>
                    <div class="flight-card">
                        <span class="carrier">Air India</span>
                        <span class="flight-no">AI-102</span>
                        <span class="times">09:30 - 11:45</span>
                        <span class="fare">₹6,850</span>
                    </div>
                </body>
            </html>
            """
        return parse_flight_cards_html(
            html_content=html,
            origin=request.origin,
            destination=request.destination,
            departure_date=str(request.departure_date),
            source_name=self.source_name,
            engine_name="SCRAPY",
            http_status=response_data.get("http_status", 200),
        )


class JsSourceAdapter(SourceAdapter):
    """
    Acceptance test adapter for a client-side SPA portal.
    Requires JavaScript; HTTP GET returns an empty SPA root shell.
    AUTO must choose or escalate to Playwright.
    """

    @property
    def source_id(self) -> str:
        return "test_js_source"

    @property
    def source_name(self) -> str:
        return "Dynamic Single Page App Portal"

    def supports_scrapy(self) -> bool:
        return True

    def supports_playwright(self) -> bool:
        return True

    def requires_javascript(self, request: SearchRequest) -> bool:
        return True

    def is_js_shell(self, body_text: str, http_status: int) -> bool:
        return True

    def build_url(self, request: SearchRequest) -> str:
        return f"https://mock-spa.airpulse.local/app/search/{request.origin}/{request.destination}/{request.departure_date}"

    def parse_scrapy_response(
        self,
        response_data: Dict[str, Any],
        request: SearchRequest,
    ) -> List[RawQuote]:
        # Empty shell returns no quotes because JS execution is mandatory
        return []

    async def run_playwright_flow(
        self,
        page: Any,
        request: SearchRequest,
    ) -> List[RawQuote]:
        # Simulate extracted DOM cards after JS hydration
        return [
            RawQuote(
                carrier="AI",
                flight_number="AI-505",
                departure_time="14:00",
                arrival_time="16:10",
                origin=request.origin.upper(),
                destination=request.destination.upper(),
                departure_date=str(request.departure_date),
                currency="INR",
                base_price=5100.0,
                tax_amount=612.0,
                mandatory_fees=188.0,
                gross_total=5900.0,
                provenance={
                    "engine": "PLAYWRIGHT",
                    "engine_version": "1.0.0",
                    "source": self.source_name,
                    "observed_at": "2026-09-04T18:00:00Z",
                },
            )
        ]


class BlockedSourceAdapter(SourceAdapter):
    """
    Acceptance test adapter for a source that returns 403 Forbidden or CAPTCHA.
    AUTO must stop with BLOCKED / CAPTCHA_DETECTED and NEVER launch Playwright.
    """

    @property
    def source_id(self) -> str:
        return "test_blocked_source"

    @property
    def source_name(self) -> str:
        return "CDN Protected Source"

    def supports_scrapy(self) -> bool:
        return True

    def supports_playwright(self) -> bool:
        return True

    def requires_javascript(self, request: SearchRequest) -> bool:
        return False

    def build_url(self, request: SearchRequest) -> str:
        return f"https://mock-blocked.airpulse.local/api/fares"

    def parse_scrapy_response(
        self,
        response_data: Dict[str, Any],
        request: SearchRequest,
    ) -> List[RawQuote]:
        return []
