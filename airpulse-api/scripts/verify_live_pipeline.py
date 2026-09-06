"""Integration check against configured PostgreSQL. ALL writes roll back.

Uses explicitly synthetic fixture evidence; never contacts a fare source and
never commits an observation, source change, model output, or index value.
Run: python -m scripts.verify_live_pipeline
"""
import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import engine
from app.core.utils import utc_now
from app.services.live_acquisition import enqueue_collection, enqueue_ingestion, execute_acquisition
from app.services.live_processing import process_live_fares
from app.services.live_store import rows


async def main():
    async with engine.connect() as conn:
        transaction = await conn.begin()
        try:
            async with AsyncSession(bind=conn, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                await db.execute(text("UPDATE sources SET last_failure_at=NULL WHERE name='yatra'"))
                today = utc_now().date()
                request = dict(source='yatra', origin='DEL', destination='BOM',
                    departure_date=str(today+timedelta(days=7)), booking_window_days=7, max_results=10, engine='AUTO')
                queued = await enqueue_collection(db,request)
                from uuid import UUID
                run_id = UUID(queued['collection_run_id'])
                job = (await rows(db,'SELECT * FROM pipeline_runs WHERE id=:id',id=UUID(queued['pipeline_run_id'])))[0]
                fixture = dict(carrier='Integration fixture airline',flight_number='TEST-ROLLBACK',origin='DEL',destination='BOM',
                    departure_date=request['departure_date'],departure_time='12:30',arrival_time='14:30',
                    gross_total=8765,currency='INR',cabin_class='economy',
                    provenance={'observed_at':utc_now().isoformat(),'test_fixture':True})
                with patch('app.services.live_scraper.LiveScraper.run',AsyncMock(return_value={'quotes':[fixture], 'stages':[], 'http_status':200})):
                    result = await execute_acquisition(db,job)
                assert result['records_processed']==1
                assert not await rows(db,'SELECT id FROM validated_fares WHERE collection_run_id=:id',id=run_id)
                handoff = await enqueue_ingestion(db,run_id)
                repeated = await enqueue_ingestion(db,run_id)
                assert handoff['pipeline_run_id']==repeated['pipeline_run_id']
                processed = await process_live_fares(db,run_id,UUID(handoff['pipeline_run_id']))
                assert processed['records_processed']==1, processed
                persisted = await rows(db,'SELECT base_fare,normalized_total_fare FROM validated_fares WHERE collection_run_id=:id',id=run_id)
                assert persisted[0]['base_fare'] is None
                assert float(persisted[0]['normalized_total_fare'])==8765
                print('PASS: acquisition staging, explicit handoff, idempotency, canonical persistence, unknown base fare')
                print('Processing stages:', [(s['stage'],s['status'],s['message']) for s in processed['stages']])
                # Verify the downstream success contract separately with explicit
                # model test doubles, never presented as real ML inference.
                from types import SimpleNamespace
                from uuid import uuid4
                import numpy as np
                from app.services.live_store import insert
                route = (await rows(db,"SELECT id FROM routes WHERE route_code='DEL-BOM'"))[0]['id']
                basket_id = uuid4()
                await db.execute(text("UPDATE index_baskets SET active=false"))
                await db.execute(text("""INSERT INTO index_baskets (id,name,version,base_period_start,base_period_end,active)
                    VALUES (:id,'ROLLBACK FIXTURE','rollback-fixture',:day,:day,true)"""),{'id':basket_id,'day':today-timedelta(days=1)})
                await db.execute(text("""INSERT INTO index_basket_routes (id,basket_id,route_id,booking_window_days,weight)
                    VALUES (:id,:basket,:route,7,1)"""),{'id':uuid4(),'basket':basket_id,'route':route})
                canonical = (await rows(db,'SELECT * FROM validated_fares WHERE collection_run_id=:id',id=run_id))[0]
                baseline = await insert(db,'validated_fares',raw_fare_id=canonical['raw_fare_id'],collection_run_id=run_id,
                    source_id=canonical['source_id'],route_id=route,data_origin='IMPORTED',airline='ROLLBACK FIXTURE',
                    origin='DEL',destination='BOM',departure_at=canonical['departure_at'],booking_window_days=7,
                    cabin='economy',total_fare=5000,normalized_total_fare=5000,currency='INR',validation_status='VALID',
                    quote_hash=str(uuid4()),is_duplicate=False,collected_at=utc_now()-timedelta(days=1))
                await insert(db,'fare_index_eligibility',fare_id=baseline,eligible=True,reason_code='VALID',methodology_version='rollback-fixture')
                # Change only fixture identity so this is a second distinct quote.
                fixture['flight_number']='TEST-ROLLBACK-2'
                job['id'] = await insert(db,'pipeline_runs',collection_run_id=run_id,pipeline_type='live_acquisition',status='RUNNING',metadata=job['metadata'])
                handoff['pipeline_run_id'] = str(await insert(db,'pipeline_runs',collection_run_id=run_id,pipeline_type='live_ingestion',status='RUNNING'))
                with patch('app.services.live_scraper.LiveScraper.run',AsyncMock(return_value={'quotes':[fixture], 'stages':[]})):
                    await execute_acquisition(db,job)
                fg = SimpleNamespace(is_trained=True,version='TEST-DOUBLE',predict_batch=lambda frame: np.full(len(frame),1000.0))
                pg = SimpleNamespace(is_trained=True,training_scores=np.array([0.1]),score_batch=lambda frame: [dict(
                    is_anomaly=True,severity='HIGH',anomaly_type='unusually_high',isolation_score=0.2,anomaly_percentile=0.9) for _ in range(len(frame))])
                xp = SimpleNamespace(explainer=True,explain_fare=lambda *args: {'base_value':1000,'predicted_fare':1000,'drivers':[]})
                with patch('app.ml.model_registry.ModelRegistryService.get_fareguard',return_value=fg), patch('app.ml.model_registry.ModelRegistryService.get_priceguard',return_value=pg), patch('app.ml.model_registry.ModelRegistryService.get_explainer',return_value=xp):
                    completed = await process_live_fares(db,run_id,UUID(handoff['pipeline_run_id']))
                assert completed['fareguard_scored']==completed['priceguard_scored']==completed['shap_count']==1, completed
                assert completed['index']['status']=='COMPLETED', completed
                assert await rows(db,'SELECT id FROM alerts WHERE metadata->>\'pipeline_run_id\'=:id',id=handoff['pipeline_run_id'])
                print('PASS: test-double prediction, anomaly, SHAP, alert writes; actual observed-base index calculation; dedup')
                # Exercise response serialization through FastAPI without
                # starting the production lifespan/worker.
                import httpx
                from app.main import app
                from app.db.session import get_db
                from app.core.security import require_viewer, UserContext
                async def test_db():
                    yield db
                app.dependency_overrides[get_db] = test_db
                app.dependency_overrides[require_viewer] = lambda: UserContext(user_id=str(uuid4()))
                try:
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                        fare_id = (await rows(db,'SELECT id FROM validated_fares WHERE collection_run_id=:id AND NOT is_duplicate ORDER BY created_at DESC LIMIT 1',id=run_id))[0]['id']
                        for endpoint in [f'/live/runs/{run_id}',f'/fares/{fare_id}','/index/latest',
                                         f"/index/{completed['index']['index_id']}/components",'/dashboard/summary']:
                            response = await client.get('/api/v1'+endpoint)
                            assert response.status_code==200, (endpoint,response.text[:300])
                    print('PASS: live detail, fare provenance, index, components and dashboard HTTP responses')
                finally:
                    app.dependency_overrides.clear()
        finally:
            await transaction.rollback()
            print('All integration writes rolled back')
    await engine.dispose()


if __name__=='__main__':
    asyncio.run(main())
