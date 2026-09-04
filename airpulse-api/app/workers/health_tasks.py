"""
Periodic Celery worker task for monitoring source connectivity, health, and latency.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

from sqlalchemy import select

from app.collectors.registry import CollectorRegistry
from app.core.utils import utc_now
from app.db.models import Source, SourceHealthLog
from app.db.session import AsyncSessionLocal
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.health_tasks.check_all_sources_health")
def check_all_sources_health():
    """Periodic probe evaluating health status and latency for all active collection sources."""
    async def _run():
        async with AsyncSessionLocal() as session:
            sources = list((await session.execute(select(Source).where(Source.active == True))).scalars().all())
            results = []

            for src in sources:
                collector = CollectorRegistry.build_for_source(
                    source_id=str(src.id),
                    source_name=src.name,
                    source_type=str(src.source_type),
                    collection_method=str(src.collection_method),
                    base_url=src.base_url,
                    rate_limit_per_minute=src.rate_limit_per_minute,
                    timeout_seconds=src.timeout_seconds,
                    max_retries=src.max_retries,
                )

                try:
                    health = await collector.health_check()
                    status = health.get("status", "unknown")
                    latency = health.get("latency_ms")
                    err = health.get("error")

                    is_ok = status in ("healthy", "disabled")
                    if is_ok:
                        src.consecutive_failures = 0
                        src.last_success_at = utc_now()
                    else:
                        src.consecutive_failures += 1
                        src.last_failure_at = utc_now()

                    log_entry = SourceHealthLog(
                        id=uuid4(),
                        source_id=src.id,
                        checked_at=utc_now(),
                        success=is_ok,
                        response_time_ms=latency or 0,
                        records_collected=0,
                        error_type=status if not is_ok else None,
                        error_message=err if err else None,
                    )
                    session.add(log_entry)
                    results.append({"source": src.name, "status": status, "latency": latency})
                except Exception as exc:
                    logger.error(f"Health check probe failed for {src.name}: {exc}")
                    src.consecutive_failures += 1
                    src.last_failure_at = utc_now()
                    log_entry = SourceHealthLog(
                        id=uuid4(),
                        source_id=src.id,
                        checked_at=utc_now(),
                        success=False,
                        response_time_ms=0,
                        records_collected=0,
                        error_type="PROBE_EXCEPTION",
                        error_message=str(exc)[:250],
                    )
                    session.add(log_entry)
                    results.append({"source": src.name, "status": "failed", "error": str(exc)})

            await session.commit()
            return results

    return asyncio.run(_run())
