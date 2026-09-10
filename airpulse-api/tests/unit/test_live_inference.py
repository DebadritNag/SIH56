import json
import math
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import IsolationForest
from xgboost import XGBRegressor

from app.ml import live_inference as inference
from app.ml.fareguard import FareGuardModel
from app.ml.priceguard import PriceGuardDetector
from app.ml.model_registry import ModelRegistryService
from app.services import live_processing as pipeline


@pytest.fixture
def artifacts(tmp_path, monkeypatch):
    """Tiny fitted test artifacts only; no training in application inference."""
    monkeypatch.setattr(inference.settings, 'MODEL_DIR', str(tmp_path))
    inference._cache.clear()
    rng = np.random.default_rng(42)
    records = {}
    for kind, features in [('fareguard', FareGuardModel.FEATURE_COLS), ('priceguard', PriceGuardDetector.ANOMALY_FEATURE_COLS)]:
        x = pd.DataFrame(rng.uniform(1, 10, (32, len(features))), columns=features)
        estimator = XGBRegressor(n_estimators=2, n_jobs=1).fit(x, np.full(32, 5000.0)) if kind == 'fareguard' else IsolationForest(n_estimators=3, n_jobs=1, random_state=42).fit(x)
        version = f'{kind}-test-v1'
        payload = dict(model=estimator, version=version, features=features)
        if kind == 'priceguard':
            payload['training_scores'] = np.sort(-estimator.decision_function(x))
        joblib.dump(payload, tmp_path / f'{version}.joblib')
        records[kind] = dict(model_type=kind.upper(), version=version, active=True, status='ACTIVE', feature_schema={'features': features}, artifact_storage_path=f'./models\\{version}.joblib')
    yield records
    inference._cache.clear()


def vector():
    values = {name: float('nan') for name in FareGuardModel.FEATURE_COLS}
    values.update(distance_km=1148, booking_window_days=7, day_of_week=2, is_weekend=0, month=9, actual_fare=6000)
    return pd.DataFrame([values])


def test_active_artifacts_predict_and_score_optional_nulls(artifacts):
    frame = vector()
    fg = inference.load_active(artifacts['fareguard'], 'fareguard')
    inference.validate_features(fg, frame, 'fareguard')
    prediction = float(fg.predict_batch(frame)[0])
    assert math.isfinite(prediction) and prediction > 0
    frame['predicted_fare'] = prediction
    frame['residual'] = frame.actual_fare - prediction
    frame['residual_pct'] = 100 * frame.residual / prediction
    pg = inference.load_active(artifacts['priceguard'], 'priceguard')
    inference.validate_features(pg, frame, 'priceguard')
    score = pg.score_batch(frame)[0]
    assert math.isfinite(score['isolation_score'])
    json.dumps(score, allow_nan=False)  # numpy.bool_ must not break persistence.


@pytest.mark.parametrize('field,value,reason', [('distance_km', None, 'INSUFFICIENT_FEATURES'), ('month', 'bad', 'FEATURE_SCHEMA_MISMATCH')])
def test_invalid_core(artifacts, field, value, reason):
    fg = inference.load_active(artifacts['fareguard'], 'fareguard')
    frame = vector().astype(object)
    frame[field] = value
    with pytest.raises(inference.InferenceUnavailable, match=reason):
        inference.validate_features(fg, frame, 'fareguard')


def test_missing_column(artifacts):
    fg = inference.load_active(artifacts['fareguard'], 'fareguard')
    with pytest.raises(inference.InferenceUnavailable, match='FEATURE_SCHEMA_MISMATCH'):
        inference.validate_features(fg, vector().drop(columns='month'), 'fareguard')


@pytest.mark.parametrize('change,reason', [({'artifact_storage_path':'missing.joblib'}, 'MODEL_ARTIFACT_MISSING'), ({'version':'wrong'}, 'MODEL_LOAD_ERROR'), ({'checksum':'wrong'}, 'MODEL_LOAD_ERROR'), ({'feature_schema':{'features':['wrong']}}, 'FEATURE_SCHEMA_MISMATCH')])
def test_artifact_failures(artifacts, change, reason):
    with pytest.raises(inference.InferenceUnavailable, match=reason):
        inference.load_active({**artifacts['fareguard'], **change}, 'fareguard')


def test_corrupt_artifact_not_cached(artifacts):
    record = artifacts['fareguard']
    path = inference.artifact_path(record)
    content = path.read_bytes()
    path.write_bytes(b'invalid')
    with pytest.raises(inference.InferenceUnavailable, match='MODEL_LOAD_ERROR'):
        inference.load_active(record, 'fareguard')
    path.write_bytes(content)
    assert inference.load_active(record, 'fareguard').is_trained


@pytest.mark.asyncio
async def test_registry_only_active_and_activation_refresh(artifacts, monkeypatch):
    record = artifacts['fareguard']
    invalid = [{**record, 'status': status} for status in ('CANDIDATE', 'RETIRED', 'FAILED')]
    mock = AsyncMock(return_value=[{'record': row} for row in invalid + [record]])
    monkeypatch.setattr(inference, 'rows', mock)
    assert await inference.active_record(None, 'fareguard') == record
    first = await ModelRegistryService.get_active(None, 'fareguard')
    assert await ModelRegistryService.get_active(None, 'fareguard') is first
    next_record = {**record, 'version': 'fareguard-test-v2', 'artifact_storage_path': 'fareguard-test-v2.joblib'}
    payload = joblib.load(inference.artifact_path(record))
    payload['version'] = next_record['version']
    joblib.dump(payload, Path(inference.settings.MODEL_DIR) / next_record['artifact_storage_path'])
    mock.return_value = [{'record': next_record}]
    assert (await ModelRegistryService.get_active(None, 'fareguard')).version == next_record['version']
    mock.return_value = [{'record': row} for row in invalid]
    with pytest.raises(inference.InferenceUnavailable, match='MODEL_UNAVAILABLE'):
        await ModelRegistryService.get_active(None, 'fareguard')


@pytest.fixture
def live_db(monkeypatch):
    saved = []
    raw = dict(id=uuid4(), source_id=uuid4(), collection_run_id=uuid4(), data_origin='LIVE', origin_requested='DEL', destination_requested='BOM', departure_requested='2026-09-18', raw_payload=dict(origin='DEL', destination='BOM', departure_date='2026-09-18', departure_time='09:00', carrier='Observed airline', currency='INR', gross_total=6000, provenance={'observed_at':'2026-09-11T00:00:00Z'}))
    async def rows(db, sql, **params):
        if 'FROM raw_fares' in sql:
            return [raw]
        if 'FROM routes' in sql:
            return [dict(id=uuid4(), distance_km=1148)]
        return []  # No prior history: optional features must not prevent inference.
    async def insert(db, table, **values):
        json.dumps(values, default=str, allow_nan=False)
        saved.append((table, values))
        return uuid4()
    monkeypatch.setattr(pipeline, 'rows', rows)
    monkeypatch.setattr(pipeline, 'insert', insert)
    monkeypatch.setattr(pipeline, 'audit', AsyncMock())
    index = AsyncMock(return_value={'status':'INSUFFICIENT_DATA', 'reason':'No observed base period'})
    monkeypatch.setattr(pipeline, 'calculate_live_index', index)
    return raw, saved, index


@pytest.mark.asyncio
@pytest.mark.parametrize('prediction,anomaly', [(5000,False),(5000,True),(0,False),(float('nan'),False),(None,False)])
async def test_live_pipeline_persistence_and_gating(artifacts, live_db, monkeypatch, prediction, anomaly):
    raw, saved, index = live_db
    fg = inference.load_active(artifacts['fareguard'], 'fareguard')
    pg = inference.load_active(artifacts['priceguard'], 'priceguard')
    if prediction is not None:
        monkeypatch.setattr(fg, 'predict_batch', lambda frame: np.array([prediction]))
    score_calls = []
    def score(frame):
        score_calls.append(len(frame))
        return [dict(isolation_score=.2, anomaly_percentile=.99 if anomaly else .1, severity='critical' if anomaly else 'normal', anomaly_type='unusually_high', is_anomaly=anomaly)]
    monkeypatch.setattr(pg, 'score_batch', score)
    async def active(db, kind):
        if prediction is None:
            raise inference.InferenceUnavailable('MODEL_ARTIFACT_MISSING', 'test missing artifact')
        return fg if kind == 'fareguard' else pg
    monkeypatch.setattr(ModelRegistryService, 'get_active', active)
    explain_calls = []
    def explain(*args):
        explain_calls.append(True)
        return dict(base_value=4000, predicted_fare=5000, drivers=[])
    monkeypatch.setattr(ModelRegistryService, 'get_explainer', lambda model: SimpleNamespace(explainer=True, explain_fare=explain))
    await pipeline.process_live_fares(None, raw['collection_run_id'], uuid4())
    stages = {v['step_name']:v for table,v in saved if table == 'pipeline_steps'}
    predictions = [v for table,v in saved if table == 'fare_predictions']
    if prediction == 5000:
        assert predictions[0]['model_version'] == fg.version
        assert predictions[0]['predicted_fare'] == 5000
        assert stages['FAREGUARD']['status'] == stages['PRICEGUARD']['status'] == 'COMPLETED'
        assert stages['PRICEGUARD']['metadata']['scores'][0]['model_version'] == pg.version
        assert bool(explain_calls) == anomaly
        assert stages['SHAP']['metadata']['reason'] == (None if anomaly else 'NOT_REQUIRED')
    else:
        assert not predictions and not score_calls and not explain_calls
        outcome = stages['FAREGUARD']['metadata']['outcomes'][0]
        assert outcome['prediction'] is None
        assert outcome['reason'] == ('MODEL_ARTIFACT_MISSING' if prediction is None else 'INVALID_PREDICTION')
        assert stages['PRICEGUARD']['metadata']['scores'][0] == {'fare_id':outcome['fare_id'], 'status':'NOT_SCORED', 'reason':'PREDICTION_UNAVAILABLE'}
    index.assert_awaited_once()  # ML failure never blocks independent APIx.


def test_existing_saved_artifacts():
    directory = Path(__file__).resolve().parents[2] / 'models'
    paths = [directory / f'{v}.joblib' for v in ('fareguard-xgb-v1', 'priceguard-if-v1')]
    if not all(p.is_file() for p in paths):
        pytest.skip('Production artifacts supplied separately, not in git')
    frame = vector()
    for kind, path in zip(('fareguard', 'priceguard'), paths):
        data = joblib.load(path)
        record = dict(version=data['version'], artifact_storage_path=str(path), feature_schema={'features':data['features']})
        model = inference.load_active(record, kind)
        inference.validate_features(model, frame, kind)
        if kind == 'fareguard':
            prediction = float(model.predict_batch(frame)[0])
            assert math.isfinite(prediction) and prediction > 0
            frame['predicted_fare'] = prediction
            frame['residual'] = frame.actual_fare - prediction
            frame['residual_pct'] = 100 * frame.residual / prediction
        else:
            json.dumps(model.score_batch(frame), allow_nan=False)


@pytest.mark.asyncio
async def test_live_pipeline_with_existing_fitted_models(live_db, monkeypatch):
    directory = Path(__file__).resolve().parents[2] / 'models'
    paths = [directory / f'{v}.joblib' for v in ('fareguard-xgb-v1', 'priceguard-if-v1')]
    if not all(p.is_file() for p in paths):
        pytest.skip('Production artifacts supplied separately, not in git')
    async def active(db, kind):
        path = paths[0 if kind == 'fareguard' else 1]
        data = joblib.load(path)
        return inference.load_active(dict(version=data['version'], artifact_storage_path=str(path), feature_schema={'features':data['features']}), kind)
    monkeypatch.setattr(ModelRegistryService, 'get_active', active)
    raw, saved, index = live_db
    result = await pipeline.process_live_fares(None, raw['collection_run_id'], uuid4())
    assert result['fareguard_scored'] == result['priceguard_scored'] == 1
    assert result['shap_count'] == 1
    predictions = [v for table,v in saved if table == 'fare_predictions']
    assert predictions[0]['predicted_fare'] > 0
    assert predictions[0]['model_version'] == 'fareguard-xgb-v1'
    assert [v for table,v in saved if table == 'shap_explanations']
    index.assert_awaited_once()
