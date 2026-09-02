"""
Backend diagnostics + realtime self-test for AirPulse.

Provides the data behind ``GET /api/v1/system/diagnostics`` and a realtime-compatible
self-test that does NOT depend on any browser being connected: it creates a temporary
pipeline run + step, transitions the step QUEUED -> RUNNING -> COMPLETED (which is what
Supabase Realtime broadcasts to subscribers), verifies the DB write, and cleans up.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.enums import PipelineStatus
from app.db.schema import (
    AirfareIndex,
    CollectionRun,
    PipelineRun,
    PipelineStep,
    RawFare,
    ValidatedFare,
)

# Tables enabled for Supabase Realtime by the migrations. Diagnostics confirms the
# publication contains these.
REALTIME_TABLES = (
    "collection_runs",
    "pipeline_runs",
    "pipeline_steps",
    "scraping_test_runs",
    "alerts",
    "anomalies",
    "source_health_logs",
    "airfare_index",
)


class DiagnosticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def database_latency_ms(self) -> tuple[bool, float | None]:
        try:
            start = time.perf_counter()
            await self.db.execute(text("SELECT 1"))
            return True, round((time.perf_counter() - start) * 1000, 2)
        except Exception:
            return False, None

    async def latest_migration(self) -> str | None:
        try:
            row = await self.db.execute(
                text("SELECT version_num FROM public.alembic_version LIMIT 1")
            )
            return row.scalar_one_or_none()
        except Exception:
            return None

    async def realtime_configured(self) -> dict[str, Any]:
        """Confirm the supabase_realtime publication includes the expected tables."""
        try:
            result = await self.db.execute(
                text(
                    "SELECT tablename FROM pg_publication_tables "
                    "WHERE pubname = 'supabase_realtime' AND schemaname = 'public'"
                )
            )
            published = {r[0] for r in result.fetchall()}
        except Exception:
            return {"configured": False, "tables": []}
        expected = set(REALTIME_TABLES)
        return {
            "configured": expected.issubset(published),
            "tables": sorted(published & expected),
            "missing": sorted(expected - published),
        }

    async def counts(self) -> dict[str, Any]:
        raw = (await self.db.execute(select(func.count()).select_from(RawFare))).scalar_one()
        validated = (
            await self.db.execute(select(func.count()).select_from(ValidatedFare))
        ).scalar_one()
        latest_collection = (
            await self.db.execute(
                select(CollectionRun.started_at).order_by(CollectionRun.started_at.desc()).limit(1)
            )
        ).scalar_one_or_none()
        latest_index = (
            await self.db.execute(
                select(AirfareIndex.index_value)
                .where(AirfareIndex.index_type == "NATIONAL", AirfareIndex.route_id.is_(None))
                .order_by(AirfareIndex.index_date.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        return {
            "raw_fare_count": raw,
            "validated_fare_count": validated,
            "latest_collection": latest_collection.isoformat() if latest_collection else None,
            "latest_index_value": float(latest_index) if latest_index is not None else None,
        }

    async def storage_status(self) -> dict[str, Any]:
        """
        Live Supabase Storage check using the service role. Confirms the key is valid and
        the expected private buckets exist. Falls back to 'local_fallback' when the key is
        a placeholder or Storage is unreachable (offline mode still works via local scratch).
        """
        from app.services.storage_service import ALL_BUCKETS, get_storage_service

        key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not key or any(m in key for m in ("placeholder", "CHANGE_ME")):
            return {"status": "local_fallback", "buckets_present": 0, "buckets_expected": len(ALL_BUCKETS)}
        try:
            buckets = await get_storage_service().list_buckets()
            present = {b.get("id") for b in buckets}
            expected = set(ALL_BUCKETS)
            configured = expected.issubset(present)
            return {
                "status": "configured" if configured else "partial",
                "buckets_present": len(expected & present),
                "buckets_expected": len(expected),
                "missing": sorted(expected - present),
            }
        except Exception:
            return {"status": "local_fallback", "buckets_present": 0, "buckets_expected": len(ALL_BUCKETS)}

    async def build_diagnostics(self) -> dict[str, Any]:
        connected, latency = await self.database_latency_ms()
        realtime = await self.realtime_configured()
        counts = await self.counts()
        storage = await self.storage_status()
        supabase_configured = bool(settings.SUPABASE_URL) and "example.supabase.co" not in settings.SUPABASE_URL
        jwt_ready = bool(settings.SUPABASE_JWT_SECRET) and not any(
            m in settings.SUPABASE_JWT_SECRET for m in ("placeholder", "CHANGE_ME")
        )
        return {
            "database": "connected" if connected else "disconnected",
            "database_latency_ms": latency,
            "supabase_project": "configured" if supabase_configured else "not_configured",
            "supabase_url": settings.SUPABASE_URL if supabase_configured else None,
            "realtime": "configured" if realtime["configured"] else "not_configured",
            "realtime_tables": realtime["tables"],
            "storage": storage["status"],
            "storage_buckets": f"{storage['buckets_present']}/{storage['buckets_expected']}",
            "auth": "configured" if jwt_ready else "not_configured",
            "latest_migration": await self.latest_migration(),
            **counts,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def realtime_self_test(self) -> dict[str, Any]:
        """
        Create a temporary pipeline run + step, transition its status, verify the write,
        then clean up. Does not require a connected browser. Runs in its own transaction.
        """
        steps: list[dict[str, Any]] = []
        pipeline_run_id = None
        try:
            # 1. Create pipeline run (marker metadata so it is identifiable/cleanable)
            pr = PipelineRun(
                pipeline_type="realtime_self_test",
                status=PipelineStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                metadata_={"self_test": True, "token": str(uuid.uuid4())},
            )
            self.db.add(pr)
            await self.db.flush()
            pipeline_run_id = pr.id
            steps.append({"name": "create_pipeline_run", "status": "passed"})

            # 2. Create pipeline step QUEUED
            step = PipelineStep(
                pipeline_run_id=pr.id,
                step_name="APIx",
                step_order=1,
                status=PipelineStatus.QUEUED,
            )
            self.db.add(step)
            await self.db.flush()
            steps.append({"name": "create_pipeline_step", "status": "passed"})

            # 3. Update RUNNING (realtime UPDATE event #1)
            step.status = PipelineStatus.RUNNING
            step.started_at = datetime.now(timezone.utc)
            await self.db.flush()
            steps.append({"name": "update_running", "status": "passed"})

            # 4. Update COMPLETED (realtime UPDATE event #2)
            step.status = PipelineStatus.COMPLETED
            step.finished_at = datetime.now(timezone.utc)
            await self.db.flush()
            steps.append({"name": "update_completed", "status": "passed"})

            # 5. Verify DB update persisted
            verify = await self.db.execute(
                select(PipelineStep.status).where(PipelineStep.id == step.id)
            )
            final_status = verify.scalar_one()
            db_verified = final_status == PipelineStatus.COMPLETED
            steps.append(
                {
                    "name": "database_update_verified",
                    "status": "passed" if db_verified else "failed",
                    "message": f"final status={final_status}",
                }
            )

            # 6. Cleanup (step cascades with run)
            await self.db.delete(pr)
            await self.db.commit()
            steps.append({"name": "cleanup", "status": "passed"})

            realtime = await self.realtime_configured()
            passed = all(s["status"] == "passed" for s in steps)
            return {
                "success": passed and realtime["configured"],
                "database_write_verified": db_verified,
                "realtime_configured": realtime["configured"],
                "steps": steps,
            }
        except Exception as exc:  # pragma: no cover - defensive cleanup path
            await self.db.rollback()
            if pipeline_run_id is not None:
                try:
                    stale = await self.db.get(PipelineRun, pipeline_run_id)
                    if stale is not None:
                        await self.db.delete(stale)
                        await self.db.commit()
                except Exception:
                    await self.db.rollback()
            steps.append({"name": "exception", "status": "failed", "message": str(exc)})
            return {"success": False, "database_write_verified": False, "steps": steps}
