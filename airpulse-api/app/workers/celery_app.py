from celery import Celery
from app.config import settings

celery_app = Celery(
    "airpulse_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)

# Celery Beat Periodic Schedule
celery_app.conf.beat_schedule = {
    "run-collection-pipeline-every-3h": {
        "task": "app.workers.collection_tasks.run_scheduled_collection",
        "schedule": settings.COLLECTION_INTERVAL_HOURS * 3600.0,
    },
    "run-source-health-every-15m": {
        "task": "app.workers.health_tasks.check_all_sources_health",
        "schedule": settings.SOURCE_HEALTH_INTERVAL_MINUTES * 60.0,
    },
    "calculate-daily-apix-index": {
        "task": "app.workers.index_tasks.calculate_daily_index_task",
        "schedule": 86400.0,  # Once daily
    },
}
