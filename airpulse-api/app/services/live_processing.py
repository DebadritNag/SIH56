"""Canonical live processing. Caller commits all analytical writes atomically.

ML failures are recorded as advisory outcomes and cannot replace observed fares
or prevent the independent statistical branch from running.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import math
import statistics
from uuid import uuid4

import pandas as pd
from sqlalchemy import text

from app.core.utils import bucket_from_lead_days, utc_now
from app.services.live_store import rows, insert, audit

IST = timezone(timedelta(hours=5, minutes=30))


def normalize_quote(raw):
    q = raw['raw_payload']
    observed = datetime.fromisoformat(q['provenance']['observed_at'].replace('Z', '+00:00'))
    if observed.tzinfo is None:
        raise ValueError('Observation timestamp has no timezone')
    origin, destination = q['origin'], q['destination']
    if origin == destination or len(origin) != 3 or len(destination) != 3:
        raise ValueError('Invalid route')
    if q.get('currency') != 'INR':
        raise ValueError('Unsupported currency')
    amount = Decimal(str(q['gross_total']))
    if not amount.is_finite() or not Decimal('500') <= amount <= Decimal('500000'):
        raise ValueError('Fare outside validation bounds')
    if not q.get('carrier') or not q.get('departure_time'):
        raise ValueError('Airline or departure time not observed')
    departure = datetime.fromisoformat(f"{q['departure_date']}T{q['departure_time']}").replace(tzinfo=IST)
    arrival = None
    if q.get('arrival_time'):
        arrival = datetime.combine(departure.date(), datetime.strptime(q['arrival_time'], '%H:%M').time(), IST)
        if arrival < departure:
            arrival += timedelta(days=1)
    days = (departure.date() - observed.astimezone(IST).date()).days
    if days < 0:
        raise ValueError('Departure precedes observation date')
    fingerprint = '|'.join(map(str, [raw['source_id'], origin, destination, departure.isoformat(),
                                    q['carrier'], q.get('flight_number'), amount, q.get('cabin_class', 'economy')]))
    return dict(raw_fare_id=raw['id'], collection_run_id=raw['collection_run_id'], source_id=raw['source_id'],
                data_origin='LIVE', airline=q['carrier'], flight_number=q.get('flight_number'),
                origin=origin, destination=destination, departure_at=departure, arrival_at=arrival,
                booking_window_days=days, cabin=q.get('cabin_class', 'economy'), fare_class=q.get('fare_class'),
                refundable=None, base_fare=q.get('base_price'), taxes=q.get('tax_amount'),
                mandatory_fees=q.get('mandatory_fees'), convenience_fee=None, total_fare=amount,
                normalized_total_fare=amount, currency='INR', validation_status='VALID',
                quote_hash=hashlib.sha256(fingerprint.encode()).hexdigest(), collected_at=observed)


async def calculate_live_index(db, pipeline_id):
    baskets = await rows(db, 'SELECT * FROM index_baskets WHERE active=true ORDER BY created_at DESC LIMIT 1')
    if not baskets or not baskets[0]['base_period_start'] or not baskets[0]['base_period_end']:
        return {'status': 'INSUFFICIENT_DATA', 'reason': 'No configured observed base period'}
    basket = baskets[0]
    weights = await rows(db, 'SELECT * FROM index_basket_routes WHERE basket_id=:id AND weight>0', id=basket['id'])
    today = utc_now().date()
    fares = await rows(db, """SELECT v.* FROM validated_fares v
        WHERE v.validation_status='VALID' AND NOT v.is_duplicate AND v.cabin='economy'
          AND v.data_origin IN ('LIVE','IMPORTED') AND v.collected_at >= :base
          AND v.collected_at < :tomorrow
          AND EXISTS (SELECT 1 FROM fare_index_eligibility e WHERE e.fare_id=v.id AND e.eligible)""",
        base=datetime.combine(basket['base_period_start'], datetime.min.time(), timezone.utc),
        tomorrow=datetime.combine(today+timedelta(days=1), datetime.min.time(), timezone.utc))
    current, baseline = defaultdict(list), defaultdict(list)
    for fare in fares:
        key = (fare['route_id'], bucket_from_lead_days(fare['booking_window_days']))
        day = fare['collected_at'].date()
        if day == today:
            current[key].append(fare)
        if basket['base_period_start'] <= day <= basket['base_period_end']:
            baseline[key].append(float(fare['normalized_total_fare']))
    components, observed = [], []
    for weight in weights:
        key = (weight['route_id'], bucket_from_lead_days(weight['booking_window_days']))
        if not current[key] or not baseline[key]:
            continue
        base = statistics.median(baseline[key])
        price = statistics.median(float(f['normalized_total_fare']) for f in current[key])
        components.append(dict(route_id=weight['route_id'], booking_window_days=weight['booking_window_days'],
            base_price=base, current_price=price, price_relative=price/base,
            weight=float(weight['weight']), weighted_contribution=float(weight['weight'])*price/base,
            eligible_observations=len(current[key])))
        observed.extend(current[key])
    if not components:
        return {'status': 'INSUFFICIENT_DATA', 'reason': 'No route/window matches against observed base fares'}
    value = 100*sum(c['weighted_contribution'] for c in components)/sum(c['weight'] for c in components)
    coverage = sum(c['weight'] for c in components)/sum(float(w['weight']) for w in weights)
    index_id = await insert(db, 'airfare_index', index_date=today, index_type='national', index_value=value,
        basket_version=basket['version'], methodology_version='apix-live-matched-v1', calculated_at=utc_now(),
        metadata={'pipeline_run_id':str(pipeline_id), 'sample_count':len(observed),
                  'live_count':sum(f['data_origin']=='LIVE' for f in observed),
                  'imported_count':sum(f['data_origin']=='IMPORTED' for f in observed),
                  'matched_weight_coverage':coverage, 'base_period_start':str(basket['base_period_start']),
                  'base_period_end':str(basket['base_period_end'])})
    for component in components:
        await insert(db, 'index_components', airfare_index_id=index_id, **component)
    return {'status':'COMPLETED','index_id':str(index_id),'index_value':value,'sample_count':len(observed)}


async def process_live_fares(db, run_id, pipeline_id):
    """No commit here: either all canonical results become visible or none do."""
    raw = await rows(db, 'SELECT * FROM raw_fares WHERE collection_run_id=:id ORDER BY created_at,id', id=run_id)
    stages = []
    async def stage(name, count, status='COMPLETED', message='', started=None, metadata=None):
        end = utc_now()
        await insert(db, 'pipeline_steps', pipeline_run_id=pipeline_id, step_name=name,
            step_order=len(stages), status=status, started_at=started or end, finished_at=end,
            records_input=len(raw), records_output=count, message=message, metadata=metadata or {})
        await audit(db, run_id, f'LIVE_{name}', {'pipeline_run_id':str(pipeline_id),'status':status,'count':count})
        stages.append({'stage':name,'status':status,'count':count,'message':message})

    await stage('INGEST', len(raw))
    accepted, rejected, duplicates = [], [], 0
    started = utc_now()
    for record in raw:
        try:
            canonical = normalize_quote(record)
            route = await rows(db, 'SELECT id,distance_km FROM routes WHERE route_code=:code',
                               code=f"{canonical['origin']}-{canonical['destination']}")
            if not route:
                raise ValueError('Route is not configured')
            canonical['route_id'] = route[0]['id']
            equivalent = await rows(db, 'SELECT id FROM validated_fares WHERE quote_hash=:hash LIMIT 1', hash=canonical['quote_hash'])
            canonical['is_duplicate'] = bool(equivalent)
            canonical['duplicate_group_id'] = equivalent[0]['id'] if equivalent else None
            fare_id = await insert(db, 'validated_fares', **canonical)
            eligible = not equivalent
            await insert(db, 'fare_index_eligibility', fare_id=fare_id, eligible=eligible,
                         reason_code='VALID' if eligible else 'DUPLICATE', methodology_version='apix-live-matched-v1')
            if eligible:
                accepted.append({**canonical,'id':fare_id,'distance_km':route[0]['distance_km']})
            else:
                duplicates += 1
        except (KeyError, ValueError, TypeError) as exc:
            rejected.append({'raw_fare_id':str(record['id']),'reason':str(exc)})
    await stage('NORMALIZE', len(accepted)+duplicates, started=started)
    await stage('VALIDATE', len(accepted)+duplicates, message=f'{len(rejected)} rejected', metadata={'rejections':rejected})
    await stage('DEDUP', len(accepted), message=f'{duplicates} duplicate provenance records preserved')

    feature_rows, feature_fares = [], []
    from app.ml.features import FeatureBuilder
    for fare in accepted:
        history = await rows(db, """SELECT normalized_total_fare FROM validated_fares
            WHERE route_id=:route AND collected_at<:observed AND collected_at>=:since
              AND validation_status='VALID' AND NOT is_duplicate AND data_origin IN ('LIVE','IMPORTED')""",
            route=fare['route_id'], observed=fare['collected_at'], since=fare['collected_at']-timedelta(days=30))
        values = [float(r['normalized_total_fare']) for r in history]
        if not values or not fare['distance_km']:
            continue
        med, std = statistics.median(values), statistics.pstdev(values)
        # Missing external features remain missing for XGBoost; no fabricated fuel/demand.
        features = FeatureBuilder.build_features_for_fare(str(fare['id']), fare['departure_at'],
            fare['booking_window_days'], float(fare['distance_km']), fare['airline'], fare['cabin'],
            fuel_price=float('nan'), synthetic_demand_score=float('nan'), route_recent_median=med,
            route_recent_std=std)
        features['actual_fare'] = float(fare['total_fare'])
        feature_rows.append(features)
        feature_fares.append(fare)
        clean_features = {k:None if isinstance(v,float) and not math.isfinite(v) else v for k,v in features.items()}
        await insert(db,'fare_features',fare_id=fare['id'],route_id=fare['route_id'],
            booking_window_days=fare['booking_window_days'],day_of_week=features['day_of_week'],
            is_weekend=bool(features['is_weekend']),season=features['season'],distance_km=float(fare['distance_km']),
            route_recent_median=med,route_recent_std=std,route_volatility=features['route_recent_volatility'],
            feature_version='live-observed-v1',features=clean_features)
    await stage('FEATURES',len(feature_rows),message='Only prior observed fares used; missing external features retained as null')

    predicted, scored, explained = 0, 0, 0
    from app.ml.model_registry import ModelRegistryService
    import asyncio
    try:
        fg = ModelRegistryService.get_fareguard()
        if not fg.is_trained or not feature_rows:
            raise ValueError('MODEL_UNAVAILABLE or INSUFFICIENT_FEATURES')
        frame = pd.DataFrame(feature_rows)
        predictions = await asyncio.to_thread(fg.predict_batch, frame)
        pairs = []
        for i, fare in enumerate(feature_fares):
            prediction = float(predictions[i])
            if not math.isfinite(prediction) or prediction <= 0:
                continue
            residual = float(fare['total_fare'])-prediction
            prediction_id = await insert(db,'fare_predictions',fare_id=fare['id'],model_version=fg.version,
                predicted_fare=prediction,residual=residual,residual_pct=100*residual/prediction)
            frame.loc[i,'predicted_fare'] = prediction
            frame.loc[i,'residual'] = residual
            frame.loc[i,'residual_pct'] = 100*residual/prediction
            pairs.append((i,fare,prediction_id))
            predicted += 1
        await stage('FAREGUARD',predicted)
        pg = ModelRegistryService.get_priceguard()
        if not pg.is_trained or pg.training_scores is None or not pairs:
            raise ValueError('PRICEGUARD_MODEL_UNAVAILABLE')
        scores = await asyncio.to_thread(pg.score_batch,frame.loc[[i for i,_,_ in pairs]])
        explainer = ModelRegistryService.get_explainer()
        for (i,fare,pred_id), score in zip(pairs,scores):
            scored += 1
            if not score['is_anomaly']:
                continue
            anom_id = await insert(db,'anomalies',fare_id=fare['id'],prediction_id=pred_id,
                route_id=fare['route_id'],source_id=fare['source_id'],severity=score['severity'].upper(),status='OPEN',
                anomaly_type=score['anomaly_type'],anomaly_score=score['isolation_score'],
                anomaly_percentile=score['anomaly_percentile'],actual_fare=float(fare['total_fare']),
                expected_fare=float(frame.loc[i,'predicted_fare']),residual=float(frame.loc[i,'residual']),
                residual_pct=float(frame.loc[i,'residual_pct']),evidence={'data_origin':'LIVE','pipeline_run_id':str(pipeline_id)})
            if explainer.explainer is not None:
                explanation = await asyncio.to_thread(explainer.explain_fare,frame.loc[i],
                    float(fare['total_fare']),float(frame.loc[i,'predicted_fare']),score['anomaly_percentile'])
                await insert(db,'shap_explanations',anomaly_id=anom_id,model_version=fg.version,
                    base_value=explanation['base_value'],predicted_value=explanation['predicted_fare'],features=explanation['drivers'])
                explained += 1
            await insert(db,'alerts',alert_type='FARE_ANOMALY',severity=score['severity'].upper(),status='OPEN',
                title='Live fare requires analyst review',message='Statistically unusual valid fare; not automatically excluded from APIx.',
                route_id=fare['route_id'],source_id=fare['source_id'],anomaly_id=anom_id,
                metadata={'pipeline_run_id':str(pipeline_id)})
        await stage('PRICEGUARD',scored)
        await stage('SHAP',explained, message='Only actual TreeExplainer outputs persisted')
    except Exception as exc:
        # Model errors must not manufacture outputs or abort the index branch.
        for name in ('FAREGUARD','PRICEGUARD','SHAP'):
            if not any(s['stage']==name for s in stages):
                await stage(name,0,'SKIPPED',str(exc)[:300])

    index = await calculate_live_index(db,pipeline_id)
    await stage('APIX',1 if index['status']=='COMPLETED' else 0,
                'COMPLETED' if index['status']=='COMPLETED' else 'SKIPPED',metadata=index)
    await stage('ALERTS',len(await rows(db,"SELECT id FROM alerts WHERE metadata->>'pipeline_run_id'=:id",id=str(pipeline_id))))
    return dict(records_input=len(raw),records_processed=len(accepted),records_failed=len(rejected),
                duplicates=duplicates,fareguard_scored=predicted,priceguard_scored=scored,shap_count=explained,
                index=index,stages=stages,ingestion_state='COMPLETED')
