from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import pytest
from app.services.readiness import index_readiness, shock_readiness, load_index_readiness, INDEX_ELIGIBILITY_SQL

TODAY = date(2026, 9, 19)
RULES = SimpleNamespace(SHOCK_MIN_SOURCE_COUNT=2, SHOCK_MIN_PRICE_CHANGE_PCT=20,
                       SHOCK_MIN_QUOTE_COUNT=10, SHOCK_MIN_ROBUST_ZSCORE=3)


def group(day=TODAY, origin='LIVE', route='r1', window='T+7', count=5):
    return dict(route_id=route,route_code='DEL-BOM',window=window,observed_date=day,
                utc_date=day,count=count,data_origin=origin)


@pytest.mark.parametrize('days',[0,1,12,30,31,60])
def test_real_days_not_a_new_methodology_gate(days):
    result=index_readiness([group(TODAY-timedelta(days=i)) for i in range(days)],None,[],TODAY)
    assert result['collected_days']==days
    assert result['required_days'] is None
    assert result['remaining_days'] is None
    assert result['status']!='READY'


def test_same_observation_date_imports_and_windows_count_once():
    result=index_readiness([group(),group(origin='IMPORTED'),group(window='T+30')],None,[],TODAY)
    assert result['collected_days']==1
    assert result['live_days']==result['imported_days']==1
    assert result['eligible_observations']==15


@pytest.mark.parametrize('origin',['SYNTHETIC','REPLAY','MODELLED'])
def test_history_rejects_non_genuine_origins(origin):
    assert index_readiness([group(origin=origin)],None,[],TODAY)['collected_days']==0


def test_ist_history_date_and_utc_calculation_date_remain_distinct():
    g=group(); g['observed_date']=TODAY+timedelta(days=1)
    basket=dict(base_period_start=TODAY-timedelta(days=2),base_period_end=TODAY)
    result=index_readiness([g],basket,[dict(route_id='r1',booking_window_days=7)],TODAY)
    assert result['distinct_observation_dates'][0]['date']==str(TODAY+timedelta(days=1))
    assert result['requirements']['current']=='MET'


def test_basket_base_current_and_no_promotion():
    basket=dict(base_period_start=TODAY-timedelta(days=10),base_period_end=TODAY-timedelta(days=1))
    weights=[dict(route_id='r1',route_code='DEL-BOM',booking_window_days=7)]
    result=index_readiness([group(TODAY-timedelta(days=2)),group()],basket,weights,TODAY)
    assert result['requirements']['matched']=='MET'
    assert result['status']=='AWAITING_CALCULATION'
    assert index_readiness([],basket,weights,TODAY,latest={'id':'stored'})['status']=='READY'
    result=index_readiness([group()],basket,weights,TODAY)
    assert result['requirements']['base']=='NOT_MET'
    assert result['status']=='MISSING_ROUTE_COVERAGE'


def test_route_window_mismatch_and_unsupported_route():
    basket=dict(base_period_start=TODAY-timedelta(days=10),base_period_end=TODAY-timedelta(days=1))
    weights=[dict(route_id='r1',booking_window_days=7)]
    result=index_readiness([group(TODAY-timedelta(days=2)),group(window='T+15'),group(route='r2')],basket,weights,TODAY)
    assert result['requirements']['current']=='NOT_MET'
    assert result['eligible_observations']==5


@pytest.mark.parametrize('count',[0,1,2,3])
def test_independent_sources(count):
    gs=[dict(source_id=f's{i}',data_origin='LIVE',name='Source',route_code='DEL-BOM',window='T+7',latest='2026-09-19T01:00:00Z') for i in range(count)]
    result=shock_readiness(gs*5,RULES)
    assert result['available_sources']==count
    assert result['remaining_sources']==max(2-count,0)
    assert result['candidate_count'] is None
    assert result['status']!='CONFIRMED'


@pytest.mark.parametrize('origin',['IMPORTED','SYNTHETIC','REPLAY','MODELLED'])
def test_non_live_not_independent_confirmation(origin):
    assert shock_readiness([dict(source_id='s',data_origin=origin)],RULES)['available_sources']==0


@pytest.mark.asyncio
async def test_loader_reuses_calculator_eligibility_and_is_read_only():
    query=AsyncMock(side_effect=[[],[],[]])
    with patch('app.services.readiness.rows',query):
        result=await load_index_readiness(object())
    sql=query.call_args_list[1].args[1]
    assert INDEX_ELIGIBILITY_SQL in sql
    assert "AT TIME ZONE 'Asia/Kolkata'" in sql
    assert 'departure_at' not in sql
    assert 'fare_index_eligibility' in sql
    assert result['collected_days']==0
    for call in query.call_args_list:
        assert call.args[1].lstrip().startswith('SELECT')
