"""
Playwright-based live collector for dynamic Indian airline portals.

Design
------
* **Config-driven selectors.** All DOM selectors and URL templates live in
  ``app/collectors/config/airline_selectors.json`` (the single maintenance point).
  Airline sites change their markup often; update the JSON, not this code.
* **Precise failure diagnostics.** Every failure raises ``ScraperError`` with the exact
  ``ScrapeFailureStage`` (DNS/CONNECTION/TIMEOUT/HTTP/BLOCKED/CAPTCHA/EMPTY/
  SELECTOR_NOT_FOUND/PARSE/NO_AVAILABILITY/...). It NEVER silently falls back to replay
  or synthetic data — the scraping-test workflow depends on truthful stages.
* **Ethical scraping.** Authoritative User-Agent, bounded navigation/selector timeouts,
  per-source rate limiting, and resource blocking (images/fonts/media) to reduce load.
  NO anti-bot evasion, NO CAPTCHA solving, NO auth circumvention — if a portal blocks or
  shows a CAPTCHA, we record BLOCKED/CAPTCHA_DETECTED and stop.
* **Optional dependency.** Playwright is imported lazily; if it is not installed the
  collector reports ``BROWSER_LAUNCH_FAILURE`` cleanly instead of crashing the app.

Enabling live collection: set ``"enabled": true`` for the airline in the selector config
AND install Playwright (``pip install playwright`` + ``playwright install chromium``).
Until then every airline is ``enabled: false`` and reports ``NOT_CONFIGURED``.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.collectors.base import BaseCollector
from app.core.enums import ScrapeFailureStage
from app.core.exceptions import ScraperError
from app.schemas.runs import SearchRequest

_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "airline_selectors.json")

# Cabin value -> portal query token (portals differ; kept simple/overridable).
_CABIN_TOKENS = {
    "economy": "Economy",
    "premium_economy": "PremiumEconomy",
    "business": "Business",
    "first": "First",
}

_MONEY_RE = re.compile(r"[\d,]+(?:\.\d+)?")


def _load_config() -> Dict[str, Any]:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _parse_money(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    match = _MONEY_RE.search(text.replace("\u20b9", "").replace("Rs", ""))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


class PlaywrightCollector(BaseCollector):
    """Generic, config-driven live airline collector. One instance per airline key."""

    def __init__(
        self,
        source_id: str,
        airline_key: str,
        source_name: Optional[str] = None,
        rate_limit_per_minute: int = 60,
        timeout_seconds: int = 30,
        max_retries: int = 3,
        config: Optional[Dict[str, Any]] = None,
    ):
        cfg = config or _load_config()
        self._defaults = cfg.get("defaults", {})
        self._airline_cfg = cfg.get("airlines", {}).get(airline_key)
        display = (self._airline_cfg or {}).get("display_name", airline_key)
        super().__init__(
            source_id=source_id,
            source_name=source_name or display,
            collector_version="1.0.0-playwright",
            rate_limit_per_minute=rate_limit_per_minute,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
        )
        self.airline_key = airline_key
        self._last_request_ts: float = 0.0

    # -- config helpers -----------------------------------------------------
    @property
    def carrier_code(self) -> Optional[str]:
        return (self._airline_cfg or {}).get("carrier_code")

    @property
    def is_configured(self) -> bool:
        return bool(self._airline_cfg) and bool(self._airline_cfg.get("enabled"))

    def _selectors(self) -> Dict[str, str]:
        return (self._airline_cfg or {}).get("selectors", {})

    def _default(self, key: str, fallback: Any) -> Any:
        return self._defaults.get(key, fallback)

    async def _respect_rate_limit(self) -> None:
        """Ethical rate limiting: space requests by 60 / rate_limit_per_minute seconds."""
        if self.rate_limit_per_minute <= 0:
            return
        min_gap = 60.0 / float(self.rate_limit_per_minute)
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < min_gap:
            await asyncio.sleep(min_gap - elapsed)
        self._last_request_ts = time.monotonic()

    def _build_url(self, req: SearchRequest) -> str:
        template = self._airline_cfg.get("search_url_template", "")
        cabin_token = _CABIN_TOKENS.get(getattr(req.cabin, "value", "economy"), "Economy")
        return template.format(
            origin=req.origin.upper(),
            destination=req.destination.upper(),
            departure_date=req.departure_date.isoformat(),
            adults=req.passengers,
            cabin=cabin_token,
        )

    # -- diagnostic detection ----------------------------------------------
    def _detect_block_or_captcha(self, page_text_lower: str) -> None:
        for marker in self._default("captcha_markers", []):
            if marker in page_text_lower:
                raise ScraperError(ScrapeFailureStage.CAPTCHA_DETECTED, f"CAPTCHA marker detected: '{marker}'")
        for marker in self._default("blocked_markers", []):
            if marker in page_text_lower:
                raise ScraperError(ScrapeFailureStage.BLOCKED, f"Blocked marker detected: '{marker}'")

    def _detect_empty(self, page_text_lower: str) -> None:
        for marker in self._default("empty_markers", []):
            if marker in page_text_lower:
                raise ScraperError(ScrapeFailureStage.NO_AVAILABILITY, f"No availability: '{marker}'")

    # -- main collect -------------------------------------------------------
    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        """
        Perform a live scrape. Raises ScraperError with a precise stage on any failure.
        Returns a list of raw vendor payload dicts (pre-validation) on success.
        """
        if not self._airline_cfg:
            raise ScraperError(
                ScrapeFailureStage.NOT_CONFIGURED,
                f"No selector config for airline '{self.airline_key}'.",
            )
        if not self._airline_cfg.get("enabled"):
            raise ScraperError(
                ScrapeFailureStage.NOT_CONFIGURED,
                f"Live collection disabled for '{self.airline_key}'. Enable it in "
                f"airline_selectors.json and install Playwright to activate.",
            )

        from app.services.browser_service import get_shared_browser_service

        await self._respect_rate_limit()

        url = self._build_url(search_request)
        sel = self._selectors()
        nav_timeout = int(self._default("nav_timeout_ms", 30000))
        sel_timeout = int(self._default("selector_timeout_ms", 15000))
        wait_until = self._default("wait_until", "networkidle")

        browser_service = get_shared_browser_service()
        page = None
        try:
            page, context = await browser_service.create_isolated_page(
                source_key=self.airline_key,
                block_heavy_resources=True,
            )

            # Navigate with safe timeout and DNS/connection classification
            http_status, title, body_text = await browser_service.navigate_safely(
                page, url, nav_timeout_ms=nav_timeout, wait_until=wait_until
            )

            if not body_text.strip():
                raise ScraperError(ScrapeFailureStage.EMPTY_RESPONSE, "Empty page body.")

            # Generic security challenge & block detection
            challenge_res = await browser_service.check_for_challenges(
                page, http_status, title, body_text
            )
            if challenge_res.detected:
                stage = challenge_res.stage or ScrapeFailureStage.BLOCKED
                raise ScraperError(
                    stage,
                    challenge_res.reason or "Security challenge detected on carrier portal.",
                    http_status=http_status,
                )

            # Wait for results container if specified
            container_sel = sel.get("results_container")
            try:
                if container_sel:
                    await page.wait_for_selector(container_sel, timeout=sel_timeout)
            except Exception as exc:
                self._detect_empty(body_text.lower())
                raise ScraperError(
                    ScrapeFailureStage.SELECTOR_NOT_FOUND,
                    f"Results container selector not found: '{container_sel}'. "
                    f"The portal DOM likely changed — update airline_selectors.json.",
                ) from exc

            row_sel = sel.get("flight_row")
            rows = await page.query_selector_all(row_sel) if row_sel else []
            if not rows:
                self._detect_empty(body_text.lower())
                raise ScraperError(
                    ScrapeFailureStage.SELECTOR_NOT_FOUND,
                    f"Flight row selector matched 0 elements: '{row_sel}'. Update selectors.",
                )

            quotes: List[Dict[str, Any]] = []
            for row in rows:
                try:
                    quote = await self._extract_row(row, sel, search_request, http_status)
                    if quote:
                        quotes.append(quote)
                except Exception:
                    continue

            if not quotes:
                raise ScraperError(
                    ScrapeFailureStage.PARSE_ERROR,
                    "Matched flight rows but could not parse any fare. Update selectors.",
                )

            return quotes
        except ScraperError:
            raise
        except Exception as exc:
            raise ScraperError(ScrapeFailureStage.PARSE_ERROR, f"Unexpected scrape error: {exc}") from exc
        finally:
            if page is not None:
                try:
                    await page.close()
                except Exception:
                    pass

    async def _extract_row(
        self,
        row,
        sel: Dict[str, str],
        req: SearchRequest,
        http_status: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        async def _text(selector_key: str) -> Optional[str]:
            selector = sel.get(selector_key)
            if not selector:
                return None
            el = await row.query_selector(selector)
            if not el:
                return None
            return (await el.inner_text()).strip()

        flight_no = await _text("flight_number")
        total_text = await _text("total_fare")
        base_text = await _text("base_fare")

        total = _parse_money(total_text)
        base = _parse_money(base_text)
        if total is None and base is None:
            return None
        if total is None:
            total = base
        if base is None:
            base = round(total / 1.12, 2)  # infer base from typical 12% tax component

        taxes = round(max(total - base, 0.0), 2)
        dep_time = await _text("departure_time")
        arr_time = await _text("arrival_time")
        cabin_label = await _text("cabin_label")

        return {
            "source": self.source_name,
            "carrier": self.carrier_code,
            "airline_name": self.source_name,
            "flight_no": flight_no or (f"{self.carrier_code}-LIVE" if self.carrier_code else "LIVE"),
            "src": req.origin.upper(),
            "dst": req.destination.upper(),
            "departure_iso": self._compose_iso(req, dep_time),
            "arrival_iso": self._compose_iso(req, arr_time),
            "booking_window": req.booking_window_days,
            "cabin": cabin_label or getattr(req.cabin, "value", "economy"),
            "base_price": base,
            "tax_amount": taxes,
            "mandatory_fees": 0.0,
            "gross_total": total,
            "currency_code": "INR",
            "free_baggage_kg": 15.0,
            "_live_metadata": {
                "http_status": http_status,
                "raw_total_text": total_text,
                "raw_base_text": base_text,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    def _compose_iso(self, req: SearchRequest, hhmm: Optional[str]) -> str:
        """Compose a departure/arrival ISO timestamp from the search date + a HH:MM label."""
        d = req.departure_date
        hour, minute = 6, 0
        if hhmm:
            m = re.search(r"(\d{1,2}):(\d{2})", hhmm)
            if m:
                hour, minute = int(m.group(1)), int(m.group(2))
        return datetime(d.year, d.month, d.day, hour, minute, tzinfo=timezone.utc).isoformat()

    def parse(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "carrier": raw_payload.get("carrier"),
            "flight_no": raw_payload.get("flight_no"),
            "src": raw_payload.get("src"),
            "dst": raw_payload.get("dst"),
            "departure_iso": raw_payload.get("departure_iso"),
            "arrival_iso": raw_payload.get("arrival_iso"),
            "base_price": raw_payload.get("base_price"),
            "tax_amount": raw_payload.get("tax_amount"),
            "mandatory_fees": raw_payload.get("mandatory_fees"),
            "gross_total": raw_payload.get("gross_total"),
            "currency_code": raw_payload.get("currency_code", "INR"),
            "free_baggage_kg": raw_payload.get("free_baggage_kg", 15.0),
        }

    async def health_check(self) -> Dict[str, Any]:
        """Report readiness. Does not perform a full scrape — only checks configuration
        and reachability of the base URL where possible."""
        if not self.is_configured:
            return {
                "source_id": self.source_id,
                "source_name": self.source_name,
                "status": "disabled",
                "latency_ms": None,
                "error": "Live collection not enabled in airline_selectors.json",
            }
        # Lightweight reachability probe using httpx (no browser needed).
        import httpx

        base = self._airline_cfg.get("base_url")
        start = time.time()
        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": self._default("user_agent", "AirPulse/1.0")},
                timeout=8.0,
                follow_redirects=True,
            ) as client:
                resp = await client.get(base)
                latency = int((time.time() - start) * 1000)
                return {
                    "source_id": self.source_id,
                    "source_name": self.source_name,
                    "status": "healthy" if resp.status_code < 400 else "degraded",
                    "latency_ms": latency,
                    "error": None if resp.status_code < 400 else f"HTTP {resp.status_code}",
                }
        except Exception as exc:
            return {
                "source_id": self.source_id,
                "source_name": self.source_name,
                "status": "failed",
                "latency_ms": None,
                "error": str(exc),
            }
