from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
from uuid import uuid4
import pytest

@pytest.mark.asyncio
async def test_progress_is_actor_scoped_and_missing_is_unknown():
    from app.api.v1.ingestion import ingestion_progress
    actor=SimpleNamespace(user_id='viewer-a')
    operation=uuid4()
    with patch('app.services.ingestion_progress.snapshot', AsyncMock(return_value=None)) as snapshot:
        result=await ingestion_progress(operation,AsyncMock(),actor)
    assert result.data['status']=='UNKNOWN'
    snapshot.assert_awaited_once_with(operation,'viewer-a')

@pytest.mark.asyncio
@pytest.mark.parametrize('state,expected',[('RUNNING','RUNNING'),('COMPLETED','COMPLETED'),('FAILED','FAILED')])
async def test_live_jobs_require_backend_terminal_status(state,expected):
    from app.api.v1.ingestion import ingestion_progress
    progress={'status':'RUNNING','completed_stages':10,'base_completed_stages':10,'total_stages':20,'live_ingestion_jobs':[{'collection_run_id':str(uuid4())}]}
    with patch('app.services.ingestion_progress.snapshot', AsyncMock(return_value=progress)), patch('app.services.live_store.rows',AsyncMock(return_value=[{'state':state}])):
        result=await ingestion_progress(uuid4(),AsyncMock(),SimpleNamespace(user_id='viewer'))
    assert result.data['status']==expected
    assert result.data['completed_stages']==(20 if expected=='COMPLETED' else 10)

@pytest.mark.asyncio
async def test_history_uses_existing_tables_without_writes():
    from app.api.v1.ingestion import ingestion_timing_history
    pid=uuid4()
    db=AsyncMock()
    with patch('app.services.live_store.rows',AsyncMock(side_effect=[[{'id':pid,'observation_count':80,'duration_seconds':40}],[{'pipeline_run_id':pid,'step_name':'FAREGUARD','duration_ms':20000}]])) as rows:
        result=await ingestion_timing_history(db,None)
    assert result.data['runs'][0]['stage_seconds']=={'FAREGUARD':20}
    assert 'pipeline_runs' in rows.await_args_list[0].args[1]
    assert 'pipeline_steps' in rows.await_args_list[1].args[1]
    db.commit.assert_not_awaited()

@pytest.mark.asyncio
async def test_telemetry_outage_does_not_fail_processing():
    from app.services.ingestion_progress import snapshot
    with patch('redis.asyncio.Redis.from_url',side_effect=ConnectionError('offline')):
        assert await snapshot(uuid4(),'actor',{'status':'RUNNING'}) is None
