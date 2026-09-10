from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from app.services.confirmed_shocks import confirmed_live_shock


def alert(**changes):
    record={'id':uuid4(),'alert_type':'price_shock','status':'OPEN','route_code':'DEL-BOM','created_at':datetime.now(timezone.utc),'metadata':{'data_origin':'LIVE','source_count':4,'quote_count':20,'percentage_change':50,'robust_zscore':5,'current_median':150,'historical_median':100}}
    record.update(changes)
    return record

@pytest.mark.parametrize('origin',['SYNTHETIC','REPLAY','MODELLED','IMPORTED',''])
def test_non_live_provenance_excluded(origin):
    a=alert();a['metadata']['data_origin']=origin
    assert confirmed_live_shock(a) is None

@pytest.mark.parametrize('kind',['FARE_ANOMALY','MARKET_SHOCK','unusually_high'])
def test_anomalies_are_not_shocks(kind):
    assert confirmed_live_shock(alert(alert_type=kind)) is None

@pytest.mark.parametrize('status',['RESOLVED','EXPIRED','DISMISSED'])
def test_inactive_excluded(status):
    assert confirmed_live_shock(alert(status=status)) is None

@pytest.mark.parametrize('field,value',[('source_count',1),('quote_count',1),('percentage_change',1),('robust_zscore',0),('current_median',0)])
def test_existing_thresholds_required(field,value):
    a=alert();a['metadata'][field]=value
    assert confirmed_live_shock(a) is None


def test_expiry_and_replay_excluded():
    a=alert();a['metadata']['expires_at']=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()
    assert confirmed_live_shock(a) is None
    a=alert();a['metadata']['pipeline_mode']='REPLAY'
    assert confirmed_live_shock(a) is None

@pytest.mark.asyncio
@pytest.mark.parametrize('count',[0,3])
async def test_shared_endpoint_count_matches_only_confirmed_items(count):
    from app.api.v1.alerts import confirmed_shocks
    records=[alert() for _ in range(count)]+[alert(alert_type='FARE_ANOMALY') for _ in range(14)]+[alert(status='RESOLVED')]
    with patch('app.services.live_store.rows',AsyncMock(return_value=records)):
        result=await confirmed_shocks(AsyncMock(),SimpleNamespace(user_id='viewer'))
    assert result.data['active_count']==len(result.data['items'])==count
