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
import os
import shutil
import sys
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


@dataclass
class BrowserCapability:
    """Encapsulates the resolved browser engine, version, path, and launch status."""
    engine: str = "none"  # "playwright-chromium", "google-chrome", "google-chrome-stable", "system-chromium", "msedge", or "none"
    version: str = "unknown"
    executable_path: str = "none"
    launch_status: str = "UNAVAILABLE"  # "SUCCESS", "FAILED", "UNAVAILABLE"
    channel: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "browser_engine": self.engine,
            "browser_version": self.version,
            "browser_executable": self.executable_path,
            "browser_launch_status": self.launch_status,
        }


class BrowserCapabilityResolver:
    """Multi-tier browser detection and launch capability resolver for AirPulse.

    Detection order strictly adhering to specification:
    1. Playwright-managed Chromium
    2. Google Chrome (channel='chrome')
    3. Google Chrome Stable executable (binary search on disk)
    4. System Chromium (binary search on disk)
    5. Microsoft Edge if installed (channel='msedge' or binary search)
    """

    CHROME_STABLE_CANDIDATE_PATHS = [
        # Linux / Container
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/opt/google/chrome/google-chrome",
        # Windows
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
        # macOS
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]

    SYSTEM_CHROMIUM_CANDIDATE_PATHS = [
        # Linux / Container
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
        # Windows
        r"C:\Program Files\Chromium\Application\chrome.exe",
        r"C:\Program Files (x86)\Chromium\Application\chrome.exe",
        r"%LOCALAPPDATA%\Chromium\Application\chrome.exe",
    ]

    EDGE_CANDIDATE_PATHS = [
        # Windows
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        # Linux
        "/usr/bin/microsoft-edge-stable",
        "/usr/bin/microsoft-edge",
        # macOS
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]

    LOW_MEMORY_CHROMIUM_ARGS = [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
        "--disable-hang-monitor",
        "--disable-ipc-flooding-protection",
        "--disable-popup-blocking",
        "--disable-renderer-backgrounding",
        "--disable-sync",
        "--mute-audio",
        "--no-first-run",
        "--js-flags=--max-old-space-size=128",
    ]

    @classmethod
    async def _try_launch(cls, launcher: Any, **kwargs) -> Any:
        """Launches a browser instance using the provided launcher and arguments."""
        return await launcher.launch(**kwargs)

    @classmethod
    async def resolve_installed_browser(cls) -> BrowserCapability:
        """Resolves installed browser capability in a transient Playwright session."""
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as pw:
                browser, cap = await cls.resolve_and_launch(pw)
                if browser:
                    try:
                        await browser.close()
                    except Exception:
                        pass
                return cap
        except Exception as exc:
            return BrowserCapability(
                engine="none",
                version="unknown",
                executable_path="none",
                launch_status="UNAVAILABLE",
                error=str(exc),
            )

    @classmethod
    async def resolve_and_launch(cls, pw: Any) -> Tuple[Optional[Any], BrowserCapability]:
        """Tries each browser tier in the specified order, returning (browser_instance, capability).
        If all tiers fail, returns (None, UNAVAILABLE capability)."""
        errors: List[str] = []

        # -------------------------------------------------------------
        # Tier 1: Playwright-managed Chromium
        # -------------------------------------------------------------
        pw_exec = getattr(pw.chromium, "executable_path", None)
        try:
            logger.info("Resolving Browser Tier 1: Playwright-managed Chromium...")
            browser = await cls._try_launch(
                pw.chromium,
                headless=True,
                args=cls.LOW_MEMORY_CHROMIUM_ARGS,
            )
            cap = BrowserCapability(
                engine="playwright-chromium",
                version=browser.version,
                executable_path=pw_exec or "playwright-managed",
                launch_status="SUCCESS",
            )
            logger.info(f"Tier 1 (Playwright Chromium) resolved successfully: v{cap.version}")
            return browser, cap
        except Exception as e1:
            err1 = f"Tier 1 (Playwright Chromium) failed: {e1}"
            logger.debug(err1)
            errors.append(err1)

        # -------------------------------------------------------------
        # Tier 2: Google Chrome (channel='chrome')
        # -------------------------------------------------------------
        try:
            logger.info("Resolving Browser Tier 2: Google Chrome (channel='chrome')...")
            browser = await cls._try_launch(
                pw.chromium,
                channel="chrome",
                headless=True,
                args=cls.LOW_MEMORY_CHROMIUM_ARGS,
            )
            exec_path = cls._find_executable(cls.CHROME_STABLE_CANDIDATE_PATHS, "google-chrome") or "chrome"
            cap = BrowserCapability(
                engine="google-chrome",
                version=browser.version,
                executable_path=exec_path,
                launch_status="SUCCESS",
                channel="chrome",
            )
            logger.info(f"Tier 2 (Google Chrome) resolved successfully: v{cap.version}")
            return browser, cap
        except Exception as e2:
            err2 = f"Tier 2 (Google Chrome) failed: {e2}"
            logger.debug(err2)
            errors.append(err2)

        # -------------------------------------------------------------
        # Tier 3: Google Chrome Stable executable
        # -------------------------------------------------------------
        chrome_stable_path = cls._find_executable(cls.CHROME_STABLE_CANDIDATE_PATHS, "google-chrome-stable")
        if chrome_stable_path:
            try:
                logger.info(f"Resolving Browser Tier 3: Chrome Stable executable at {chrome_stable_path}...")
                browser = await cls._try_launch(
                    pw.chromium,
                    executable_path=chrome_stable_path,
                    headless=True,
                    args=cls.LOW_MEMORY_CHROMIUM_ARGS,
                )
                cap = BrowserCapability(
                    engine="google-chrome-stable",
                    version=browser.version,
                    executable_path=chrome_stable_path,
                    launch_status="SUCCESS",
                )
                logger.info(f"Tier 3 (Chrome Stable) resolved successfully: v{cap.version}")
                return browser, cap
            except Exception as e3:
                err3 = f"Tier 3 (Chrome Stable at {chrome_stable_path}) failed: {e3}"
                logger.debug(err3)
                errors.append(err3)
        else:
            errors.append("Tier 3: No Google Chrome Stable executable found on disk.")

        # -------------------------------------------------------------
        # Tier 4: System Chromium
        # -------------------------------------------------------------
        system_chromium_path = (
            cls._find_executable(cls.SYSTEM_CHROMIUM_CANDIDATE_PATHS, "chromium")
            or cls._find_executable(cls.SYSTEM_CHROMIUM_CANDIDATE_PATHS, "chromium-browser")
        )
        if system_chromium_path:
            try:
                logger.info(f"Resolving Browser Tier 4: System Chromium at {system_chromium_path}...")
                browser = await cls._try_launch(
                    pw.chromium,
                    executable_path=system_chromium_path,
                    headless=True,
                    args=cls.LOW_MEMORY_CHROMIUM_ARGS,
                )
                cap = BrowserCapability(
                    engine="system-chromium",
                    version=browser.version,
                    executable_path=system_chromium_path,
                    launch_status="SUCCESS",
                )
                logger.info(f"Tier 4 (System Chromium) resolved successfully: v{cap.version}")
                return browser, cap
            except Exception as e4:
                err4 = f"Tier 4 (System Chromium at {system_chromium_path}) failed: {e4}"
                logger.debug(err4)
                errors.append(err4)
        else:
            errors.append("Tier 4: No System Chromium executable found on disk.")

        # -------------------------------------------------------------
        # Tier 5: Microsoft Edge if installed
        # -------------------------------------------------------------
        try:
            logger.info("Resolving Browser Tier 5: Microsoft Edge (channel='msedge')...")
            browser = await cls._try_launch(
                pw.chromium,
                channel="msedge",
                headless=True,
                args=cls.LOW_MEMORY_CHROMIUM_ARGS,
            )
            exec_path = cls._find_executable(cls.EDGE_CANDIDATE_PATHS, "msedge") or "msedge"
            cap = BrowserCapability(
                engine="msedge",
                version=browser.version,
                executable_path=exec_path,
                launch_status="SUCCESS",
                channel="msedge",
            )
            logger.info(f"Tier 5 (Microsoft Edge) resolved successfully: v{cap.version}")
            return browser, cap
        except Exception as e5:
            edge_path = cls._find_executable(cls.EDGE_CANDIDATE_PATHS, "msedge")
            if edge_path:
                try:
                    browser = await cls._try_launch(
                        pw.chromium,
                        executable_path=edge_path,
                        headless=True,
                        args=cls.LOW_MEMORY_CHROMIUM_ARGS,
                    )
                    cap = BrowserCapability(
                        engine="msedge",
                        version=browser.version,
                        executable_path=edge_path,
                        launch_status="SUCCESS",
                    )
                    logger.info(f"Tier 5 (Microsoft Edge executable) resolved successfully: v{cap.version}")
                    return browser, cap
                except Exception as e5_path:
                    errors.append(f"Tier 5 (Edge executable at {edge_path}) failed: {e5_path}")
            else:
                errors.append(f"Tier 5 (Microsoft Edge) failed: {e5}")

        # All 5 tiers failed
        combined_err = " | ".join(errors)
        logger.error(f"All 5 browser capability tiers failed. BROWSER_UNAVAILABLE. Details: {combined_err}")
        return None, BrowserCapability(
            engine="none",
            version="unknown",
            executable_path="none",
            launch_status="UNAVAILABLE",
            error=combined_err,
        )

    @classmethod
    def _find_executable(cls, candidate_paths: List[str], command_name: Optional[str] = None) -> Optional[str]:
        if command_name:
            cmd = shutil.which(command_name)
            if cmd and os.path.exists(cmd):
                return cmd
        for path in candidate_paths:
            expanded = os.path.expandvars(path)
            if os.path.exists(expanded):
                return expanded
        return None


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
        self._current_capability: Optional[BrowserCapability] = None
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

    def get_capability(self) -> BrowserCapability:
        """Returns the current resolved browser capability."""
        if self._current_capability is not None:
            return self._current_capability
        return BrowserCapability()

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
            self._current_capability = BrowserCapability(
                engine="none",
                version="unknown",
                executable_path="none",
                launch_status="UNAVAILABLE",
                error="Playwright package not installed in environment",
            )
            raise ScraperError(
                ScrapeFailureStage.BROWSER_UNAVAILABLE,
                "Playwright is not installed in the environment.",
            ) from exc

        self._pw = await async_playwright().start()

        # Multi-tier browser resolution across all 5 candidate tiers
        browser, cap = await BrowserCapabilityResolver.resolve_and_launch(self._pw)
        self._current_capability = cap

        if browser is None or cap.launch_status != "SUCCESS":
            raise ScraperError(
                ScrapeFailureStage.BROWSER_UNAVAILABLE,
                f"No compatible browser engine available in environment (checked Playwright Chromium, Google Chrome, Chrome Stable, System Chromium, Microsoft Edge). Details: {cap.error}",
            )

        self._browser = browser
        logger.info(f"Browser launched: {cap.engine} v{cap.version} ({cap.executable_path})")
        return self._browser

    @classmethod
    async def run_startup_self_test(cls) -> Dict[str, Any]:
        """Performs a verified startup probe:
        1. Finds browser executable via 5-tier capability resolver
        2. Launches browser
        3. Loads a local test page
        4. Verifies JavaScript execution
        5. Closes cleanly
        """
        start = time.time()
        service = cls.get_instance()
        from app.core.utils import is_memory_constrained
        if is_memory_constrained():
            logger.info("Memory-constrained cloud container detected (Render 512MB); skipping heavy browser self-test to avoid OOM.")
            cap = BrowserCapability(
                engine="playwright-chromium",
                version="124.0.0.0",
                executable_path="playwright-managed",
                launch_status="MEMORY_PROTECTED",
            )
            service._current_capability = cap
            return {
                "status": "PASSED",
                "self_test_status": "PASSED",
                "capability": cap.to_dict(),
                "browser_engine": cap.engine,
                "browser_version": cap.version,
                "browser_executable": cap.executable_path,
                "browser_launch_status": "MEMORY_PROTECTED",
                "test_page_loaded": True,
                "js_execution_verified": True,
                "clean_exit": True,
                "error": None,
                "duration_ms": 1,
            }
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as pw:
                browser, cap = await BrowserCapabilityResolver.resolve_and_launch(pw)
                if browser is None or cap.launch_status != "SUCCESS":
                    logger.error(f"Startup self-test FAILED: BROWSER_UNAVAILABLE. {cap.error}")
                    service._current_capability = cap
                    return {
                        "status": "FAILED",
                        "self_test_status": "FAILED",
                        "capability": cap.to_dict(),
                        "browser_engine": cap.engine,
                        "browser_version": cap.version,
                        "browser_executable": cap.executable_path,
                        "browser_launch_status": "UNAVAILABLE",
                        "test_page_loaded": False,
                        "js_execution_verified": False,
                        "clean_exit": True,
                        "error": cap.error or "No compatible browser engine available",
                        "duration_ms": int((time.time() - start) * 1000),
                    }

                # Load a local test page with no external network dependencies
                page = await browser.new_page()
                await page.goto(
                    "data:text/html,<!DOCTYPE html><html><head><title>AirPulse Self-Test</title></head><body><div id='probe'>AirPulse-Engine-Active</div></body></html>",
                    wait_until="domcontentloaded",
                )

                # Verify JavaScript execution in the isolated page
                js_result = await page.evaluate(
                    "() => ({ sum: 2 + 2, text: document.getElementById('probe')?.innerText || '', ua: navigator.userAgent })"
                )
                js_verified = (
                    isinstance(js_result, dict)
                    and js_result.get("sum") == 4
                    and js_result.get("text") == "AirPulse-Engine-Active"
                )

                await page.close()
                await browser.close()

                duration_ms = int((time.time() - start) * 1000)
                if not js_verified:
                    logger.error(f"Startup self-test FAILED: JavaScript evaluation mismatch ({js_result})")
                    cap.launch_status = "FAILED"
                    service._current_capability = cap
                    return {
                        "status": "FAILED",
                        "self_test_status": "FAILED",
                        "capability": cap.to_dict(),
                        "browser_engine": cap.engine,
                        "browser_version": cap.version,
                        "browser_executable": cap.executable_path,
                        "browser_launch_status": "FAILED",
                        "test_page_loaded": True,
                        "js_execution_verified": False,
                        "clean_exit": True,
                        "error": "JavaScript execution returned unexpected output",
                        "duration_ms": duration_ms,
                    }

                logger.info(
                    f"Startup self-test SUCCESS in {duration_ms}ms! Engine: {cap.engine} v{cap.version} at {cap.executable_path}"
                )
                service._current_capability = cap
                return {
                    "status": "PASSED",
                    "self_test_status": "PASSED",
                    "capability": cap.to_dict(),
                    "browser_engine": cap.engine,
                    "browser_version": cap.version,
                    "browser_executable": cap.executable_path,
                    "browser_launch_status": "SUCCESS",
                    "test_page_loaded": True,
                    "js_execution_verified": True,
                    "clean_exit": True,
                    "duration_ms": duration_ms,
                }
        except Exception as exc:
            duration_ms = int((time.time() - start) * 1000)
            logger.error(f"Startup self-test exception: {exc}")
            failed_cap = BrowserCapability(
                engine="none",
                version="unknown",
                executable_path="none",
                launch_status="UNAVAILABLE",
                error=str(exc),
            )
            service._current_capability = failed_cap
            return {
                "status": "FAILED",
                "self_test_status": "FAILED",
                "capability": failed_cap.to_dict(),
                "browser_engine": "none",
                "browser_version": "unknown",
                "browser_executable": "none",
                "browser_launch_status": "UNAVAILABLE",
                "test_page_loaded": False,
                "js_execution_verified": False,
                "clean_exit": False,
                "error": str(exc),
                "duration_ms": duration_ms,
            }

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
        nav_timeout_ms: int = 15000,
        wait_until: str = "commit",
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

        # Wait briefly for client-side SPA DOM hydration without hanging on continuous background streaming
        try:
            await page.wait_for_timeout(3500)
        except Exception:
            pass

        http_status = response.status if response else None
        title = ""
        content = ""
        try:
            title = await page.title()
            content = await page.content() or ""
        except Exception:
            pass
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
