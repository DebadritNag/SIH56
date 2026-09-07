"""Verify saved real probe evidence through ingestion; roll back all writes."""
import asyncio
import json
from pathlib import Path
from uuid import UUID
from unittest.mock import AsyncMock, patch
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import engine
from app.services.live_acquisition import enqueue_collection, execute_acquisition, enqueue_ingestion
from app.services.live_processing import process_live_fares
from app.services.live_store import rows

async def main():
    evidence = json.loads(Path('scratch/happyfares-probe.json').read_text())
    assert evidence['status'] == 'PASSED' and len(evidence['quotes']) == 5
    async with engine.connect() as conn:
        transaction = await conn.begin()
        try:
            async with AsyncSession(bind=conn, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                await db.execute(text(Path('supabase/migrations/20260907123000_happyfares_prototype.sql').read_text()))
                job = await enqueue_collection(db,dict(source='happyfares',origin='DEL',destination='BOM',departure_date='2026-09-08',booking_window_days=1,max_results=5,engine='AUTO'))
                run_id = UUID(job['collection_run_id'])
                pipeline = (await rows(db,'SELECT * FROM pipeline_runs WHERE id=:id',id=UUID(job['pipeline_run_id'])))[0]
                with patch('app.services.live_scraper.LiveScraper.run',AsyncMock(return_value=evidence)):
                    acquired = await execute_acquisition(db,pipeline)
                assert acquired['records_processed'] == 5
                handoff = await enqueue_ingestion(db,run_id)
                result = await process_live_fares(db,run_id,UUID(handoff['pipeline_run_id']))
                assert result['records_processed'] == 5, result
                persisted = await rows(db,"SELECT data_origin,base_fare FROM validated_fares WHERE collection_run_id=:id",id=run_id)
                assert all(q['data_origin']=='LIVE' and q['base_fare'] is None for q in persisted)
                raw = await rows(db,"SELECT raw_payload->'provenance'->>'source' AS source FROM raw_fares WHERE collection_run_id=:id",id=run_id)
                assert all(q['source']=='HappyFares' for q in raw)
                print('PASS: migration, 5 saved real quotes, durable handoff, canonical ingestion, HappyFares provenance')
        finally:
            await transaction.rollback()
            print('All verification writes rolled back')
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
