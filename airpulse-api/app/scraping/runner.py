"""
Isolated Scrapy Crawler Subprocess Runner.

Each Scrapy crawl runs in an isolated spawned subprocess with a fresh Twisted reactor,
preventing Twisted reactor reuse/collision issues (ReactorNotRestartable) in long-lived
Celery and Uvicorn processes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional

# Suppress noisy scrapy logs in runner stdout
logging.getLogger("scrapy").setLevel(logging.WARNING)

# Block & CAPTCHA markers
CAPTCHA_MARKERS = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "cf-challenge",
    "challenge-running",
    "turnstile",
    "perimeterx",
    "press & hold",
    "robot or human",
    "security verification",
]

BLOCKED_MARKERS = [
    "access denied",
    "access to this page has been denied",
    "403 forbidden",
    "waf blocked",
    "incident id",
    "blocked by akamai",
    "cloudflare ray id",
    "shield active",
]

NO_AVAILABILITY_MARKERS = [
    "no flights found",
    "no flights available",
    "no direct or connecting flights",
    "sold out",
    "no seats available",
    "zero flights on this route",
]

JS_SHELL_MARKERS = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<div id="__next"></div>',
    '<app-root></app-root>',
    "you need to enable javascript to run this app",
    "javascript is disabled in your browser",
]

JS_SHELL_PATTERNS = [
    r"<div\s+id=['\"](?:root|app|__next)['\"]\s*>\s*</div>",
    r"<app-root\s*>\s*</app-root>",
]


class AirPulseIsolatedSpider:
    """
    Core Scrapy execution logic inside the isolated process.
    Uses Scrapy's CrawlerProcess to execute exactly one crawl.
    """

    @classmethod
    def run_crawl(cls, input_data: Dict[str, Any]) -> Dict[str, Any]:
        started_at = time.monotonic()
        source_id = input_data.get("source_id", "unknown_source")
        source_name = input_data.get("source_name", "Test Source")
        req_spec = input_data.get("request_spec", {})
        url = req_spec.get("url", "")
        method = req_spec.get("method", "GET").upper()
        headers = req_spec.get("headers", {})
        cookies = req_spec.get("cookies", {})
        timeout = int(input_data.get("timeout_seconds", 15))
        download_delay = float(input_data.get("download_delay", 1.0))

        # Check for test mock fixtures first (for unit testing and mock adapters)
        mock_response = input_data.get("mock_response")
        if mock_response is not None:
            return cls._process_response(
                http_status=mock_response.get("http_status", 200),
                body_text=mock_response.get("body", ""),
                headers=mock_response.get("headers", {}),
                input_data=input_data,
                started_at=started_at,
            )

        import scrapy
        from scrapy.crawler import CrawlerProcess
        from scrapy.http import Response

        captured_result: Dict[str, Any] = {
            "http_status": None,
            "body_text": "",
            "headers": {},
            "error": None,
            "pages_requested": 0,
        }

        search_req = input_data.get("search_request", {})
        bounded_max = min(max(1, int(search_req.get("max_results", input_data.get("max_results", 15)))), 20)

        default_ua = headers.get("User-Agent") or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        effective_timeout = min(timeout, 15)

        class SingleRequestSpider(scrapy.Spider):
            name = "single_request_spider"
            custom_settings = {
                "ROBOTSTXT_OBEY": False,  # Governed by AirPulse Stage 1 PolicyGateService
                "DOWNLOAD_TIMEOUT": effective_timeout,
                "DOWNLOAD_DELAY": download_delay,
                "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
                "AUTOTHROTTLE_ENABLED": False,
                "COOKIES_ENABLED": True,
                "LOG_LEVEL": "ERROR",
                "USER_AGENT": default_ua,
            }

            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.matching_count = 0

            def start_requests(self):
                if method == "POST":
                    yield scrapy.Request(
                        url=url,
                        method="POST",
                        headers=headers,
                        cookies=cookies,
                        body=req_spec.get("body"),
                        callback=self.parse,
                        errback=self.errback,
                        dont_filter=True,
                    )
                else:
                    yield scrapy.Request(
                        url=url,
                        method="GET",
                        headers=headers,
                        cookies=cookies,
                        callback=self.parse,
                        errback=self.errback,
                        dont_filter=True,
                    )

            def parse(self, response: Response):
                captured_result["pages_requested"] = captured_result.get("pages_requested", 0) + 1
                captured_result["http_status"] = response.status
                if not captured_result["body_text"]:
                    captured_result["body_text"] = response.text
                captured_result["headers"] = {k.decode("utf-8"): [v.decode("utf-8") for v in vals] for k, vals in response.headers.items()}

                # Evaluate matching fares on current page
                from app.scraping.parsers import parse_flight_cards_html
                quotes = parse_flight_cards_html(
                    html_content=response.text,
                    origin=search_req.get("origin", "DEL"),
                    destination=search_req.get("destination", "BOM"),
                    departure_date=str(search_req.get("departure_date", "2026-09-10")),
                    source_name=source_name,
                    engine_name="SCRAPY",
                    http_status=response.status,
                    max_results=bounded_max,
                    is_nonstop=search_req.get("is_nonstop"),
                    cabin=search_req.get("cabin"),
                    return_metrics=False,
                )
                self.matching_count += len(quotes)

                # Stop enqueuing further result pages once enough matching fares exist
                if self.matching_count >= bounded_max:
                    return

                next_page = response.css("a.next-page::attr(href), a[rel='next']::attr(href), a.pagination-next::attr(href)").get()
                if next_page:
                    yield response.follow(next_page, callback=self.parse)

            def errback(self, failure):
                captured_result["error"] = str(failure.value)
                if hasattr(failure.value, "response") and failure.value.response:
                    resp = failure.value.response
                    captured_result["http_status"] = resp.status
                    captured_result["body_text"] = resp.text

        process = CrawlerProcess(SingleRequestSpider.custom_settings)
        process.crawl(SingleRequestSpider)
        process.start()  # Blocks until the single crawl completes

        if (captured_result.get("error") or captured_result.get("http_status") is None) and not captured_result.get("body_text"):
            err_str = (captured_result.get("error") or "No response received or connection timed out").lower()
            status = "TIMEOUT" if ("timeout" in err_str or "timed out" in err_str) else "FAILED"
            failure_code = "TIMEOUT" if status == "TIMEOUT" else "CONNECTION_FAILURE"
            duration_ms = int((time.monotonic() - started_at) * 1000)
            return {
                "status": status,
                "engine": "SCRAPY",
                "source_id": source_id,
                "http_status": captured_result.get("http_status"),
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": failure_code,
                "failure_message": captured_result.get("error") or "Crawler completed without receiving an HTTP response.",
                "duration_ms": duration_ms,
                "raw_artifact_id": None,
                "raw_payload_hash": None,
                "metadata": {"url": url},
            }

        return cls._process_response(
            http_status=captured_result.get("http_status") or 200,
            body_text=captured_result.get("body_text") or "",
            headers=captured_result.get("headers") or {},
            input_data=input_data,
            started_at=started_at,
        )

    @classmethod
    def _process_response(
        cls,
        http_status: int,
        body_text: str,
        headers: Dict[str, Any],
        input_data: Dict[str, Any],
        started_at: float,
    ) -> Dict[str, Any]:
        duration_ms = int((time.monotonic() - started_at) * 1000)
        source_id = input_data.get("source_id", "unknown_source")
        source_name = input_data.get("source_name", "Test Source")
        body_lower = body_text.lower()
        sha256_hash = hashlib.sha256(body_text.encode("utf-8")).hexdigest()

        search_req = input_data.get("search_request", {})
        bounded_max = min(max(1, int(search_req.get("max_results", input_data.get("max_results", 15)))), 20)
        pages_requested = int(input_data.get("pages_requested", 1) or 1)

        base_res = {
            "engine": "SCRAPY",
            "source_id": source_id,
            "http_status": http_status,
            "duration_ms": duration_ms,
            "raw_payload_hash": sha256_hash,
            "raw_artifact_id": f"scrapy_{sha256_hash[:16]}",
            "results_seen": 0,
            "results_matching": 0,
            "results_collected": 0,
            "pages_requested": pages_requested,
            "max_results": bounded_max,
            "stop_reason": "PAGE_EXHAUSTED",
            "metadata": {"headers": headers, "body_length": len(body_text)},
        }

        # 1. Check HTTP Status Codes
        if http_status == 403:
            return {
                **base_res,
                "status": "BLOCKED",
                "stop_reason": "BLOCKED",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": "BLOCKED",
                "failure_message": "HTTP 403 Forbidden received. Access restricted by origin.",
            }

        if http_status == 429:
            return {
                **base_res,
                "status": "RATE_LIMITED",
                "stop_reason": "BLOCKED",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": "RATE_LIMITED",
                "failure_message": "HTTP 429 Too Many Requests received. Rate limit exceeded.",
            }

        if http_status == 401 or http_status == 407:
            return {
                **base_res,
                "status": "AUTH_REQUIRED",
                "stop_reason": "ERROR",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": "AUTH_REQUIRED",
                "failure_message": f"HTTP {http_status} Authentication Required.",
            }

        if http_status >= 500:
            return {
                **base_res,
                "status": "HTTP_ERROR",
                "stop_reason": "ERROR",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": "HTTP_ERROR",
                "failure_message": f"Server error HTTP {http_status}.",
            }

        # 2. Check Security Challenges / CAPTCHAs in Body
        for marker in CAPTCHA_MARKERS:
            if marker in body_lower:
                return {
                    **base_res,
                    "status": "CAPTCHA_DETECTED",
                    "stop_reason": "CAPTCHA_DETECTED",
                    "quotes_found": 0,
                    "quotes": [],
                    "requires_js": False,
                    "failure_code": "CAPTCHA_DETECTED",
                    "failure_message": f"CAPTCHA or verification challenge marker detected: '{marker}'",
                }

        for marker in BLOCKED_MARKERS:
            if marker in body_lower:
                return {
                    **base_res,
                    "status": "BLOCKED",
                    "stop_reason": "BLOCKED",
                    "quotes_found": 0,
                    "quotes": [],
                    "requires_js": False,
                    "failure_code": "BLOCKED",
                    "failure_message": f"Access blocked marker detected: '{marker}'",
                }

        # 3. Check for Explicit Empty Availability
        for marker in NO_AVAILABILITY_MARKERS:
            if marker in body_lower:
                return {
                    **base_res,
                    "status": "NO_AVAILABILITY",
                    "stop_reason": "NO_AVAILABILITY",
                    "quotes_found": 0,
                    "quotes": [],
                    "requires_js": False,
                    "failure_code": "NO_AVAILABILITY",
                    "failure_message": f"No flights available on corridor: '{marker}'",
                }

        # 4. Check for Empty Response Body
        if not body_text.strip():
            return {
                **base_res,
                "status": "CONTENT_NOT_FOUND",
                "stop_reason": "NO_AVAILABILITY",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": False,
                "failure_code": "EMPTY_RESPONSE",
                "failure_message": "Response body is empty.",
            }

        # 5. Check if Confirmed Client-Side JS Shell
        is_js_shell = (
            any(marker in body_lower for marker in JS_SHELL_MARKERS)
            or any(bool(re.search(pat, body_lower)) for pat in JS_SHELL_PATTERNS)
            or input_data.get("requires_js_adapter", False)
        )
        if is_js_shell:
            return {
                **base_res,
                "status": "CONTENT_REQUIRES_JS",
                "stop_reason": "PAGE_EXHAUSTED",
                "quotes_found": 0,
                "quotes": [],
                "requires_js": True,
                "failure_code": "CONTENT_REQUIRES_JS",
                "failure_message": "HTTP 200 received but page body is an empty client JavaScript shell requiring SPA execution.",
            }

        # 6. Parse Fares from Static/Server-Rendered HTML
        try:
            from app.scraping.parsers import parse_flight_cards_html
            origin = search_req.get("origin", "DEL")
            destination = search_req.get("destination", "BOM")
            dep_date = str(search_req.get("departure_date", "2026-09-10"))

            parsed_quotes, metrics = parse_flight_cards_html(
                html_content=body_text,
                origin=origin,
                destination=destination,
                departure_date=dep_date,
                source_name=source_name,
                engine_name="SCRAPY",
                http_status=http_status,
                max_results=bounded_max,
                is_nonstop=search_req.get("is_nonstop"),
                cabin=search_req.get("cabin"),
                return_metrics=True,
            )

            if parsed_quotes:
                return {
                    **base_res,
                    "status": "SUCCESS",
                    "quotes_found": len(parsed_quotes),
                    "quotes": [q.to_dict() for q in parsed_quotes],
                    "results_seen": metrics["results_seen"],
                    "results_matching": metrics["results_matching"],
                    "results_collected": metrics["results_collected"],
                    "stop_reason": metrics["stop_reason"],
                    "requires_js": False,
                    "failure_code": None,
                    "failure_message": None,
                }
            else:
                status = "NO_AVAILABILITY" if metrics["results_matching"] == 0 and "no flights" in body_lower else "PARSE_ERROR"
                return {
                    **base_res,
                    "status": status,
                    "quotes_found": 0,
                    "quotes": [],
                    "results_seen": metrics["results_seen"],
                    "results_matching": metrics["results_matching"],
                    "results_collected": 0,
                    "stop_reason": metrics["stop_reason"],
                    "requires_js": False,
                    "failure_code": status,
                    "failure_message": "Zero matching flight quotes were extracted.",
                }
        except Exception as ex:
            return {
                **base_res,
                "status": "PARSE_ERROR",
                "quotes_found": 0,
                "quotes": [],
                "results_seen": 0,
                "results_matching": 0,
                "results_collected": 0,
                "stop_reason": "ERROR",
                "requires_js": False,
                "failure_code": "PARSE_ERROR",
                "failure_message": f"Exception during fare parsing: {ex}",
            }


def main():
    """Main CLI entrypoint for subprocess execution."""
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        res = {
            "status": "FAILED",
            "engine": "SCRAPY",
            "quotes_found": 0,
            "failure_code": "NO_INPUT",
            "failure_message": "No JSON input received on stdin.",
        }
        sys.stdout.write(json.dumps(res))
        sys.stdout.flush()
        sys.exit(1)

    try:
        input_data = json.loads(raw_input)
        result = AirPulseIsolatedSpider.run_crawl(input_data)
        sys.stdout.write(json.dumps(result))
        sys.stdout.flush()
        sys.exit(0)
    except Exception as exc:
        err_res = {
            "status": "FAILED",
            "engine": "SCRAPY",
            "quotes_found": 0,
            "failure_code": "RUNNER_EXCEPTION",
            "failure_message": str(exc),
        }
        sys.stdout.write(json.dumps(err_res))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
