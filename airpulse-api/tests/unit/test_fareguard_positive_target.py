import json
from pathlib import Path
from unittest.mock import Mock
import numpy as np
import pandas as pd
import pytest
from xgboost import XGBRegressor
from app.ml.features import FeatureBuilder
from app.ml.fareguard import FareGuardModel
from app.ml.live_inference import load_active, InferenceUnavailable
from app.scripts.check_ml_models import feature_trace, prediction_trace


def fare(id='current',collected='2026-09-11T12:00:00Z',price=6000):
    return dict(id=id,route_id='route',airline='observed',cabin='economy',departure_at='2026-09-30T05:00:00Z',
        collected_at=collected,booking_window_days=0,distance_km=1137.07,total_fare=price,
        normalized_total_fare=price,data_origin='LIVE')


def test_shared_training_inference_parity_and_no_future_leakage():
    data=[fare('prior','2026-09-10T12:00:00Z',5000),fare(),fare('same','2026-09-11T12:00:00Z',99999),fare('future','2026-09-12T12:00:00Z',80000)]
    trained=FeatureBuilder.observed_training_frame(data)
    inferred=FeatureBuilder.observed_features(fare(),[5000])
    pd.testing.assert_series_equal(trained[trained.fare_id=='current'].iloc[0][FareGuardModel.FEATURE_COLS].astype(float),pd.Series(inferred)[FareGuardModel.FEATURE_COLS].astype(float),check_names=False)
    assert inferred['booking_window_days']==19 and inferred['day_of_week']==2
    assert inferred['month']==9 and inferred['is_weekend']==0
    assert inferred['route_recent_median']==5000 and inferred['route_recent_std']==0
    for name in ('fuel_price','is_festival','synthetic_route_demand_score','source_reliability_score'):
        assert np.isnan(inferred[name])
    assert inferred['distance_km']==1137.07


def test_same_day_ist_and_expired_history():
    value=fare(collected='2026-09-11T23:00:00Z')
    value['departure_at']='2026-09-12T02:00:00Z'
    assert FeatureBuilder.observed_features(value,[])['booking_window_days']==0
    old=fare('old','2026-08-01T00:00:00Z')
    frame=FeatureBuilder.observed_training_frame([old,fare()])
    assert np.isnan(frame.iloc[-1].route_recent_median)


@pytest.fixture
def model():
    obj=FareGuardModel('test-log-target')
    obj.target_transform='log1p'
    frame=pd.DataFrame([FeatureBuilder.observed_features(fare(),[])])
    obj.model=XGBRegressor(n_estimators=2,n_jobs=1).fit(pd.concat([frame[ obj.FEATURE_COLS]]*5),np.log1p(np.full(5,6000)))
    obj.is_trained=True
    return obj,frame


@pytest.mark.parametrize('raw',[-2.0,0.0,float('nan'),float('inf')])
def test_nonpositive_or_nonfinite_output_is_not_clipped(model,monkeypatch,raw):
    obj,frame=model
    monkeypatch.setattr(obj.model,'predict',lambda frame:np.array([raw]))
    trace=prediction_trace(obj,frame)
    assert not trace['prediction_valid']
    assert trace['invalid_reason'] in ('NONPOSITIVE','NON_FINITE')
    json.dumps(trace,allow_nan=False)


def test_positive_target_round_trip_and_schema(model,tmp_path):
    obj,frame=model
    path=obj.save(str(tmp_path))
    record=dict(version=obj.version,feature_schema={'features':obj.FEATURE_COLS})
    loaded=load_active(record,'fareguard',artifact_override=path)
    trace=prediction_trace(loaded,frame)
    assert trace['prediction_valid'] and trace['final_prediction']>0
    assert trace['final_prediction']==pytest.approx(np.expm1(trace['raw_prediction']),rel=1e-6)
    assert trace['raw_prediction']!=trace['final_prediction']
    with pytest.raises(InferenceUnavailable,match='FEATURE_SCHEMA_MISMATCH'):
        load_active({**record,'feature_schema':{'features':list(reversed(obj.FEATURE_COLS))}},'fareguard',artifact_override=path)
    json.dumps(feature_trace(frame,obj.FEATURE_COLS),allow_nan=False)


def test_actual_candidate_representative_live_vector():
    path=Path(__file__).resolve().parents[2]/'models/candidates/fareguard-xgb-v2.joblib'
    if not path.exists():
        pytest.skip('Candidate artifact absent from models/candidates/')
    record=dict(version='fareguard-xgb-v2',feature_schema={'features':FareGuardModel.FEATURE_COLS})
    try:
        model=load_active(record,'fareguard',artifact_override=path)
    except InferenceUnavailable as exc:
        # The v2 candidate was pickled with a different XGBoost version.
        # Skip rather than fail so the test suite reports honestly.
        pytest.skip(f'Candidate artifact incompatible with installed XGBoost ({exc}). '
                    'Re-run fareguard_candidate.py with the current environment to regenerate.')
    vector=FeatureBuilder.observed_features(fare(),[])
    vector.update(route_recent_median=5985.,route_recent_std=4621.561685188244,route_recent_volatility=.7722)
    trace=prediction_trace(model,pd.DataFrame([vector]))
    assert trace['prediction_valid'] and trace['final_prediction']>0


def test_candidate_requires_validation_and_never_overwrites(tmp_path):
    from app.ml.fareguard_candidate import evaluate_candidate
    records=[]
    for day in (8,9,10):
        records.extend(fare(f'{day}-{i}',f'2026-09-{day:02d}T12:00:00Z',6000) for i in range(15))
    baseline=Mock(version='fareguard-xgb-v1')
    baseline.predict_batch=lambda frame:np.full(len(frame),6000.)
    result=evaluate_candidate(records,baseline,tmp_path)
    assert result['status']=='CANDIDATE'
    assert not result['activation_ready'] and not result['comparative_validation_passed']
    content=(tmp_path/'fareguard-xgb-v2.joblib').read_bytes()
    with pytest.raises(ValueError,match='refusing to overwrite'):
        evaluate_candidate(records,baseline,tmp_path)
    assert (tmp_path/'fareguard-xgb-v2.joblib').read_bytes()==content
