import asyncio
import logging
from datetime import date
from uuid import UUID
from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(name='app.workers.collection_tasks.collect_staged_live_task', max_retries=0, acks_late=False)
def collect_staged_live_task(job_id: str):
    """Consume the durable raw-staging job only; never dispatch analytics."""
    from app.services.live_acquisition import consume_one
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy.pool import NullPool
    from app.config import settings
    async def run():
        # Celery's asyncio.run creates a new loop for each task.
        from app.db.session import _build_connect_args
        engine = create_async_engine(settings.effective_pool_url, poolclass=NullPool, connect_args=_build_connect_args())
        try:
            return await consume_one(async_sessionmaker(engine, expire_on_commit=False), UUID(job_id))
        finally:
            await engine.dispose()
    return asyncio.run(run())


@celery_app.task(name="app.workers.collection_tasks.schedule_collection_run")
def schedule_collection_run(trigger_type: str = "scheduled", triggered_by: str = None):
    """Executes scheduled batch matrix collection and triggers downstream processing."""
    from app.services.collection_orchestrator import CollectionOrchestrator
    async def _async_run():
        async with AsyncSessionLocal() as session:
            orchestrator = CollectionOrchestrator(session)
            col_run = await orchestrator.execute_batch_collection(
                trigger_type=trigger_type,
                triggered_by=triggered_by,
            )
            # Enqueue processing task for this collection run
            process_collection_run_task.delay(str(col_run.id))
            return {"collection_run_id": str(col_run.id), "status": col_run.status}

    return asyncio.run(_async_run())


@celery_app.task(name="app.workers.collection_tasks.process_collection_run_task")
def process_collection_run_task(collection_run_id_str: str):
    """Batched downstream processing: normalization, validation, deduplication, ML, APIx."""
    from app.services.ingestion_service import IngestionService
    async def _async_run():
        async with AsyncSessionLocal() as session:
            srv = IngestionService(session)
            pipe_run = await srv.process_collection_run(UUID(collection_run_id_str))
            return {"pipeline_run_id": str(pipe_run.id), "status": pipe_run.status}

    return asyncio.run(_async_run())


@celery_app.task(name="app.workers.reference_tasks.sync_all_government_references")
def sync_all_government_references():
    """Periodic task synchronizing official MoSPI eSankhyiki and DGCA reference data."""
    from app.services.reference_data_service import ReferenceDataService
    async def _async_run():
        async with AsyncSessionLocal() as session:
            ref_srv = ReferenceDataService(session)
            return await ref_srv.sync_mospi_datasets(trigger_type="scheduled")

    return asyncio.run(_async_run())
