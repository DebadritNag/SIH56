"""Queue one real HappyFares diagnostic through Celery, leaving evidence staged."""
import asyncio
import json
from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from app.db.session import AsyncSessionLocal
from app.services.live_acquisition import enqueue_collection, get_live_run


async def main():
    departure = datetime.now(ZoneInfo('Asia/Kolkata')).date() + timedelta(days=7)
    async with AsyncSessionLocal() as db:
        job = await enqueue_collection(db, dict(source='happyfares', origin='DEL', destination='BOM',
            departure_date=str(departure), booking_window_days=7, passengers=1, cabin='economy',
            currency='INR', max_results=5, engine='CRAWL4AI'))
    print(json.dumps({'run_id':job['collection_run_id'], 'status':'QUEUED', 'source':'HappyFares', 'engine':'CRAWL4AI'}), flush=True)
    for _ in range(100):
        await asyncio.sleep(3)
        async with AsyncSessionLocal() as db:
            run = await get_live_run(db, UUID(job['collection_run_id']))
        if run['status'] not in ('QUEUED', 'RUNNING'):
            result = (run.get('metadata') or {}).get('result') or {}
            print(json.dumps(dict(run_id=str(run['id']), status=result.get('status', run['status']),
                observation_count=run['quotes_received'], source='HappyFares', engine='CRAWL4AI',
                errors=result.get('failure_reason') or [p.get('error_summary') for p in run['pipelines'] if p.get('error_summary')]), default=str))
            return 0 if run['quotes_received'] else 1
    print(json.dumps({'run_id':job['collection_run_id'], 'status':'TIMEOUT', 'observation_count':0,
        'source':'HappyFares','engine':'CRAWL4AI','errors':'Worker not finished within five minutes; inspect this run before another attempt'}))
    return 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
