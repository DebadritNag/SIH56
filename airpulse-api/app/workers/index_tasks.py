import asyncio
import logging
from datetime import date
from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.index_engine import IndexEngine

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.index_tasks.calculate_daily_index_task")
def calculate_daily_index_task(target_date_str: str = None):
    """Calculates official daily national and route APIx series."""
    async def _async_run():
        target_date = date.fromisoformat(target_date_str) if target_date_str else date.today()
        async with AsyncSessionLocal() as session:
            engine = IndexEngine(session)
            index_record = await engine.calculate_daily_index(target_date)
            await session.commit()
            return {
                "index_id": str(index_record.id),
                "index_value": index_record.index_value,
                "coverage_score": index_record.coverage_quality_score,
            }

    return asyncio.run(_async_run())
