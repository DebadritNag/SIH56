"""Ephemeral operational progress; durable timing remains in pipeline_runs/steps."""
import json
import logging
from app.config import settings

STAGES = ['INGEST', 'NORMALIZE', 'VALIDATE', 'DEDUP', 'FEATURES', 'FAREGUARD', 'PRICEGUARD', 'SHAP', 'APIX', 'ALERTS']
logger = logging.getLogger(__name__)


async def snapshot(operation_id, actor, value=None):
    from redis.asyncio import Redis
    try:
        async with Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1) as redis:
            key = f'airpulse:ingestion-progress:{actor}:{operation_id}'
            if value is not None:
                await redis.set(key, json.dumps(value, default=str), ex=86400)
                return value
            raw = await redis.get(key)
            return json.loads(raw) if raw else None
    except Exception:
        logger.warning('Ingestion telemetry unavailable for %s', operation_id)
        return None
