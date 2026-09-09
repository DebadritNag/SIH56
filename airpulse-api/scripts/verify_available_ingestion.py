"""Exercise existing observations; all database changes are rolled back."""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import engine
from app.services.available_ingestion import dashboard_readiness, run_available_ingestion
from app.services.live_store import rows

async def main():
    async with engine.connect() as conn:
        transaction = await conn.begin()
        try:
            async with AsyncSession(bind=conn, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                before = await rows(db, 'SELECT id, source_id, collection_run_id, data_origin, quote_hash FROM validated_fares ORDER BY id')
                readiness = await dashboard_readiness(db)
                print('Before:', readiness)
                result = await run_available_ingestion(db)
                after = await rows(db, 'SELECT id, source_id, collection_run_id, data_origin, quote_hash FROM validated_fares ORDER BY id')
                assert before == after, 'Existing observation lineage changed'
                assert result['quotes_validated'] > 0, result
                assert (await dashboard_readiness(db))['ready']
                from app.services.provenance_service import ProvenanceService
                for fare in before:
                    provenance = await ProvenanceService(db).get_fare_provenance(fare['id'])
                    assert provenance['ingestion_run_id'] == result['collection_run_id']
                    assert provenance['pipeline_run_id']
                from uuid import UUID
                from app.api.v1.ingestion import get_collection_run_detail
                detail = await get_collection_run_detail(UUID(result['collection_run_id']), db=db, current_user=None)
                detail.model_dump(mode='json')
                assert result['status'] == 'PARTIAL' if any(s['status'] != 'COMPLETED' for s in result['stages']) else result['status'] == 'COMPLETED'
                print('PASS: existing observations processed, provenance preserved, dashboard published inside rollback transaction')
                print('Stages:', [(s['step_name'], s['status'], s['records_output']) for s in result['stages']])
        finally:
            await transaction.rollback()
            print('All verification writes rolled back')
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
