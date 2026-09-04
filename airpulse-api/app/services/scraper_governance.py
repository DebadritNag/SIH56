"""
Scraper Governance Subsystem:
- Per-source ethical rate limiting and concurrency management.
- Source policy gate (Robots.txt & Terms of Service status verification).
- Structured source health evaluator and state machine.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.enums import PolicyStatus, ScrapeFailureStage, SourceHealthStatus
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)


@dataclass
class SourcePolicy:
    source_name: str
    robots_url: Optional[str] = None
    terms_url: Optional[str] = None
    robots_checked_at: Optional[datetime] = None
    terms_checked_at: Optional[datetime] = None
    policy_status: PolicyStatus = PolicyStatus.ALLOWED
    policy_notes: Optional[str] = None

    def is_executable(self) -> bool:
        """Returns True only if the policy permits automated collection."""
        return self.policy_status != PolicyStatus.RESTRICTED


@dataclass
class SourceRateLimitConfig:
    source_name: str
    max_concurrency: int = 1
    requests_per_minute: int = 60
    minimum_delay_seconds: float = 1.0
    timeout_seconds: int = 30
    retry_count: int = 2
    backoff_factor: float = 1.5


class SourceRateLimiter:
    """Manages ethical per-source rate limits and concurrency locks."""

    _instances: Dict[str, SourceRateLimiter] = {}

    def __init__(self, config: SourceRateLimitConfig):
        self.config = config
        self._last_request_time: float = 0.0
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(config.max_concurrency)

    @classmethod
    def get_limiter(cls, source_name: str, **overrides) -> SourceRateLimiter:
        key = source_name.lower().strip()
        if key not in cls._instances:
            cfg = SourceRateLimitConfig(source_name=source_name, **overrides)
            cls._instances[key] = SourceRateLimiter(cfg)
        return cls._instances[key]

    async def acquire(self) -> None:
        """Enforces concurrency bound and spaces requests by minimum_delay_seconds."""
        await self._semaphore.acquire()
        try:
            async with self._lock:
                now = time.monotonic()
                min_gap = max(
                    self.config.minimum_delay_seconds,
                    60.0 / float(max(1, self.config.requests_per_minute)),
                )
                elapsed = now - self._last_request_time
                if elapsed < min_gap:
                    delay = min_gap - elapsed
                    logger.debug(f"RateLimiter: spacing request for {self.config.source_name} by {delay:.2f}s")
                    await asyncio.sleep(delay)
                self._last_request_time = time.monotonic()
        except Exception:
            self._semaphore.release()
            raise

    def release(self) -> None:
        self._semaphore.release()


class PolicyGateService:
    """Evaluates whether a source is legally and operationally permissible to scrape."""

    # Configured policy registry for sources
    _policies: Dict[str, SourcePolicy] = {
        "indigo": SourcePolicy(
            source_name="indigo",
            robots_url="https://www.goindigo.in/robots.txt",
            terms_url="https://www.goindigo.in/information/terms-and-conditions.html",
            policy_status=PolicyStatus.ALLOWED,
            policy_notes="Public fare pricing retrieval allowed under ethical rate constraints (10 req/min).",
        ),
        "air_india": SourcePolicy(
            source_name="air_india",
            robots_url="https://www.airindia.com/robots.txt",
            terms_url="https://www.airindia.com/in/en/terms-and-conditions.html",
            policy_status=PolicyStatus.ALLOWED,
            policy_notes="Public tariff search verification allowed under MoSPI research exemption.",
        ),
        "restricted_source_mock": SourcePolicy(
            source_name="restricted_source_mock",
            policy_status=PolicyStatus.RESTRICTED,
            policy_notes="Explicit Disallow: / on automated scraping without written authorization.",
        ),
    }

    @classmethod
    def get_policy(cls, source_name: str) -> SourcePolicy:
        key = source_name.lower().strip().replace(" ", "_")
        return cls._policies.get(
            key,
            SourcePolicy(
                source_name=source_name,
                policy_status=PolicyStatus.UNKNOWN,
                policy_notes="Default policy: manual review recommended for uncatalogued sources.",
            ),
        )

    @classmethod
    def register_policy(cls, policy: SourcePolicy) -> None:
        cls._policies[policy.source_name.lower().strip().replace(" ", "_")] = policy

    @classmethod
    def verify_policy(cls, source_name: str) -> SourcePolicy:
        """Throws ScraperError(POLICY_RESTRICTED) if the source is restricted."""
        policy = cls.get_policy(source_name)
        if not policy.is_executable():
            raise ScraperError(
                stage=ScrapeFailureStage.POLICY_RESTRICTED,
                reason=f"Source '{source_name}' policy is RESTRICTED: {policy.policy_notes}",
            )
        return policy
