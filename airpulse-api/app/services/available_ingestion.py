"""Process available real observations without initiating a network collection."""
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.config import settings

from app.db.models import ValidatedFare
from app.services.live_acquisition import enqueue_ingestion
from app.services.live_store import rows


async def available_counts(db):
    result = await db.execute(select(ValidatedFare.data_origin, func.count(ValidatedFare.id))
                             .where(ValidatedFare.data_origin.in_(['IMPORTED', 'LIVE']))
                             .group_by(ValidatedFare.data_origin))
    return {str(origin): count for origin, count in result.all()}


async def run_available_ingestion(db, on_progress=None):
    # Durable live ingestion retains the original collection and raw evidence.
    staged = await rows(db, """SELECT id,quotes_received FROM collection_runs
        WHERE run_type='LIVE_ACQUISITION' AND quotes_received>0
          AND metadata->>'ingestion_state'='READY_FOR_INGESTION'
        ORDER BY created_at""")
    if staged and not settings.LIVE_WORKER_ENABLED:
        raise HTTPException(503, 'Live ingestion worker is disabled. Enable LIVE_WORKER_ENABLED before processing staged fares.')
    queued = []

    counts = await available_counts(db)
    if on_progress:
        await on_progress({'observation_count': sum(counts.values()) + sum(r['quotes_received'] for r in staged), 'total_stages': (10 if sum(counts.values()) else 0) + 10*len(staged), 'current_stage': 'WAITING_FOR_PIPELINE_LOCK'})
    result = dict(status='NO_DATA', quotes_received=0, quotes_validated=0, stages=[])
    if sum(counts.values()):
        from app.services.dataset_orchestrator import DatasetIngestionOrchestrator
        # Keep the orchestrator's intermediate commits inside savepoints. Only
        # publish the complete transaction, serialized with live ingestion.
        await db.execute(text('SELECT pg_advisory_xact_lock(26056)'))
        async with AsyncSession(bind=await db.connection(), join_transaction_mode='create_savepoint',
                                expire_on_commit=False) as processing:
            result = await DatasetIngestionOrchestrator(processing).run_pipeline(
                dataset_name='Available imported and live observations',
                original_filename='existing-observations', data_origin='IMPORTED',
                pipeline_mode='LIVE_PROCESSING', trigger_type='MANUAL', reprocess_existing_fares=True, on_progress=on_progress)
        if result.get('quotes_validated', 0) > 0:
            await db.execute(text("""UPDATE collection_runs
                SET metadata=COALESCE(metadata, '{}'::jsonb) || CAST(:publication AS jsonb)
                WHERE id=CAST(:id AS uuid)"""), {'id': result['collection_run_id'],
                                               'publication': '{"published_dashboard": true}'})
            await db.commit()
    for run in staged:
        queued.append(await enqueue_ingestion(db, run['id']))
    result['input_counts'] = counts
    result['live_ingestion_jobs'] = queued
    if queued:
        result['status'] = 'PROCESSING'
    return result


async def dashboard_readiness(db):
    from app.services.data_context_resolver import DataContextResolver
    ctx = await DataContextResolver(db).resolve()
    return {'ready': ctx.is_populated(), 'counts': {'LIVE': ctx.live_count, 'IMPORTED': ctx.imported_count},
            'observations': ctx.total_eligible, 'revision': f'{ctx.latest_ingested_at}:{ctx.latest_pipeline_run_id}:{ctx.latest_apix_computed_at}'}
