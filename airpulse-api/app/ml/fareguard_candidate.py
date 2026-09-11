"""Explicit candidate evaluation. No registration, activation, or production writes."""
import hashlib
import json
from pathlib import Path
from datetime import timezone, timedelta
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from xgboost import XGBRegressor
from app.ml.features import FeatureBuilder
from app.ml.fareguard import FareGuardModel


def errors(target, predicted):
    valid = np.isfinite(predicted)
    if not valid.all():
        return {'mae':None,'rmse':None,'mape':None,'invalid_predictions':int((~valid).sum())}
    return {'mae':float(mean_absolute_error(target,predicted)),
            'rmse':float(np.sqrt(mean_squared_error(target,predicted))),
            'mape':float(mean_absolute_percentage_error(target,predicted)*100),
            'invalid_predictions':int((predicted<=0).sum())}


def evaluate_candidate(records, baseline, output_dir):
    if any(r.get('data_origin') not in ('LIVE','IMPORTED') for r in records):
        raise ValueError('Only genuine LIVE/IMPORTED observations may train this candidate')
    frame = FeatureBuilder.observed_training_frame(records)
    days = frame.observed_at.map(lambda t:t.astimezone(timezone(timedelta(hours=5,minutes=30))).date())
    dates = sorted(set(days))
    if len(frame)<40 or len(dates)<3:
        raise ValueError('Insufficient temporal data: need 40 observations and three distinct observed dates')
    train, validation, test = frame[days.isin(dates[:-2])], frame[days==dates[-2]], frame[days==dates[-1]]
    if min(len(train),len(validation),len(test))<5:
        raise ValueError('Temporal partitions require at least five observations each')
    target = train.normalized_total_fare.to_numpy()
    if not np.isfinite(target).all() or (target<=0).any():
        raise ValueError('Targets must be finite positive observed INR fares')
    model = FareGuardModel('fareguard-xgb-v2')
    model.target_transform = 'log1p'
    y = np.log1p(target)
    model.model = XGBRegressor(objective='reg:squarederror', n_estimators=60,
        max_depth=2,min_child_weight=3,learning_rate=.08,n_jobs=1,random_state=42,
        base_score=float(y.mean()))
    model.model.fit(train[model.FEATURE_COLS], y)
    model.is_trained = True
    metrics = {}
    for name, partition in [('validation',validation),('test',test)]:
        metrics[name] = {'rows':len(partition),
            'v1':errors(partition.normalized_total_fare,baseline.predict_batch(partition)),
            'v2':errors(partition.normalized_total_fare,model.predict_batch(partition))}
    live = frame[frame.data_origin=='LIVE']
    predictions = model.predict_batch(live)
    all_positive = bool(np.isfinite(predictions).all() and (predictions>0).all())
    improves = all(metrics[split]['v2'][key] is not None and metrics[split]['v1'][key] is not None and metrics[split]['v2'][key]<metrics[split]['v1'][key] for split in metrics for key in ('mae','rmse','mape'))
    report = dict(status='CANDIDATE',version=model.version,baseline_version=baseline.version,
        feature_builder_version=FeatureBuilder.OBSERVED_VERSION,target_transform='log1p',
        training_rows=len(train),total_rows=len(frame),observed_dates=[str(d) for d in dates],
        train_dates=[str(d) for d in dates[:-2]],validation_date=str(dates[-2]),test_date=str(dates[-1]),
        metrics=metrics,live_vectors_checked=len(live),all_live_predictions_positive=all_positive,
        comparative_validation_passed=all_positive and improves,
        activation_ready=False,
        activation_blockers=([f'Comparative validation failed on {len(dates)} Indian observation dates.'] if not (all_positive and improves) else []) + [
                             'Independent validation and transform-aware SHAP output review remain required.',
                             'Deploy transform-aware code and candidate artifact to BOTH containers before any activation.'],
        dataset_sha256=hashlib.sha256(json.dumps(records,sort_keys=True,default=str).encode()).hexdigest(),
        live_predictions=[{'fare_id':str(row.fare_id),'raw_prediction':float(raw),'final_prediction':float(final)} for (_,row),raw,final in zip(live.iterrows(),model.predict_raw_batch(live),predictions)])
    directory = Path(output_dir)
    directory.mkdir(parents=True,exist_ok=True)
    if (directory / f'{model.version}.joblib').exists():
        raise ValueError('Candidate artifact already exists; refusing to overwrite')
    path = Path(model.save(str(directory)))
    report['artifact_sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    (directory / f'{model.version}.evaluation.json').write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
    return report
