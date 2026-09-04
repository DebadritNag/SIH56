"""
Unified Shared Browser Service for AirPulse Live Scraping Engine.

Features:
- Single reusable Playwright + Chromium browser lifecycle abstraction.
- Isolated BrowserContext per source key (cookie isolation, session timestamps, expiry).
- Safe ethical resource reduction: blocks images, fonts, and media, while never
  blocking documents, JavaScript, or XHR/fetch.
- Centralized authoritative User-Agent (zero random spoofing).
- Generic security challenge / anti-bot detector (CAPTCHA, 403/429, Akamai,
  Cloudflare, PerimeterX). Pure detection only; zero bypass/evasion.
- Cryptographic evidence capture: HTML snapshot, failure screenshot, and SHA-256 hashing.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.enums import ScrapeFailureStage
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)

# Centralized Authoritative User-Agent (Zero Impersonation)
DEFAULT_USER_AGENT = (
    "AirPulse-Price-Intelligence/1.0 (+https://airpulse.gov.in/bot; MoSPI-CPI-Augmentation)"
)
STANDARD_BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Safe resource reduction: block heavy non-essential assets to save bandwidth.
# CRITICAL: NEVER block "document", "script", "xhr", "fetch".
SAFE_BLOCKED_RESOURCE_TYPES: Set[str] = {"image", "font", "media"}

# Challenge & Blocking Detection Marker Dictionaries
CAPTCHA_MARKERS = [
    "g-recaptcha",
    "recaptcha",
    "cf-turnstile",
    "hcaptcha-box",
    "geetest",
    "arkoselabs",
    "funcaptcha",
    "verify you are human",
    "are you a robot",
    "security verification",
    "bot verification",
    "please complete the security check",
]

BLOCKED_MARKERS = [
    "access denied",
    "request blocked",
    "forbidden",
    "permission denied",
    "unusual traffic from your computer network",
    "client blocked",
]

RATE_LIMITED_MARKERS = [
    "too many requests",
    "rate limit exceeded",
    "request limit reached",
    "slow down",
]

CHALLENGE_MARKERS = [
    "checking your browser",
    "just a moment...",
    "cf-browser-verification",
    "ddos protection by cloudflare",
    "security check to access",
    "perimeterx",
    "px-captcha",
    "shieldsquare",
    "akamai ghost",
    "reference #18.",
]

AUTH_REQUIRED_MARKERS = [
    "authentication required",
    "please log in to continue",
    "sign in required",
    "session expired",
]


@dataclass
class BrowserSession:
    source_key: str
    context: Any
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    request_count: int = 0


@dataclass
class ChallengeDetectionResult:
    detected: bool
    stage: Optional[ScrapeFailureStage] = None
    reason: Optional[str] = None
    marker: Optional[str] = None
    detector_name: Optional[str] = None


@dataclass
class AuditEvidence:
    response_hash: str
    html_snapshot: str
    screenshot_bytes: Optional[bytes] = None
    page_title: str = ""
    http_status: Optional[int] = None
    captured_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChallengeDetector:
    """Detects security challenges, CAPTCHAs, rate-limits, and CDN blocks without evading."""

    @classmethod
    def detect(
        cls,
        page_text: str,
        http_status: Optional[int] = None,
        title: str = "",
    ) -> ChallengeDetectionResult:
        lowered_text = (page_text or "").lower()
        lowered_title = (title or "").lower()
        full_content = f"{lowered_title} {lowered_text}"

        # 1. HTTP Status Code Checks
        if http_status == 429:
            return ChallengeDetectionResult(
                detected=True,
                stage=ScrapeFailureStage.RATE_LIMITED,
                reason="HTTP 429 Too Many Requests",
                detector_name="http_status_code",
            )
        if http_status == 403:
            # Check if 403 is specifically a CDN challenge or general block
            for marker in CHALLENGE_MARKERS:
                if marker in full_content:
                    return ChallengeDetectionResult(
                        detected=True,
                        stage=ScrapeFailureStage.CHALLENGE_DETECTED,
                        reason=f"CDN Security Challenge (HTTP 403 with '{marker}')",
                        marker=marker,
                        detector_name="cdn_challenge_detector",
                    )
            return ChallengeDetectionResult(
                detected=True,
                stage=ScrapeFailureStage.BLOCKED,
                reason="HTTP 403 Forbidden / Access Denied",
                detector_name="http_status_code",
            )
        if http_status == 401:
            return ChallengeDetectionResult(
                detected=True,
                stage=ScrapeFailureStage.AUTH_REQUIRED,
                reason="HTTP 401 Unauthorized",
                detector_name="http_status_code",
            )

        # 2. Content-Based CAPTCHA Detection
        for marker in CAPTCHA_MARKERS:
            if marker in full_content:
                return ChallengeDetectionResult(
                    detected=True,
                    stage=ScrapeFailureStage.CAPTCHA_DETECTED,
                    reason=f"CAPTCHA detected: '{marker}'",
                    marker=marker,
                    detector_name="captcha_marker_detector",
                )

        # 3. Content-Based CDN Challenge Detection (Cloudflare, Akamai, PerimeterX)
        for marker in CHALLENGE_MARKERS:
            if marker in full_content:
                return ChallengeDetectionResult(
                    detected=True,
                    stage=ScrapeFailureStage.CHALLENGE_DETECTED,
                    reason=f"Security challenge page detected: '{marker}'",
                    marker=marker,
                    detector_name="cdn_challenge_detector",
                )

        # 4. Content-Based Rate Limiting Detection
        for marker in RATE_LIMITED_MARKERS:
            if marker in full_content:
                return ChallengeDetectionResult(
                    detected=True,
                    stage=ScrapeFailureStage.RATE_LIMITED,
                    reason=f"Rate limit marker detected: '{marker}'",
                    marker=marker,
                    detector_name="rate_limit_marker_detector",
                )

        # 5. Content-Based General Block Detection
        for marker in BLOCKED_MARKERS:
            if marker in full_content:
                return ChallengeDetectionResult(
                    detected=True,
                    stage=ScrapeFailureStage.BLOCKED,
                    reason=f"Access blocked marker detected: '{marker}'",
                    marker=marker,
                    detector_name="access_blocked_detector",
                )

        # 6. Content-Based Auth Required Detection
        for marker in AUTH_REQUIRED_MARKERS:
            if marker in full_content:
                return ChallengeDetectionResult(
                    detected=True,
                    stage=ScrapeFailureStage.AUTH_REQUIRED,
                    reason=f"Authentication required marker detected: '{marker}'",
                    marker=marker,
                    detector_name="auth_required_detector",
                )

        return ChallengeDetectionResult(detected=False)


class SharedBrowserService:
    """Singleton-style asynchronous browser lifecycle and context manager for AirPulse."""

    _instance: Optional[SharedBrowserService] = None

    def __init__(self, user_agent: str = STANDARD_BROWSER_USER_AGENT):
        self.user_agent = user_agent
        self._pw: Optional[Any] = None
        self._browser: Optional[Any] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._sessions: Dict[str, BrowserSession] = {}
        self._lock: Optional[asyncio.Lock] = None
        self.session_timeout_seconds = 1800.0  # 30-minute context expiry

    @classmethod
    def get_instance(cls) -> SharedBrowserService:
        if cls._instance is None:
            cls._instance = SharedBrowserService()
        return cls._instance

    def _get_lock(self) -> asyncio.Lock:
        current_loop = asyncio.get_running_loop()
        if self._lock is None or self._loop != current_loop:
            self._lock = asyncio.Lock()
        return self._lock

    async def _ensure_browser(self) -> Any:
        current_loop = asyncio.get_running_loop()
        if self._browser is not None and self._loop == current_loop:
            try:
                if self._browser.is_connected():
                    return self._browser
            except Exception:
                pass

        # Event loop changed or browser disconnected: clean reset
        self._sessions.clear()
        self._browser = None
        self._pw = None
        self._loop = current_loop

        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise ScraperError(
                ScrapeFailureStage.BROWSER_LAUNCH_FAILURE,
                "Playwright is not installed in the environment.",
            ) from exc

        try:
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            logger.info("Chromium launched successfully in headless mode.")
            return self._browser
        except Exception as exc:
            msg = str(exc)
            if "Executable doesn't exist" in msg or "playwright install" in msg:
                clean_msg = (
                    "Chromium executable not found in container (/root/.cache/ms-playwright). "
                    "Run 'playwright install chromium' to install browser binaries. "
                    "On free-tier hosting (512MB RAM cap), select an OTA/HTTP source."
                )
                raise ScraperError(
                    ScrapeFailureStage.BROWSER_LAUNCH_FAILURE,
                    clean_msg,
                ) from exc
            raise ScraperError(
                ScrapeFailureStage.BROWSER_LAUNCH_FAILURE,
                f"Failed to launch Chromium: {exc}",
            ) from exc

    async def get_or_create_context(self, source_key: str) -> Any:
        """Retrieves or creates an isolated BrowserContext for a specific source."""
        async with self._get_lock():
            browser = await self._ensure_browser()

            now = time.time()
            session = self._sessions.get(source_key)
            if session:
                # Check for context expiry
                if now - session.created_at > self.session_timeout_seconds:
                    logger.info(f"Session for source {source_key} expired; recreating.")
                    try:
                        await session.context.close()
                    except Exception:
                        pass
                    session = None

            if session is None:
                context = await browser.new_context(
                    user_agent=self.user_agent,
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                )
                session = BrowserSession(source_key=source_key, context=context)
                self._sessions[source_key] = session
            else:
                session.last_used_at = now

            session.request_count += 1
            return session.context

    async def create_isolated_page(
        self,
        source_key: str,
        block_heavy_resources: bool = True,
    ) -> Tuple[Any, Any]:
        """Creates a page within the source's isolated context and attaches safe resource blocking."""
        context = await self.get_or_create_context(source_key)
        page = await context.new_page()

        if block_heavy_resources:
            async def _route_handler(route):
                req = route.request
                if req.resource_type in SAFE_BLOCKED_RESOURCE_TYPES:
                    await route.abort()
                else:
                    await route.continue_()

            await page.route("**/*", _route_handler)

        return page, context

    async def navigate_safely(
        self,
        page: Any,
        url: str,
        nav_timeout_ms: int = 30000,
        wait_until: str = "domcontentloaded",
    ) -> Tuple[Optional[int], str, str]:
        """Navigates to URL and returns (http_status, page_title, page_content)."""
        try:
            from playwright.async_api import TimeoutError as PlaywrightTimeoutError
        except ImportError:
            PlaywrightTimeoutError = TimeoutError

        response = None
        try:
            response = await page.goto(url, wait_until=wait_until, timeout=nav_timeout_ms)
        except PlaywrightTimeoutError as exc:
            raise ScraperError(
                ScrapeFailureStage.TIMEOUT,
                f"Navigation timed out after {nav_timeout_ms}ms to {url}",
            ) from exc
        except Exception as exc:
            msg = str(exc).lower()
            if "err_name_not_resolved" in msg or "dns" in msg:
                raise ScraperError(ScrapeFailureStage.DNS_FAILURE, f"DNS resolution failed: {exc}") from exc
            if "err_connection" in msg or "econnrefused" in msg:
                raise ScraperError(
                    ScrapeFailureStage.CONNECTION_FAILURE, f"TCP connection failed: {exc}"
                ) from exc
            raise ScraperError(ScrapeFailureStage.CONNECTION_FAILURE, f"Navigation failed: {exc}") from exc

        http_status = response.status if response else None
        title = await page.title()
        content = await page.content() or ""
        return http_status, title, content

    async def check_for_challenges(
        self,
        page: Any,
        http_status: Optional[int],
        title: str,
        content: str,
    ) -> ChallengeDetectionResult:
        """Runs the generic challenge detector on current page state."""
        # Prefer visible rendered body text over raw HTML to avoid false positives on minified JS bundles
        check_text = content
        if page:
            try:
                body_text = await page.inner_text("body")
                if body_text and len(body_text.strip()) > 20:
                    check_text = body_text
            except Exception:
                pass
        return ChallengeDetector.detect(page_text=check_text, http_status=http_status, title=title)

    async def capture_audit_evidence(
        self,
        page: Any,
        http_status: Optional[int] = None,
        capture_screenshot: bool = True,
    ) -> AuditEvidence:
        """Captures HTML snapshot, calculates cryptographic SHA-256 hash, and takes screenshot."""
        title = ""
        html = ""
        try:
            title = await page.title()
            html = await page.content() or ""
        except Exception:
            pass

        # Compute SHA-256 over exact UTF-8 encoded DOM snapshot
        response_hash = hashlib.sha256(html.encode("utf-8", errors="replace")).hexdigest()

        screenshot_bytes: Optional[bytes] = None
        if capture_screenshot:
            try:
                screenshot_bytes = await page.screenshot(type="png", full_page=False)
            except Exception as exc:
                logger.warning(f"Screenshot capture failed or skipped: {exc}")

        return AuditEvidence(
            response_hash=response_hash,
            html_snapshot=html,
            screenshot_bytes=screenshot_bytes,
            page_title=title,
            http_status=http_status,
        )

    async def reset_session(self, source_key: str) -> None:
        """Closes and removes the session context for a specific source."""
        async with self._get_lock():
            session = self._sessions.pop(source_key, None)
            if session:
                try:
                    await session.context.close()
                except Exception:
                    pass

    async def close_all(self) -> None:
        """Gracefully shuts down all active sessions, browser, and Playwright driver."""
        async with self._get_lock():
            for s in self._sessions.values():
                try:
                    await s.context.close()
                except Exception:
                    pass
            self._sessions.clear()

            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
                self._browser = None

            if self._pw:
                try:
                    await self._pw.stop()
                except Exception:
                    pass
                self._pw = None
            logger.info("SharedBrowserService shut down cleanly.")


def get_shared_browser_service() -> SharedBrowserService:
    return SharedBrowserService.get_instance()
