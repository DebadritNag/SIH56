import asyncio
import logging
from datetime import date
from uuid import UUID
from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.collection_orchestrator import CollectionOrchestrator
from app.services.ingestion_service import IngestionService
from app.services.reference_data_service import ReferenceDataService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.collection_tasks.schedule_collection_run")
def schedule_collection_run(trigger_type: str = "scheduled", triggered_by: str = None):
    """Executes scheduled batch matrix collection and triggers downstream processing."""
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
    async def _async_run():
        async with AsyncSessionLocal() as session:
            srv = IngestionService(session)
            pipe_run = await srv.process_collection_run(UUID(collection_run_id_str))
            return {"pipeline_run_id": str(pipe_run.id), "status": pipe_run.status}

    return asyncio.run(_async_run())


@celery_app.task(name="app.workers.reference_tasks.sync_all_government_references")
def sync_all_government_references():
    """Periodic task synchronizing official MoSPI eSankhyiki and DGCA reference data."""
    async def _async_run():
        async with AsyncSessionLocal() as session:
            ref_srv = ReferenceDataService(session)
            mospi = await ref_srv.sync_mospi_dataset()
            dgca = await ref_srv.sync_dgca_traffic()
            return {
                "mospi_dataset_id": str(mospi.id),
                "dgca_dataset_id": str(dgca.id),
                "status": "completed",
            }

    return asyncio.run(_async_run())
