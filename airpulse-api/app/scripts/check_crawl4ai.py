"""
Crawl4AI + Playwright diagnostic script.

Verifies the full browser stack is correctly installed and operational.
Safe to run in CI, Docker build verification, and on EC2 after deployment.

Constraints (matching EC2 t3.small / 2 GB RAM limits):
  - One Chromium session only
  - No screenshots, no video, no PDF
  - Headless only
  - Target: https://example.com (IANA reserved, always reachable, zero cost)

Exit codes:
  0 — all checks passed
  1 — one or more checks failed

Usage:
  python -m app.scripts.check_crawl4ai
  docker compose exec worker python -m app.scripts.check_crawl4ai
"""
from __future__ import annotations

import asyncio
import sys

PASS = "OK"
FAIL = "FAIL"
TARGET_URL = "https://example.com"
EXPECTED_TITLE_FRAGMENT = "Example"   # IANA example page always contains "Example Domain"


def _status(label: str, ok: bool, detail: str = "") -> bool:
    icon = "✓" if ok else "✗"
    line = f"  {icon}  {label}: {PASS if ok else FAIL}"
    if detail:
        line += f"  ({detail})"
    print(line)
    return ok


# ---------------------------------------------------------------------------
# Step 1 — Python imports
# ---------------------------------------------------------------------------
def check_imports() -> bool:
    print("\n[1/4] Checking Python imports")
    results = []

    try:
        import crawl4ai  # noqa: F401
        results.append(_status("crawl4ai import", True))
    except ImportError as exc:
        results.append(_status("crawl4ai import", False, str(exc)))

    try:
        from playwright.async_api import async_playwright  # noqa: F401
        results.append(_status("Playwright import", True))
    except ImportError as exc:
        results.append(_status("Playwright import", False, str(exc)))

    return all(results)


# ---------------------------------------------------------------------------
# Step 2 — Chromium launch (headless, no page load)
# ---------------------------------------------------------------------------
async def check_chromium_launch() -> bool:
    print("\n[2/4] Checking Chromium launch (headless, no network)")
    from playwright.async_api import async_playwright

    browser = None
    try:
        async with async_playwright() as pw:
            # Use chromium channel — matches what Crawl4AI uses.
            browser = await pw.chromium.launch(headless=True)
            version = browser.version
            await browser.close()
        return _status(f"Chromium launch (v{version})", True)
    except Exception as exc:
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
        return _status("Chromium launch", False, str(exc))


# ---------------------------------------------------------------------------
# Step 3 — Crawl4AI navigation test against example.com
# ---------------------------------------------------------------------------
async def check_crawl4ai_navigation() -> bool:
    print(f"\n[3/4] Checking Crawl4AI navigation ({TARGET_URL})")
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

        browser_cfg = BrowserConfig(
            browser_type="chromium",
            headless=True,
            # No screenshots / video / PDF — keep memory use minimal on t3.small.
            use_managed_browser=False,
        )
        run_cfg = CrawlerRunConfig(
            word_count_threshold=1,
            screenshot=False,
            pdf=False,
            only_text=True,          # Skip heavy DOM extraction; we only need the title.
        )

        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            result = await crawler.arun(url=TARGET_URL, config=run_cfg)

        if not result.success:
            return _status("Crawl4AI navigation", False,
                           f"success=False error={result.error_message}")

        title_ok = EXPECTED_TITLE_FRAGMENT.lower() in (result.metadata.get("title", "") or "").lower()
        if not title_ok:
            # Some Crawl4AI versions expose title differently — accept if page loaded
            title_ok = len(result.markdown or result.cleaned_html or "") > 0

        return _status(
            "Crawl4AI navigation",
            title_ok,
            f"status={result.status_code} title='{result.metadata.get('title', '?')}'"
        )

    except Exception as exc:
        return _status("Crawl4AI navigation", False, str(exc))


# ---------------------------------------------------------------------------
# Step 4 — Config validation (concurrency ceiling)
# ---------------------------------------------------------------------------
def check_config() -> bool:
    print("\n[4/4] Checking AirPulse config")
    try:
        from app.config import settings
        concurrency = settings.CRAWL4AI_BROWSER_CONCURRENCY
        max_results = settings.CRAWL4AI_DEFAULT_MAX_RESULTS

        concurrency_ok = 1 <= concurrency <= 2
        results_ok = 1 <= max_results <= 15

        _status(f"CRAWL4AI_BROWSER_CONCURRENCY={concurrency} (safe ≤ 2 on t3.small)", concurrency_ok)
        _status(f"CRAWL4AI_DEFAULT_MAX_RESULTS={max_results} (safe ≤ 15)", results_ok)
        _status(f"CRAWL4AI_ENABLED={settings.CRAWL4AI_ENABLED} (config readable)", True)

        return concurrency_ok and results_ok
    except Exception as exc:
        return _status("Config read", False, str(exc))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def _async_main() -> int:
    print("=" * 55)
    print("  AirPulse — Crawl4AI + Playwright Diagnostic")
    print("  Target constraint: EC2 t3.small  2 GB RAM  1 vCPU")
    print("=" * 55)

    passed = []
    passed.append(check_imports())
    passed.append(await check_chromium_launch())
    passed.append(await check_crawl4ai_navigation())
    passed.append(check_config())

    total = len(passed)
    ok = sum(passed)
    print()
    print("=" * 55)
    if all(passed):
        print(f"  RESULT: ALL {total} CHECKS PASSED — Crawl4AI ready")
    else:
        print(f"  RESULT: {ok}/{total} PASSED — {total - ok} check(s) FAILED")
    print("=" * 55)

    return 0 if all(passed) else 1


def main() -> None:
    sys.exit(asyncio.run(_async_main()))


if __name__ == "__main__":
    main()
