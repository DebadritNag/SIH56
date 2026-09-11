from copy import deepcopy
from uuid import UUID
from unittest.mock import AsyncMock
import pytest
from app.services.canonical_fare_view import project_fare, lead_days
from app.scripts.repair_live_provenance import plan_repair, repair
from app.services.provenance_service import ProvenanceService


@pytest.fixture
def record():
    return dict(fare=dict(id='fare1', data_origin='LIVE', origin='DEL',destination='BOM', source_id=None, collection_run_id=None,
        departure_at='2026-09-30T05:30:00+00:00',collected_at='2026-09-11T18:00:00+00:00', booking_window_days=0,
        normalized_total_fare=6000,quote_hash='canonical-hash',is_duplicate=False,validation_status='VALID'),
        raw=dict(id='raw1',source_id='source1',collection_run_id='run1',response_hash='payload-hash',collector_version='happyfares-crawl4ai-v1',raw_payload={'provenance':{'source':'HappyFares'}}),
        collection=dict(id='run1',source_id='source1',metadata={'result':{'collection_engine':'CRAWL4AI'}}),
        source={'name':'happyfares','display_name':'HappyFares'},
        processing=dict(id='pipeline1',collection_run_id='run1',pipeline_type='live_ingestion'),
        steps=[dict(step_name='PRICEGUARD',metadata={'scores':[{'fare_id':'fare1','status':'NOT_SCORED','reason':'PREDICTION_UNAVAILABLE'}]})])


def test_provenance_and_lead_days(record):
    result = project_fare(record)
    assert result['source_provider'] == 'HappyFares'
    assert result['source_id'] == 'source1'
    assert result['collection_run_id'] == 'run1'
    assert result['ingestion_run_id'] == result['pipeline_run_id'] == 'pipeline1'
    assert result['acquisition_method'] == 'CRAWL4AI'
    assert result['collector_version'] == 'happyfares-crawl4ai-v1'
    assert result['actual_lead_days'] == 19
    assert result['booking_window_bucket'] == 'T+15'
    assert result['payload_sha256'] != result['quote_hash']
    for key in ('source_provider','collection_run_id','ingestion_run_id','pipeline_run_id','acquisition_method','actual_lead_days','payload_sha256'):
        assert result[key] == result['audit'][key]
    assert 'telemetry' not in str(result['audit']['lineage_steps'])
    assert result['anomaly_status'] == 'NOT_SCORED'


@pytest.mark.parametrize('status,severity,prediction,expected', [('NOT_SCORED',None,5000,'NOT_SCORED'),('SCORED','normal',5000,'NORMAL'),('SCORED','critical',5000,'CRITICAL'),('SCORED','normal',None,'NOT_SCORED')])
def test_persisted_scoring_only(record,status,severity,prediction,expected):
    record['prediction'] = dict(predicted_fare=prediction,model_version='actual-v1')
    record['steps'][0]['metadata']['scores'][0].update(status=status,severity=severity,anomaly_percentile=.99 if severity=='critical' else .1)
    result = project_fare(record)
    assert result['anomaly_status'] == expected
    assert result['audit']['priceguard_anomaly']['status'] == ('NOT_SCORED' if expected=='NOT_SCORED' else 'SCORED')
    assert result['fareguard_prediction'] == result['audit']['fareguard_prediction']['predicted_fare']


def test_no_provider_guesses(record):
    record['source'] = None
    record['raw']['raw_payload'] = {}
    record['raw']['collector_version'] = None
    result = project_fare(record)
    assert result['source_provider'] is None and result['collector_version'] is None
    assert 'telemetry' not in str(result)


def test_projection_never_mutates_evidence(record):
    before=deepcopy(record)
    project_fare(record)
    assert record==before


def test_unscored_outcome_hides_stale_prediction(record):
    record['prediction']={'predicted_fare':5000,'model_version':'old'}
    record['steps'].append({'step_name':'FAREGUARD','metadata':{'outcomes':[{'fare_id':'fare1','status':'NOT_SCORED','reason':'INVALID_PREDICTION'}]}})
    result=project_fare(record)
    assert result['fareguard_prediction'] is None
    assert result['fareguard_reason']=='INVALID_PREDICTION'
    assert result['anomaly_status']=='NOT_SCORED'


def test_imported_lineage_preserved(record):
    record['fare']['data_origin'] = 'IMPORTED'
    record['source'] = {'name':'goibibo','display_name':'Goibibo','collection_method':'CSV_IMPORT'}
    record['collection']['metadata'] = {}
    record['processing'] = {'id':'latest-pipeline','collection_run_id':'latest-ingestion','pipeline_type':'import_automated_pipeline'}
    result=project_fare(record)
    assert result['data_origin']=='IMPORTED'
    assert result['collection_run_id']=='run1'
    assert result['ingestion_run_id']=='latest-ingestion'
    assert result['acquisition_method']=='CSV_IMPORT'


def test_ist_midnight_and_unknown():
    assert lead_days('2026-09-12T02:00:00Z','2026-09-11T23:00:00Z') == 0
    assert lead_days(None,'2026-09-11T23:00:00Z') is None


def test_repair_only_deterministic_and_idempotent():
    record=dict(id='f',source_id=None,raw_source_id='s',run_source_id='s',collection_run_id=None,raw_run_id='c',pipelines=[{'id':'p','metadata':{}}])
    status, changes=plan_repair(record)
    assert status=='repairable' and changes=={'source_id':'s','collection_run_id':'c','pipeline_run_id':'p'}
    record.update(source_id='s',collection_run_id='c')
    record['pipelines'][0]['metadata']['processed_fare_ids']=['f']
    assert plan_repair(record)==('unchanged',{})
    record['source_id']='different'
    assert plan_repair(record)==('ambiguous',{})


def test_multiple_possible_runs_never_guessed():
    record=dict(id='f',source_id='s',collection_run_id='c',pipelines=[{'id':'p1'},{'id':'p2'}])
    assert plan_repair(record)==('ambiguous',{})


@pytest.mark.asyncio
async def test_drawer_uses_identical_projection(monkeypatch,record):
    from app.services import canonical_fare_view as service
    value=project_fare(record)
    monkeypatch.setattr(service,'load_fare_views',AsyncMock(return_value={'fare1':value}))
    assert await ProvenanceService(None).get_fare_provenance('fare1')==value['audit']


@pytest.mark.asyncio
async def test_dry_run_writes_nothing(monkeypatch):
    from app.scripts import repair_live_provenance as script
    db=AsyncMock()
    monkeypatch.setattr(script,'rows',AsyncMock(return_value=[dict(id='f',source_id='s',collection_run_id='c',pipelines=[{'id':'p','metadata':{}}])]))
    result=await repair(db)
    assert result['records_repairable']==1 and result['records_repaired']==0
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()
