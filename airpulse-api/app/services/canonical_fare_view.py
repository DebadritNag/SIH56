"""One observation-level projection for Fare Explorer and its audit drawer."""
from datetime import datetime, timedelta, timezone
import math

from app.core.utils import bucket_from_lead_days
from app.services.live_store import rows

IST = timezone(timedelta(hours=5, minutes=30))


def as_datetime(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value


def lead_days(departure, observed):
    if not departure or not observed:
        return None
    dep, obs = as_datetime(departure), as_datetime(observed)
    if dep.tzinfo is None or obs.tzinfo is None:
        return None
    return (dep.astimezone(IST).date() - obs.astimezone(IST).date()).days


async def load_fare_views(db, ids):
    if not ids:
        return {}
    result = await rows(db, """SELECT to_jsonb(v) AS fare, to_jsonb(r) AS raw,
        to_jsonb(c) AS collection, to_jsonb(s) AS source,
        to_jsonb(p) AS processing, to_jsonb(pred) AS prediction,
        to_jsonb(a) AS anomaly, to_jsonb(e) AS eligibility,
        to_jsonb(sh) AS explanation, to_jsonb(f) AS feature,
        coalesce(st.steps,'[]'::jsonb) AS steps,
        (SELECT count(*) FROM validated_fares q WHERE q.collection_run_id=coalesce(v.collection_run_id,r.collection_run_id)) AS quote_pool_count
        FROM validated_fares v
        LEFT JOIN raw_fares r ON r.id=v.raw_fare_id
        LEFT JOIN collection_runs c ON c.id=coalesce(v.collection_run_id,r.collection_run_id)
        LEFT JOIN sources s ON s.id=coalesce(v.source_id,r.source_id,c.source_id)
        LEFT JOIN LATERAL (SELECT p.* FROM pipeline_runs p
            WHERE p.status IN ('COMPLETED','PARTIAL') AND
            (p.metadata->'processed_fare_ids' ? v.id::text OR
             (p.collection_run_id=c.id AND p.pipeline_type='live_ingestion'))
            ORDER BY p.created_at DESC,p.id DESC LIMIT 1) p ON true
        LEFT JOIN LATERAL (SELECT jsonb_agg(to_jsonb(ps) ORDER BY ps.step_order) AS steps
            FROM pipeline_steps ps WHERE ps.pipeline_run_id=p.id) st ON true
        LEFT JOIN LATERAL (SELECT x.* FROM fare_predictions x WHERE x.fare_id=v.id
            ORDER BY x.created_at DESC,x.id DESC LIMIT 1) pred ON true
        LEFT JOIN LATERAL (SELECT x.* FROM anomalies x WHERE x.fare_id=v.id
            ORDER BY x.detected_at DESC,x.id DESC LIMIT 1) a ON true
        LEFT JOIN LATERAL (SELECT x.* FROM fare_index_eligibility x WHERE x.fare_id=v.id
            ORDER BY x.evaluated_at DESC,x.id DESC LIMIT 1) e ON true
        LEFT JOIN LATERAL (SELECT x.* FROM shap_explanations x WHERE x.anomaly_id=a.id
            ORDER BY x.created_at DESC,x.id DESC LIMIT 1) sh ON true
        LEFT JOIN LATERAL (SELECT x.* FROM fare_features x WHERE x.fare_id=v.id
            ORDER BY x.created_at DESC,x.id DESC LIMIT 1) f ON true
        WHERE v.id=ANY(CAST(:ids AS uuid[])) AND v.data_origin IN ('LIVE','IMPORTED')""", ids=list(ids))
    return {str(row['fare']['id']): project_fare(row) for row in result}


def project_fare(record):
    fare = dict(record['fare'])
    raw, collection, source, processing = (record.get(k) or {} for k in ('raw','collection','source','processing'))
    payload = raw.get('raw_payload') or {}
    provenance = payload.get('provenance') or {}
    meta = collection.get('metadata') or {}
    result = meta.get('result') or {}
    provider = source.get('display_name') or source.get('name') or provenance.get('source')
    method = provenance.get('acquisition_method') or provenance.get('engine') or result.get('collection_engine') or result.get('engine')
    if fare.get('data_origin') == 'IMPORTED' and not method:
        method = source.get('collection_method')
    collector = raw.get('collector_version') or result.get('collector_version') or provenance.get('collector_version')
    parser = raw.get('parser_version') or provenance.get('parser_version')
    exact = lead_days(fare.get('departure_at'), fare.get('collected_at'))
    bucket = bucket_from_lead_days(exact) if exact is not None and exact >= 0 else None
    stages = {s['step_name'].upper():s for s in record.get('steps', [])}
    def outcome(stage, key):
        return next((o for o in (stages.get(stage,{}).get('metadata') or {}).get(key,[]) if str(o.get('fare_id'))==str(fare['id'])), None)
    fg_out, pg_out = outcome('FAREGUARD','outcomes'), outcome('PRICEGUARD','scores')
    pred = record.get('prediction') or {}
    value = pred.get('predicted_fare')
    valid_prediction = value is not None and math.isfinite(float(value)) and float(value)>0
    # Explicit per-observation outcomes override stale historical records.
    if fg_out and fg_out.get('status') == 'NOT_SCORED':
        valid_prediction = False
    fg = dict(status='SCORED' if valid_prediction else 'NOT_SCORED',
        predicted_fare=float(value) if valid_prediction else None,
        residual=pred.get('residual') if valid_prediction else None,
        residual_pct=pred.get('residual_pct') if valid_prediction else None,
        model_version=pred.get('model_version') if valid_prediction else None,
        reason=None if valid_prediction else (fg_out or {}).get('reason') or (stages.get('FAREGUARD',{}).get('metadata') or {}).get('reason') or 'PREDICTION_UNAVAILABLE')
    anomaly = record.get('anomaly') or {}
    pg = dict(status='NOT_SCORED', reason='PREDICTION_UNAVAILABLE' if not valid_prediction else 'SCORING_NOT_RECORDED', severity=None, anomaly_percentile=None, is_anomaly=None)
    if valid_prediction:
        if pg_out:
            if pg_out.get('status') == 'NOT_SCORED':
                pg['reason'] = pg_out.get('reason') or 'SCORING_NOT_RECORDED'
            elif pg_out.get('anomaly_percentile') is not None:
                pg.update(pg_out, status='SCORED', reason=None)
                pg['severity'] = str(pg_out.get('severity') or ('ANOMALOUS' if pg_out.get('is_anomaly') else 'NORMAL')).upper()
        elif (stages.get('PRICEGUARD',{}).get('metadata') or {}).get('outcome') == 'SKIPPED':
            pg['reason'] = (stages['PRICEGUARD'].get('metadata') or {}).get('reason') or stages['PRICEGUARD'].get('message') or 'SCORING_NOT_RECORDED'
        elif anomaly:
            pg.update(status='SCORED', reason=None, severity=str(anomaly.get('severity') or 'ANOMALOUS').upper(), anomaly_percentile=anomaly.get('anomaly_percentile'), is_anomaly=True, anomaly_type=anomaly.get('anomaly_type'))
    processing_meta = processing.get('metadata') or {}
    explanation = record.get('explanation') if pg['status']=='SCORED' and pg.get('is_anomaly') else None
    if anomaly.get('prediction_id') and anomaly.get('prediction_id') != pred.get('id'):
        explanation = None
    drivers = (explanation or {}).get('features') or []
    if isinstance(drivers, dict):
        drivers = drivers.get('drivers', [])
    ingestion_id = processing_meta.get('ingestion_run_id') or (processing.get('id') if processing.get('pipeline_type') == 'live_ingestion' else processing.get('collection_run_id'))
    fare.update(observation_id=fare['id'], collection_run_id=fare.get('collection_run_id') or raw.get('collection_run_id'),
        source_id=fare.get('source_id') or raw.get('source_id') or collection.get('source_id'),
        ingestion_run_id=ingestion_id, pipeline_run_id=processing.get('id'),
        source_name=source.get('name'), source_display_name=provider, source_provider=provider,
        acquisition_method=method, collector_version=collector, parser_version=parser,
        payload_sha256=raw.get('response_hash'), observed_at=fare.get('collected_at'),
        departure_date=as_datetime(fare['departure_at']).astimezone(IST).date().isoformat(),
        actual_lead_days=exact, booking_window_bucket=bucket,
        fareguard_prediction=fg['predicted_fare'], fareguard_status=fg['status'], fareguard_reason=fg['reason'],
        priceguard_score=pg['anomaly_percentile'], priceguard_status=pg['status'], priceguard_reason=pg['reason'],
        anomaly_status=pg['severity'] if pg['status']=='SCORED' else 'NOT_SCORED')
    fare['audit'] = dict(fare_id=fare['id'], observation_id=fare['id'], route=f"{fare['origin']}-{fare['destination']}",
        airline_code=fare.get('airline'), booking_window_days=fare.get('booking_window_days'),
        validation_status=fare.get('validation_status'), is_duplicate=fare.get('is_duplicate'),
        features_generated=bool(record.get('feature')), quote_pool_count=record.get('quote_pool_count'),
        dataset_import_id=fare['collection_run_id'] if fare['data_origin']=='IMPORTED' else None,
        normalized_fare=float(fare['normalized_total_fare']), data_origin=fare['data_origin'],
        collection_run_id=fare['collection_run_id'], ingestion_run_id=ingestion_id, pipeline_run_id=processing.get('id'),
        source_id=fare['source_id'], source_provider=provider, acquisition_method=method,
        actual_lead_days=exact, booking_window_bucket=bucket, departure_at=fare['departure_at'],
        payload_sha256=raw.get('response_hash'), quote_hash=fare.get('quote_hash'),
        raw_source=dict(raw_fare_id=raw.get('id'), request_id=raw.get('request_id'), collected_at=raw.get('collected_at'), response_hash=raw.get('response_hash'), collector_version=collector, parser_version=parser),
        timestamps=dict(observed_at=fare.get('collected_at'), ingested_at=fare.get('created_at'),
            raw_stored_at=raw.get('created_at'), validated_at=fare.get('created_at'),
            features_generated_at=(record.get('feature') or {}).get('created_at'),
            predicted_at=pred.get('created_at') if valid_prediction else None,
            anomaly_scored_at=stages.get('PRICEGUARD',{}).get('finished_at') or anomaly.get('detected_at'),
            index_computed_at=(record.get('eligibility') or {}).get('evaluated_at')),
        fareguard_prediction=fg, priceguard_anomaly=pg,
        index_eligibility=record.get('eligibility') or {'eligible':False,'reason_code':'UNEVALUATED'},
        shap_attribution={'drivers':drivers, 'base_value':explanation.get('base_value'), 'predicted_value':explanation.get('predicted_value'),
            'top_positive':[d for d in drivers if (d.get('impact') or d.get('attribution') or d.get('shap_value') or 0)>0],
            'top_negative':[d for d in drivers if (d.get('impact') or d.get('attribution') or d.get('shap_value') or 0)<0]} if explanation else None)
    label = provider or 'Source not recorded'
    window = f'{bucket} bucket · {exact} actual lead days' if exact is not None else 'Lead days not recorded'
    fare['audit']['lineage_steps'] = [
        dict(order=1,title='Raw Observation Imported' if fare['data_origin']=='IMPORTED' else 'Raw Observation Collected', timestamp=raw.get('collected_at'),detail=f'Captured from {label} via collector {collector}' if collector else f'Captured from {label}; collector not recorded',status='COMPLETED' if raw else 'NOT_RECORDED',verified=bool(raw)),
        dict(order=2,title='Raw Immutable Payload SHA-256',timestamp=raw.get('created_at'),detail=raw.get('response_hash') or 'Not recorded',status='COMPLETED' if raw.get('response_hash') else 'NOT_RECORDED'),
        dict(order=3,title='Field Parsing',timestamp=raw.get('created_at'),detail=parser or 'Parser version not recorded',status='COMPLETED' if parser else 'NOT_RECORDED'),
        dict(order=3,title='Canonical Normalization',timestamp=fare.get('created_at'),detail=window,status='COMPLETED'),
        dict(order=4,title='Validation',timestamp=fare.get('created_at'),detail=fare.get('validation_status'),status='COMPLETED'),
        dict(order=5,title='Deduplication',timestamp=fare.get('created_at'),detail='Duplicate preserved' if fare.get('is_duplicate') else 'Unique observation',status='COMPLETED'),
        dict(order=6,title='Feature Generation',timestamp=(record.get('feature') or {}).get('created_at'),detail='Stored observation feature vector' if record.get('feature') else 'Feature vector not recorded',status='COMPLETED' if record.get('feature') else 'NOT_RECORDED'),
        dict(order=6,title='FareGuard Prediction',timestamp=pred.get('created_at') if valid_prediction else None,detail=f"Expected fare: INR {fg['predicted_fare']:.2f}; model {fg['model_version']}" if valid_prediction else fg['reason'],status=fg['status']),
        dict(order=7,title='PriceGuard Classification',timestamp=stages.get('PRICEGUARD',{}).get('finished_at') or anomaly.get('detected_at'),detail=f"{pg['severity']} · percentile {pg['anomaly_percentile']}" if pg['status']=='SCORED' else pg['reason'],status=pg['status']),
        dict(order=8,title='SHAP',timestamp=(explanation or {}).get('created_at'),detail='Recorded explanation' if explanation else (stages.get('SHAP',{}).get('metadata') or {}).get('reason') or ('NOT_REQUIRED' if pg['status']=='SCORED' else 'PREDICTION_UNAVAILABLE'),status='COMPLETED' if explanation else 'SKIPPED'),
        dict(order=9,title='APIx Eligibility',timestamp=(record.get('eligibility') or {}).get('evaluated_at'),detail=(record.get('eligibility') or {}).get('reason_code') or 'UNEVALUATED',status='COMPLETED' if record.get('eligibility') else 'NOT_RECORDED')]
    for order, step in enumerate(fare['audit']['lineage_steps'], 1):
        step['order'] = order
    return fare
