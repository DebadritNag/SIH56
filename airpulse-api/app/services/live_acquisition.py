"""Durable, bounded live acquisition and explicit canonical-ingestion gateway.

Jobs live in PostgreSQL, not a browser request or Render's ephemeral filesystem.
The embedded consumer supports the existing single Render service; the same
consumer can run as a dedicated worker without changing the API.
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import text
from app.core.utils import utc_now
from app.db.session import AsyncSessionLocal
from app.services.live_store import rows, insert, audit

logger = logging.getLogger(__name__)


async def enqueue_collection(db, request, actor=None):
    sources = await rows(db, """SELECT * FROM sources WHERE enabled AND active
        AND metadata->>'live_prototype'='true' ORDER BY priority,id""")
    if not sources:
        raise ValueError('No enabled live prototype source. Apply the live acquisition migration.')
    source = next((s for s in sources if s['name']==request.get('source','yatra')), None)
    if source is None:
        raise ValueError('Requested source is not an enabled live prototype')
    # Serialize launch decisions per source across workers; prevent duplicate busy runs.
    source = (await rows(db, 'SELECT * FROM sources WHERE id=:id FOR UPDATE', id=source['id']))[0]
    busy = await rows(db, """SELECT p.id FROM pipeline_runs p JOIN collection_runs c ON c.id=p.collection_run_id
        WHERE c.source_id=:source AND p.pipeline_type='live_acquisition' AND p.status IN ('QUEUED','RUNNING') LIMIT 1""", source=source['id'])
    if busy:
        raise ValueError('A collection for this source is already queued or running')
    cooldown = source.get('last_failure_at')
    if cooldown and utc_now()-cooldown < timedelta(minutes=5):
        raise ValueError('Source cooling down after a failed attempt; wait five minutes')
    run_id = uuid4()
    await insert(db,'collection_runs',id=run_id,source_id=source['id'],run_type='LIVE_ACQUISITION',
        data_origin='LIVE',trigger_type='MANUAL',triggered_by=actor,status='QUEUED',
        routes_requested=1,searches_requested=1,metadata={'request':request,'ingestion_state':'ACQUIRING'})
    job_id = await insert(db,'pipeline_runs',collection_run_id=run_id,pipeline_type='live_acquisition',
        status='QUEUED',metadata={'request':request})
    await audit(db,run_id,'LIVE_COLLECTION_QUEUED',{'pipeline_run_id':str(job_id)},actor)
    await db.commit()
    return {'collection_run_id':str(run_id),'pipeline_run_id':str(job_id),'status':'QUEUED'}


async def enqueue_ingestion(db, run_id, actor=None):
    result = await rows(db,"SELECT * FROM collection_runs WHERE id=:id AND run_type='LIVE_ACQUISITION' FOR UPDATE",id=run_id)
    if not result:
        raise ValueError('Live collection run not found')
    run = result[0]
    meta = run['metadata'] or {}
    existing = meta.get('ingestion_run_id')
    if existing:
        previous = await rows(db,'SELECT status FROM pipeline_runs WHERE id=:id',id=UUID(existing))
        if not previous or previous[0]['status'] != 'FAILED':
            return {'collection_run_id':str(run_id),'pipeline_run_id':existing,'status':meta['ingestion_state']}
    if meta.get('ingestion_state') != 'READY_FOR_INGESTION' and not (existing and meta.get('ingestion_state') == 'FAILED' and run['quotes_received']):
        raise ValueError('Collection has no staged live observations ready for ingestion')
    job_id = await insert(db,'pipeline_runs',collection_run_id=run_id,pipeline_type='live_ingestion',status='QUEUED',
        records_input=run['quotes_received'],metadata={'data_origin':'LIVE'})
    await db.execute(text("""UPDATE collection_runs SET metadata=metadata || CAST(:meta AS jsonb) WHERE id=:id"""),
        {'id':run_id,'meta':json.dumps({'ingestion_state':'QUEUED','ingestion_run_id':str(job_id)})})
    await audit(db,run_id,'LIVE_SENT_TO_INGESTION',{'pipeline_run_id':str(job_id)},actor)
    await db.commit()
    return {'collection_run_id':str(run_id),'pipeline_run_id':str(job_id),'status':'QUEUED'}


async def get_live_run(db, run_id):
    result = await rows(db,"SELECT * FROM collection_runs WHERE id=:id AND run_type='LIVE_ACQUISITION'",id=run_id)
    if not result:
        raise ValueError('Live collection run not found')
    run = result[0]
    run['pipelines'] = await rows(db,'SELECT * FROM pipeline_runs WHERE collection_run_id=:id ORDER BY created_at',id=run_id)
    run['stages'] = await rows(db,"""SELECT s.* FROM pipeline_steps s JOIN pipeline_runs p ON p.id=s.pipeline_run_id
        WHERE p.collection_run_id=:id ORDER BY p.created_at,s.step_order,s.created_at""",id=run_id)
    for stage in run['stages']:
        stage['status'] = (stage.get('metadata') or {}).get('outcome', stage['status'])
    run['quotes'] = await rows(db,'SELECT id,collected_at,response_hash,raw_payload FROM raw_fares WHERE collection_run_id=:id ORDER BY created_at,id LIMIT 15',id=run_id)
    return run


async def execute_acquisition(db, job):
    from app.services.live_scraper import LiveScraper
    from app.schemas.runs import SearchRequest
    run_id = job['collection_run_id']
    run = (await rows(db,'SELECT * FROM collection_runs WHERE id=:id',id=run_id))[0]
    source = (await rows(db,'SELECT * FROM sources WHERE id=:id',id=run['source_id']))[0]
    request = SearchRequest(**job['metadata']['request'])
    started = utc_now()
    result = await LiveScraper().run(source_name=source['name'],source_type='ota',
        source_id=str(source['id']),collection_run_id=str(run_id),origin=request.origin,destination=request.destination,
        departure=request.departure_date,booking_window_days=request.booking_window_days,
        max_results=request.max_results,engine=job['metadata']['request'].get('engine','AUTO'),is_nonstop=request.is_nonstop)
    # Claim row remains locked until the observed evidence and final state are committed.
    quotes = result.get('quotes',[])[:15]
    count = 0
    for q in quotes:
        if not q.get('gross_total') or q.get('gross_total',0)<=0 or not q.get('provenance',{}).get('observed_at'):
            continue
        provenance = {**q['provenance'],'collection_run_id':str(run_id),'source':'Yatra'}
        payload = {**q,'provenance':provenance}
        checksum = hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        await insert(db,'raw_fares',collection_run_id=run_id,source_id=source['id'],data_origin='LIVE',
            origin_requested=request.origin,destination_requested=request.destination,
            departure_requested=request.departure_date,booking_window_requested=request.booking_window_days,
            collected_at=datetime.fromisoformat(provenance['observed_at'].replace('Z','+00:00')),http_status=result.get('http_status'),raw_payload=payload,response_hash=checksum,
            collector_version=result.get('collector_version','yatra-homepage-v1'),parser_version='yatra-homepage-v1')
        count += 1
    state = 'READY_FOR_INGESTION' if count else 'FAILED'
    result.pop('quotes',None)
    result.update(ready_for_ingestion=bool(count),raw_rows=count)
    if count:
        result.update(status='COMPLETED', recommended_remediation='Raw observations saved. Send to ingestion to update analytics.')
    for i, st in enumerate(result.get('stages',[])):
        if st['stage'] == 'RAW_STORAGE':
            continue
        await insert(db,'pipeline_steps',pipeline_run_id=job['id'],step_name=st['stage'],step_order=i,
            status={'PASS':'COMPLETED','FAIL':'FAILED','PASSED':'COMPLETED'}.get(st['status'].upper(),st['status'].upper()),finished_at=utc_now(),
            records_output=count if st['stage']=='RAW_STORAGE' else 0,message=st.get('detail'))
    await insert(db,'pipeline_steps',pipeline_run_id=job['id'],step_name='RAW_STORAGE',step_order=99,
        status='COMPLETED' if count else 'SKIPPED',started_at=started,finished_at=utc_now(),records_output=count,
        message=f'{count} immutable raw live observations persisted')
    await db.execute(text("""UPDATE collection_runs SET status=CAST(:status AS collection_run_status),finished_at=now(),
        quotes_received=:count,requests_successful=:success,requests_failed=:failure,
        metadata=metadata || CAST(:meta AS jsonb) WHERE id=:id"""),
        {'id':run_id,'status':'COMPLETED' if count else 'FAILED','count':count,'success':int(bool(count)),
         'failure':int(not count),'meta':json.dumps({'ingestion_state':state,'result':result},default=str)})
    await db.execute(text("""UPDATE sources SET last_success_at=CASE WHEN :ok THEN now() ELSE last_success_at END,
        last_failure_at=CASE WHEN :ok THEN last_failure_at ELSE now() END,
        consecutive_failures=CASE WHEN :ok THEN 0 ELSE coalesce(consecutive_failures,0)+1 END WHERE id=:id"""),
        {'id':source['id'],'ok':bool(count)})
    await audit(db,run_id,'LIVE_ACQUIRED' if count else 'LIVE_COLLECTION_FAILED',result)
    return {'records_processed':count,'records_failed':int(not count),'status':'COMPLETED' if count else 'FAILED','result':result}


async def consume_one(session_factory=AsyncSessionLocal):
    async with session_factory() as db:
        # A crashed process must not silently repeat a source request. Active jobs
        # retain a row lock and are skipped by this bounded stale-job recovery.
        stale = await rows(db,"""SELECT id,collection_run_id FROM pipeline_runs
            WHERE pipeline_type IN ('live_acquisition','live_ingestion') AND status='RUNNING'
            AND started_at < now()-interval '10 minutes' FOR UPDATE SKIP LOCKED""")
        for old in stale:
            await db.execute(text("UPDATE pipeline_runs SET status='FAILED',finished_at=now(),error_summary='Worker interrupted; no automatic retry' WHERE id=:id"),{'id':old['id']})
            await db.execute(text("""UPDATE collection_runs SET status='FAILED',finished_at=now(),
                metadata=metadata || '{"ingestion_state":"FAILED"}'::jsonb WHERE id=:id"""),{'id':old['collection_run_id']})
        await db.commit()
        jobs = await rows(db,"""SELECT * FROM pipeline_runs WHERE pipeline_type IN ('live_acquisition','live_ingestion')
            AND status='QUEUED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1""")
        if not jobs:
            return False
        job = jobs[0]
        # Commit the claim so API polling can see RUNNING. No canonical record
        # becomes visible until the following processing transaction commits.
        try:
            await db.execute(text("UPDATE pipeline_runs SET status='RUNNING',started_at=now() WHERE id=:id"),{'id':job['id']})
            if job['pipeline_type']=='live_acquisition':
                await db.execute(text("UPDATE collection_runs SET status='RUNNING',started_at=now() WHERE id=:id"),{'id':job['collection_run_id']})
            await db.commit()
            await rows(db,'SELECT id FROM pipeline_runs WHERE id=:id FOR UPDATE',id=job['id'])
            if job['pipeline_type']=='live_acquisition':
                result = await asyncio.wait_for(execute_acquisition(db,job),timeout=180)
            else:
                from app.services.live_processing import process_live_fares
                # Serialize canonical dedup and index writes across consumers.
                await db.execute(text('SELECT pg_advisory_xact_lock(26056)'))
                result = await asyncio.wait_for(process_live_fares(db,job['collection_run_id'],job['id']),timeout=240)
                result['status'] = ('FAILED' if result['records_failed'] and not result['records_processed'] else
                    'PARTIAL' if result['records_failed'] or any(s['status']=='SKIPPED' for s in result['stages']) else 'COMPLETED')
                await db.execute(text("""UPDATE collection_runs SET quotes_validated=:count,quotes_rejected=:failed,
                    duplicates_detected=:dupes,metadata=metadata || CAST(:meta AS jsonb) WHERE id=:id"""),
                    {'id':job['collection_run_id'],'count':result['records_processed'],'failed':result['records_failed'],
                     'dupes':result['duplicates'],'meta':json.dumps({'ingestion_state':result['status'],'processing':result,
                         'published_dashboard':result['records_processed']>0},default=str)})
            await db.execute(text("""UPDATE pipeline_runs SET status=CAST(:status AS pipeline_status),finished_at=now(),
                records_processed=:count,records_failed=:failed,metadata=metadata || CAST(:meta AS jsonb) WHERE id=:id"""),
                {'id':job['id'],'status':result['status'],'count':result['records_processed'],
                 'failed':result['records_failed'],'meta':json.dumps({'result':result},default=str)})
            await db.commit()
        except asyncio.CancelledError:
            await db.rollback()
            raise
        except Exception as exc:
            await db.rollback()
            logger.exception('Live job failed: %s',job['id'])
            await db.execute(text("""UPDATE pipeline_runs SET status='FAILED',finished_at=now(),error_summary=:error WHERE id=:id"""),
                             {'id':job['id'],'error':str(exc)[:1000]})
            await db.execute(text("""UPDATE collection_runs SET status='FAILED',finished_at=now(),metadata=metadata || '{"ingestion_state":"FAILED"}'::jsonb WHERE id=:id"""),
                             {'id':job['collection_run_id']})
            await audit(db,job['collection_run_id'],'LIVE_JOB_FAILED',{'pipeline_run_id':str(job['id']),'error':str(exc)[:300]})
            await db.commit()
    return True


async def worker_loop():
    while True:
        try:
            worked = await consume_one()
            await asyncio.sleep(0.1 if worked else 2)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('Live worker unavailable; queued jobs remain durable')
            await asyncio.sleep(10)
