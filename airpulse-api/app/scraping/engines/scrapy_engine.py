"""
Scrapy Collection Engine for AirPulse.

Executes Scrapy crawls inside an isolated subprocess via `app.scraping.runner`
to prevent Twisted reactor reuse issues (ReactorNotRestartable) in long-lived
Celery workers and Uvicorn event loops.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional

from app.core.enums import CollectionEngine, EngineOutcome, ScrapeFailureStage, StopReason
from app.schemas.runs import SearchRequest
from app.scraping.adapters.base import SourceAdapter
from app.scraping.engines.base import BaseCollectionEngine, EngineResult, Provenance, RawQuote

logger = logging.getLogger(__name__)


class ScrapyEngine(BaseCollectionEngine):
    """
    First-class Scrapy collection engine.
    Runs isolated crawls in spawned subprocesses with bounded timeouts,
    rate limits, and zero-evasion security challenge halting.
    """

    def __init__(self, timeout_seconds: int = 20, download_delay: float = 1.0):
        super().__init__(
            engine_name=CollectionEngine.SCRAPY,
            engine_version="scrapy-2.18.0",
        )
        self.timeout_seconds = timeout_seconds
        self.download_delay = download_delay

    async def execute(
        self,
        request: SearchRequest,
        adapter: SourceAdapter,
        **kwargs: Any,
    ) -> EngineResult:
        started_at = time.monotonic()
        req_spec = adapter.build_scrapy_request(request)
        timeout = int(kwargs.get("timeout_seconds", self.timeout_seconds))

        search_req_dict = {
            "origin": request.origin.upper(),
            "destination": request.destination.upper(),
            "departure_date": str(request.departure_date),
            "booking_window_days": request.booking_window_days,
            "passengers": getattr(request, "passengers", 1),
            "cabin": getattr(request.cabin, "value", "economy") if hasattr(request.cabin, "value") else str(request.cabin),
            "max_results": getattr(request, "max_results", 15),
            "is_nonstop": getattr(request, "is_nonstop", None),
        }

        input_payload = {
            "source_id": adapter.source_id,
            "source_name": adapter.source_name,
            "request_spec": req_spec,
            "search_request": search_req_dict,
            "timeout_seconds": timeout,
            "download_delay": float(kwargs.get("download_delay", self.download_delay)),
            "requires_js_adapter": adapter.requires_javascript(request),
            "mock_response": kwargs.get("mock_response"),
        }

        # Subprocess execution with strict isolation
        proc = None
        try:
            input_bytes = json.dumps(input_payload).encode("utf-8")
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                "-m",
                "app.scraping.runner",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Bounded wait: timeout_seconds + 5s buffer for process startup
            max_wait = timeout + 5
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(input=input_bytes),
                    timeout=max_wait,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Scrapy runner timed out after {max_wait}s for {adapter.source_name}; terminating process.")
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                duration_ms = int((time.monotonic() - started_at) * 1000)
                return EngineResult(
                    status=EngineOutcome.TIMEOUT.value,
                    engine=CollectionEngine.SCRAPY.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=None,
                    quotes=[],
                    quotes_found=0,
                    requires_js=False,
                    failure_code=ScrapeFailureStage.TIMEOUT.value,
                    failure_message=f"Scrapy subprocess timed out after {timeout}s.",
                    duration_ms=duration_ms,
                )

            # Check process exit code
            if proc.returncode != 0:
                err_text = stderr_bytes.decode("utf-8", errors="replace").strip()
                logger.error(f"Scrapy subprocess failed (exit code {proc.returncode}): {err_text}")
                duration_ms = int((time.monotonic() - started_at) * 1000)
                return EngineResult(
                    status=EngineOutcome.FAILED.value,
                    engine=CollectionEngine.SCRAPY.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=None,
                    quotes=[],
                    quotes_found=0,
                    requires_js=False,
                    failure_code=ScrapeFailureStage.CONNECTION_FAILURE.value,
                    failure_message=f"Subprocess terminated abnormally: {err_text[:200]}",
                    duration_ms=duration_ms,
                )

            # Parse runner output JSON
            raw_out = stdout_bytes.decode("utf-8", errors="replace").strip()
            if not raw_out:
                duration_ms = int((time.monotonic() - started_at) * 1000)
                return EngineResult(
                    status=EngineOutcome.FAILED.value,
                    engine=CollectionEngine.SCRAPY.value,
                    source_id=adapter.source_id,
                    source_name=adapter.source_name,
                    http_status=None,
                    quotes=[],
                    quotes_found=0,
                    requires_js=False,
                    failure_code=ScrapeFailureStage.EMPTY_RESPONSE.value,
                    failure_message="Empty JSON response from Scrapy runner.",
                    duration_ms=duration_ms,
                )

            result_dict = json.loads(raw_out)
            duration_ms = int((time.monotonic() - started_at) * 1000)

            # If the runner returned raw body in mock or adapter has custom parse_scrapy_response
            quotes = result_dict.get("quotes", [])
            if not quotes and result_dict.get("status") == "SUCCESS":
                # Check adapter
                parsed_adapter_quotes = adapter.parse_scrapy_response(
                    {"body": result_dict.get("metadata", {}).get("body_text", ""), "http_status": result_dict.get("http_status", 200)},
                    request,
                )
                quotes = [q.to_dict() for q in parsed_adapter_quotes]

            return EngineResult(
                status=result_dict.get("status", EngineOutcome.FAILED.value),
                engine=CollectionEngine.SCRAPY.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=result_dict.get("http_status"),
                quotes=quotes,
                quotes_found=len(quotes),
                results_seen=result_dict.get("results_seen", 0),
                results_matching=result_dict.get("results_matching", 0),
                results_collected=result_dict.get("results_collected", len(quotes)),
                pages_requested=result_dict.get("pages_requested", 1),
                max_results=result_dict.get("max_results", getattr(request, "max_results", 15)),
                stop_reason=result_dict.get("stop_reason", StopReason.PAGE_EXHAUSTED.value),
                requires_js=result_dict.get("requires_js", False),
                failure_code=result_dict.get("failure_code"),
                failure_message=result_dict.get("failure_message"),
                duration_ms=duration_ms,
                raw_artifact_id=result_dict.get("raw_artifact_id"),
                raw_payload_hash=result_dict.get("raw_payload_hash"),
                metadata=result_dict.get("metadata", {}),
            )

        except Exception as exc:
            logger.exception(f"Unexpected error in ScrapyEngine for {adapter.source_name}: {exc}")
            duration_ms = int((time.monotonic() - started_at) * 1000)
            return EngineResult(
                status=EngineOutcome.FAILED.value,
                engine=CollectionEngine.SCRAPY.value,
                source_id=adapter.source_id,
                source_name=adapter.source_name,
                http_status=None,
                quotes=[],
                quotes_found=0,
                requires_js=False,
                failure_code="ENGINE_EXCEPTION",
                failure_message=str(exc),
                duration_ms=duration_ms,
            )
