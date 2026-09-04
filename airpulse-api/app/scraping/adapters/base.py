"""
Source Adapter interface defining engine capabilities and search translations.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.schemas.runs import SearchRequest
from app.scraping.engines.base import RawQuote


class SourceAdapter(ABC):
    """Protocol for sources capable of scraping via Scrapy and/or Playwright."""

    @property
    @abstractmethod
    def source_id(self) -> str:
        """Unique ID or slug for the source."""
        pass

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable display name for the source."""
        pass

    def supports_scrapy(self) -> bool:
        """Whether this source adapter supports HTTP/Scrapy collection."""
        return True

    def supports_playwright(self) -> bool:
        """Whether this source adapter supports Playwright browser collection."""
        return True

    def requires_javascript(self, request: SearchRequest) -> bool:
        """Determines upfront if the source fundamentally requires client-side JS."""
        return False

    def is_js_shell(self, body_text: str, http_status: int) -> bool:
        """
        Positively identifies if an HTTP 200 response is merely an empty client SPA shell
        (e.g. <div id="root"></div>, <app-root></app-root>, Noscript notice) lacking pre-rendered DOM.
        """
        if http_status != 200 or not body_text:
            return False
        lower = body_text.lower()
        has_spa_hook = any(h in lower for h in [
            '<div id="root"></div>',
            '<div id="app"></div>',
            '<div id="__next"></div>',
            '<app-root></app-root>',
            'you need to enable javascript to run this app',
            'javascript is disabled in your browser',
        ])
        return has_spa_hook

    def is_empty_availability(self, body_text: str, http_status: int) -> bool:
        """Identifies explicit no-flight availability message in response."""
        lower = body_text.lower()
        empty_markers = [
            "no flights found",
            "no flights available",
            "no direct or connecting flights",
            "sold out",
            "no seats available",
        ]
        return any(m in lower for m in empty_markers)

    @abstractmethod
    def build_url(self, request: SearchRequest) -> str:
        """Builds target URL for the search request."""
        pass

    def build_scrapy_request(self, request: SearchRequest) -> Dict[str, Any]:
        """Constructs Scrapy request specification."""
        return {
            "url": self.build_url(request),
            "method": "GET",
            "headers": {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            "cookies": {},
            "body": None,
        }

    @abstractmethod
    def parse_scrapy_response(
        self,
        response_data: Dict[str, Any],
        request: SearchRequest,
    ) -> List[RawQuote]:
        """Parses server-rendered HTML or API JSON into standard RawQuote list."""
        pass

    async def run_playwright_flow(
        self,
        page: Any,
        request: SearchRequest,
    ) -> List[RawQuote]:
        """Runs browser extraction in Playwright page and returns standard RawQuote list."""
        raise NotImplementedError("Playwright flow not implemented for this adapter.")
