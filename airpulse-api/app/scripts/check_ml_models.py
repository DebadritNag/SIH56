"""Read-only registry/artifact/inference diagnostic; never trains or writes observations."""
import asyncio
import json
import math

from app.db.session import AsyncSessionLocal, engine
from app.ml.live_inference import active_record, artifact_path, load_active, validate_features
from app.services.live_store import rows


async def diagnose(db):
    import pandas as pd
    import sklearn
    import xgboost
    report, models = {'runtime': {'scikit_learn': sklearn.__version__, 'xgboost': xgboost.__version__}}, {}
    for kind in ('fareguard', 'priceguard'):
        result = report[kind] = {'active_model_found': False, 'artifact_exists': False, 'load_test': 'FAIL'}
        try:
            record = await active_record(db, kind)
            result.update(active_model_found=True, version=record['version'], feature_schema=record['feature_schema'])
            path = artifact_path(record)
            result.update(artifact_exists=True, artifact=str(path))
            model = await asyncio.to_thread(load_active, record, kind)
            models[kind] = model
            features = model.FEATURE_COLS if kind == 'fareguard' else model.ANOMALY_FEATURE_COLS
            result.update(load_test='PASS', expected_feature_count=len(features))
        except Exception as exc:
            result['reason'] = getattr(exc, 'reason', 'DIAGNOSTIC_ERROR')
            result['error_type'] = type(exc).__name__

    # Use a real stored LIVE vector. No generated observations, inserts, or commits.
    samples = await rows(db, """SELECT f.features, v.id, v.total_fare
        FROM fare_features f JOIN validated_fares v ON v.id=f.fare_id
        WHERE v.data_origin='LIVE' AND v.validation_status='VALID' AND NOT v.is_duplicate
        ORDER BY v.collected_at DESC LIMIT 1""")
    report['sample'] = {'status': 'NOT_TESTED', 'reason': 'NO_STORED_LIVE_FEATURE_VECTOR'}
    if samples:
        sample = samples[0]
        frame = pd.DataFrame([sample['features']])
        # These external inputs have no observed provider in Live Mode. Do not reuse
        # old default constants persisted by earlier feature builders.
        for name in ('fuel_price', 'synthetic_route_demand_score', 'source_reliability_score', 'is_festival'):
            frame[name] = float('nan')
        frame['actual_fare'] = float(sample['total_fare'])
        result = report['sample'] = {'fare_id': str(sample['id']), 'status': 'FAIL', 'writes': 0}
        try:
            if 'fareguard' not in models:
                result['reason'] = report['fareguard'].get('reason', 'MODEL_UNAVAILABLE')
                return report
            fg = models['fareguard']
            validate_features(fg, frame, 'fareguard')
            prediction = float((await asyncio.to_thread(fg.predict_batch, frame))[0])
            if not math.isfinite(prediction) or prediction <= 0:
                result['reason'] = 'INVALID_PREDICTION'
                return report
            result.update(fareguard='PASS', predicted_fare=prediction, fareguard_version=fg.version)
            frame['predicted_fare'] = prediction
            frame['residual'] = frame['actual_fare'] - prediction
            frame['residual_pct'] = 100 * frame['residual'] / prediction
            if 'priceguard' not in models:
                result['reason'] = report['priceguard'].get('reason', 'MODEL_UNAVAILABLE')
                return report
            pg = models['priceguard']
            validate_features(pg, frame, 'priceguard')
            score = (await asyncio.to_thread(pg.score_batch, frame))[0]
            if not all(math.isfinite(float(score[k])) for k in ('isolation_score', 'anomaly_percentile')):
                result['reason'] = 'INVALID_SCORE'
                return report
            result.update(status='PASS', priceguard='PASS', priceguard_version=pg.version, score=score)
        except Exception as exc:
            result.update(reason=getattr(exc, 'reason', 'INFERENCE_ERROR'), error_type=type(exc).__name__)
    return report


async def main():
    try:
        async with asyncio.timeout(60):
            async with AsyncSessionLocal() as db:
                report = await diagnose(db)
                print(json.dumps(report, indent=2, allow_nan=False))
                return 0 if report['sample']['status'] == 'PASS' else 1
    except Exception as exc:
        print(json.dumps({'status': 'FAIL', 'reason': 'DIAGNOSTIC_ERROR', 'error_type': type(exc).__name__}))
        return 1
    finally:
        await engine.dispose()


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
