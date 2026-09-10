"""Queue one real HappyFares diagnostic through Celery, leaving evidence staged."""
import argparse
import asyncio
import json
from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from app.db.session import AsyncSessionLocal
from app.services.live_acquisition import enqueue_collection, get_live_run


async def main():
    from app.api.v1.live import LiveRequest
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', default='DEL')
    parser.add_argument('--destination', default='BOM')
    parser.add_argument('--departure', default=str(datetime.now(ZoneInfo('Asia/Kolkata')).date()+timedelta(days=7)))
    args = parser.parse_args()
    request = LiveRequest(source='happyfares', origin=args.origin, destination=args.destination, departure_date=args.departure, max_results=5)
    departure = request.departure_date
    days = (departure-datetime.now(ZoneInfo('Asia/Kolkata')).date()).days
    async with AsyncSessionLocal() as db:
        job = await enqueue_collection(db, dict(source='happyfares', origin=request.origin, destination=request.destination,
            departure_date=str(departure), booking_window_days=days, passengers=1, cabin='economy',
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
