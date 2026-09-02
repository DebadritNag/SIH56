import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.db.models import (
    CollectionRun,
    PipelineRun,
    PipelineStep,
    Route,
    Source,
)
from app.schemas.runs import SearchRequest
from app.collectors.registry import CollectorRegistry
from app.collectors.synthetic_collector import SyntheticCollector
from app.collectors.replay_collector import ReplayCollector

logger = logging.getLogger(__name__)


class CollectionOrchestrator:
    """Orchestrates scheduled and manual batch search matrix execution:
    Generates [Route x Booking-Window x Source] combinations.
    Handles partial failures gracefully: if 1 of 4 sources fails, marks run 'partial' rather than aborting."""

    STANDARD_BOOKING_WINDOWS = [1, 7, 15, 30, 45]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute_batch_collection(
        self,
        source_id: Optional[UUID] = None,
        trigger_type: str = "scheduled",
        triggered_by: Optional[str] = None,
        routes_subset: Optional[List[UUID]] = None,
    ) -> CollectionRun:
        # 1. Fetch target sources
        if source_id:
            src_query = select(Source).where(Source.id == source_id, Source.enabled == True)
        else:
            src_query = select(Source).where(Source.enabled == True, Source.active == True)
        sources = list((await self.session.execute(src_query)).scalars().all())

        if not sources:
            # Register a default synthetic collector source if none found
            default_src = Source(
                id=uuid4(),
                name="AirPulse Synthetic Market Feed",
                display_name="Synthetic Demonstration Source",
                source_type="synthetic",
                enabled=True,
                active=True,
                collection_method="synthetic",
                reliability_score=1.0,
            )
            self.session.add(default_src)
            await self.session.flush()
            sources = [default_src]

        # 2. Fetch target routes
        route_query = select(Route).where(Route.active == True)
        if routes_subset:
            route_query = route_query.where(Route.id.in_(routes_subset))
        routes = list((await self.session.execute(route_query)).scalars().all())

        col_run = CollectionRun(
            id=uuid4(),
            source_id=sources[0].id if len(sources) == 1 else None,
            run_type="batch_matrix_search",
            started_at=utc_now(),
            status="running",
            routes_requested=len(routes),
            searches_requested=len(routes) * len(self.STANDARD_BOOKING_WINDOWS) * len(sources),
            trigger_type=trigger_type,
            triggered_by=triggered_by,
        )
        self.session.add(col_run)
        await self.session.flush()

        # Initialize PipelineRun for execution logging
        pipe_run = PipelineRun(
            id=uuid4(),
            collection_run_id=col_run.id,
            pipeline_type="collection",
            started_at=utc_now(),
            status="running",
            version="1.0.0",
        )
        self.session.add(pipe_run)

        collect_step = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="COLLECT",
            status="running",
            started_at=utc_now(),
            records_input=col_run.searches_requested,
        )
        self.session.add(collect_step)
        await self.session.flush()

        # 3. Execute Searches across the matrix
        total_quotes = 0
        successful_requests = 0
        failed_requests = 0
        today = date.today()

        raw_records_to_insert = []

        for src in sources:
            # Build the correct collector for this source (live airline via Playwright,
            # synthetic, replay, or static HTTP). Live airline adapters raise a precise
            # ScraperError when their selectors are disabled rather than faking data.
            collector = CollectorRegistry.build_for_source(
                source_id=str(src.id),
                source_name=src.name,
                source_type=str(getattr(src, "source_type", "") or ""),
                collection_method=str(getattr(src, "collection_method", "") or ""),
                base_url=getattr(src, "base_url", None),
                rate_limit_per_minute=getattr(src, "rate_limit_per_minute", None) or 60,
                timeout_seconds=getattr(src, "timeout_seconds", None) or 30,
                max_retries=getattr(src, "max_retries", None) or 3,
            )

            for r in routes:
                for window in self.STANDARD_BOOKING_WINDOWS:
                    dep_date = today + timedelta(days=window)
                    req = SearchRequest(
                        origin=r.origin_code,
                        destination=r.destination_code,
                        departure_date=dep_date,
                        booking_window_days=window,
                        source_id=src.id,
                        collection_run_id=col_run.id,
                    )
                    try:
                        quotes = await collector.collect(req)
                        successful_requests += 1
                        for q in quotes:
                            env = collector.create_raw_envelope(req, q, str(col_run.id))
                            raw_records_to_insert.append((env, r.id, src.id))
                        total_quotes += len(quotes)
                    except Exception as ex:
                        failed_requests += 1
                        logger.error(f"Search failed for {src.name} on {r.route_code} (T+{window}): {ex}")
                        src.consecutive_failures += 1
                        src.last_failure_at = utc_now()

            if failed_requests == 0:
                src.last_success_at = utc_now()
                src.consecutive_failures = 0

        # Save raw fares in bulk through IngestionService
        from app.services.ingestion_service import IngestionService
        ingestion_srv = IngestionService(self.session)
        created_raw = await ingestion_srv.save_raw_fares_bulk(raw_records_to_insert, col_run.id)

        # Finalize collection status
        col_run.requests_successful = successful_requests
        col_run.requests_failed = failed_requests
        col_run.quotes_received = len(created_raw)
        col_run.finished_at = utc_now()
        col_run.duration_ms = int((col_run.finished_at - col_run.started_at).total_seconds() * 1000)

        if failed_requests == 0:
            col_run.status = "completed"
        elif successful_requests > 0:
            col_run.status = "partial"
        else:
            col_run.status = "failed"

        collect_step.status = "completed" if col_run.status != "failed" else "failed"
        collect_step.finished_at = utc_now()
        collect_step.records_output = len(created_raw)
        collect_step.records_failed = failed_requests
        collect_step.duration_ms = col_run.duration_ms
        collect_step.message = f"Collected {len(created_raw)} raw fares across {successful_requests} search requests."

        pipe_run.status = col_run.status
        pipe_run.records_input = col_run.searches_requested
        pipe_run.records_processed = len(created_raw)
        pipe_run.records_failed = failed_requests
        pipe_run.finished_at = utc_now()

        await self.session.commit()
        return col_run
