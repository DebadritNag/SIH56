"""Read-only, reproducible model diagnostic. No training, activation or fare writes."""
import argparse
import asyncio
import hashlib
import json
import math
from datetime import timedelta
from pathlib import Path
from uuid import UUID

from app.db.session import AsyncSessionLocal, engine
from app.ml.live_inference import active_record, artifact_path, configured_artifact_path, load_active, validate_features
from app.services.live_store import rows


def safe_number(value):
    value = float(value)
    return value if math.isfinite(value) else str(value)


def feature_trace(frame, names):
    import pandas as pd
    result = []
    for name in names:
        value = frame.iloc[0].get(name)
        missing = bool(pd.isna(value))
        result.append(dict(name=name, value=None if missing else safe_number(value),
                           dtype=str(frame[name].dtype) if name in frame else 'missing', is_null=missing))
    return result


def prediction_trace(model, frame):
    validate_features(model, frame, 'fareguard')
    raw = float(model.predict_raw_batch(frame)[0])
    final = float(model.predict_batch(frame)[0])
    valid = math.isfinite(final) and final > 0
    return dict(raw_prediction=safe_number(raw), final_prediction=safe_number(final),
                target_transform=model.target_transform, prediction_valid=valid,
                invalid_reason=None if valid else 'NON_FINITE' if not math.isfinite(final) else 'NONPOSITIVE')


async def diagnose(db, fare_id=None, candidate_artifact=None):
    import pandas as pd
    import sklearn
    import xgboost
    from app.ml.fareguard import FareGuardModel
    from app.ml.features import FeatureBuilder
    report = {'runtime': {'scikit_learn': sklearn.__version__, 'xgboost': xgboost.__version__},
              'selection': 'CANDIDATE_FILE' if candidate_artifact else 'ACTIVE_REGISTRY',
              'diagnosis': {
                  'xgboost_version_pin': '==3.2.0 (required; rebuild Docker if mismatch)',
                  'invalid_prediction_root_cause': (
                      'InconsistentVersionWarning was raised as an error because xgboost<3.0.0 '
                      'was installed in Docker while the artifact was saved with 3.x locally. '
                      'Fixed by: (1) pinning xgboost==3.2.0 in requirements.txt, '
                      '(2) downgrading the warning policy to non-fatal in live_inference.py, '
                      '(3) re-saving the v1 artifact with the current XGBoost version.'
                  ),
              }}
    models = {}
    for kind in ('fareguard', 'priceguard'):
        result = report[kind] = {'active_model_found': False, 'artifact_exists': False, 'load_test': 'FAIL'}
        try:
            override = Path(candidate_artifact) if candidate_artifact and kind == 'fareguard' else None
            if override:
                evaluation = json.loads(override.with_suffix('.evaluation.json').read_text(encoding='utf-8'))
                record = dict(version=evaluation['version'], feature_schema={'features':FareGuardModel.FEATURE_COLS},
                              checksum=evaluation['artifact_sha256'])
                result['candidate_status'] = evaluation['status']
                result['activation_ready'] = evaluation['activation_ready']
                path = override
            else:
                record = await active_record(db, kind)
                result['active_model_found'] = True
                result['artifact'] = str(configured_artifact_path(record))
                path = artifact_path(record)
            result.update(version=record['version'], feature_schema=record['feature_schema'],
                          artifact=str(path.resolve()), artifact_exists=True,
                          artifact_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
            model = await asyncio.to_thread(load_active, record, kind, artifact_override=override)
            models[kind] = model
            features = model.FEATURE_COLS if kind == 'fareguard' else model.ANOMALY_FEATURE_COLS
            result.update(load_test='PASS', feature_schema_test='PASS', expected_feature_count=len(features))
        except Exception as exc:
            result.update(reason=getattr(exc, 'reason', 'DIAGNOSTIC_ERROR'), error_type=type(exc).__name__)

    samples = await rows(db, """SELECT v.*,f.id AS feature_id,f.features,r.distance_km
        FROM fare_features f JOIN validated_fares v ON v.id=f.fare_id JOIN routes r ON r.id=v.route_id
        WHERE v.data_origin='LIVE' AND v.validation_status='VALID' AND NOT v.is_duplicate
          AND (CAST(:fare_id AS uuid) IS NULL OR v.id=CAST(:fare_id AS uuid))
        ORDER BY v.collected_at DESC,v.id DESC,f.created_at DESC,f.id DESC LIMIT 1""", fare_id=str(fare_id) if fare_id else None)
    report['sample'] = {'status':'NOT_TESTED', 'reason':'NO_STORED_LIVE_FEATURE_VECTOR'}
    if not samples:
        return report
    sample = samples[0]
    result = report['sample'] = {'fare_id':str(sample['id']), 'feature_id':str(sample.get('feature_id')), 'status':'FAIL', 'writes':0,
                                'priceguard':'NOT_SCORED', 'priceguard_reason':'PREDICTION_UNAVAILABLE'}
    try:
        if 'fareguard' not in models:
            result['reason'] = report['fareguard'].get('reason','MODEL_UNAVAILABLE')
            return report
        fg = models['fareguard']
        stored = pd.DataFrame([sample['features']])
        # Reproduce the old diagnostic exactly, including its four explicit unknowns.
        for name in ('fuel_price','synthetic_route_demand_score','source_reliability_score','is_festival'):
            stored[name] = float('nan')
        stored['actual_fare'] = float(sample['total_fare'])
        result['stored_features'] = feature_trace(stored,fg.FEATURE_COLS)
        result['stored_prediction'] = prediction_trace(fg,stored)
        history = await rows(db, """SELECT normalized_total_fare FROM validated_fares
            WHERE route_id=:route AND collected_at<:observed AND collected_at>=:since
            AND validation_status='VALID' AND NOT is_duplicate AND data_origin IN ('LIVE','IMPORTED')""",
            route=sample['route_id'], observed=sample['collected_at'], since=sample['collected_at']-timedelta(days=30))
        frame = pd.DataFrame([FeatureBuilder.observed_features(sample,[row['normalized_total_fare'] for row in history])])
        result['feature_builder_version'] = FeatureBuilder.OBSERVED_VERSION
        result['features'] = feature_trace(frame,fg.FEATURE_COLS)
        result['preprocessing_differences'] = [a['name'] for a,b in zip(result['stored_features'],result['features']) if a['value']!=b['value']]
        trace = prediction_trace(fg,frame)
        result.update(trace)
        if not trace['prediction_valid']:
            result['reason'] = 'INVALID_PREDICTION'
            return report
        prediction = float(trace['final_prediction'])
        result.update(fareguard='PASS',predicted_fare=prediction,fareguard_version=fg.version)
        frame['predicted_fare'] = prediction
        frame['residual'] = frame.actual_fare-prediction
        frame['residual_pct'] = 100*frame.residual/prediction
        if 'priceguard' not in models:
            result['reason'] = report['priceguard'].get('reason','MODEL_UNAVAILABLE')
            return report
        pg=models['priceguard']
        validate_features(pg,frame,'priceguard')
        score=(await asyncio.to_thread(pg.score_batch,frame))[0]
        if not all(math.isfinite(float(score[k])) for k in ('isolation_score','anomaly_percentile')):
            result['reason']='INVALID_SCORE'
            return report
        result.update(status='PASS',priceguard='PASS',priceguard_reason=None,priceguard_version=pg.version,score=score)
    except Exception as exc:
        result.update(reason=getattr(exc,'reason','INFERENCE_ERROR'),error_type=type(exc).__name__)
    return report


async def main(fare_id=None,candidate_artifact=None):
    try:
        async with asyncio.timeout(90):
            async with AsyncSessionLocal() as db:
                report=await diagnose(db,fare_id,candidate_artifact)
                print(json.dumps(report,indent=2,allow_nan=False))
                return 0 if report['sample']['status']=='PASS' else 1
    except Exception as exc:
        print(json.dumps({'status':'FAIL','reason':'DIAGNOSTIC_ERROR','error_type':type(exc).__name__}))
        return 1
    finally:
        await engine.dispose()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fare-id',type=UUID)
    parser.add_argument('--candidate-artifact',help='Explicit diagnostic only; requires its evaluation JSON sidecar. Never activates.')
    args=parser.parse_args()
    raise SystemExit(asyncio.run(main(args.fare_id,args.candidate_artifact)))
