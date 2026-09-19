"""Read-only readiness projections. Never calculate or promote analytical results."""
from datetime import datetime, timedelta, timezone
from app.core.utils import bucket_from_lead_days, utc_now
from app.services.live_store import rows

# Shared with the observed index calculator; no additional history threshold.
INDEX_ELIGIBILITY_SQL = """v.validation_status='VALID' AND NOT v.is_duplicate AND v.cabin='economy'
    AND v.data_origin IN ('LIVE','IMPORTED')
    AND EXISTS (SELECT 1 FROM fare_index_eligibility e WHERE e.fare_id=v.id AND e.eligible)"""


def index_readiness(groups, basket, weights, today, latest=None):
    keys = {(str(w['route_id']), bucket_from_lead_days(w['booking_window_days'])) for w in weights}
    eligible = [g for g in groups if g['data_origin'] in ('LIVE','IMPORTED')
                and (not keys or (str(g['route_id']), g['window']) in keys)]
    dates = sorted({str(g['observed_date']) for g in eligible})
    base_start = basket.get('base_period_start') if basket else None
    base_end = basket.get('base_period_end') if basket else None
    base = {(str(g['route_id']), g['window']) for g in eligible
            if base_start and base_end and str(base_start) <= str(g['utc_date']) <= str(base_end)}
    current = {(str(g['route_id']), g['window']) for g in eligible if str(g['utc_date']) == str(today)
               and (not base_start or str(g['utc_date']) >= str(base_start))}
    matched = keys & base & current
    status = ('READY' if latest else 'NO_ELIGIBLE_DATA' if not eligible else
              'MISSING_BASE_PERIOD' if not base_start or not base_end else
              'MISSING_WEIGHTS' if not keys else 'MISSING_ROUTE_COVERAGE' if not matched else 'AWAITING_CALCULATION')
    def count(part):
        return sum(int(g['count']) for g in part)
    def coverage(part):
        return dict(observation_days=len({str(g['observed_date']) for g in part}), observations=count(part),
                    windows=sorted({g['window'] for g in part}))
    daily = [dict(date=d, observations=count([g for g in eligible if str(g['observed_date']) == d]),
                  live_count=count([g for g in eligible if str(g['observed_date']) == d and g['data_origin']=='LIVE']),
                  imported_count=count([g for g in eligible if str(g['observed_date']) == d and g['data_origin']=='IMPORTED']),
                  routes=sorted({g['route_code'] for g in eligible if str(g['observed_date'])==d}),
                  windows=sorted({g['window'] for g in eligible if str(g['observed_date'])==d})) for d in dates]
    route_ids = {str(w['route_id']): w.get('route_code', str(w['route_id'])) for w in weights}
    if not weights:
        route_ids = {str(g['route_id']):g['route_code'] for g in eligible}
    def state(found, required):
        return 'UNAVAILABLE' if not required else 'MET' if required <= found else 'PARTIAL' if required & found else 'NOT_MET'
    return dict(status=status, required_days=None, collected_days=len(dates), remaining_days=None,
        history_note='No minimum day count is configured in the active methodology. An observed base period and matching route/window references are required.',
        eligible_origins=['LIVE','IMPORTED'], eligible_observations=count(eligible),
        live_days=len({str(g['observed_date']) for g in eligible if g['data_origin']=='LIVE'}),
        imported_days=len({str(g['observed_date']) for g in eligible if g['data_origin']=='IMPORTED'}),
        distinct_observation_dates=daily, eligible_route_count=len({g['route_id'] for g in eligible}),
        base_period=dict(configured=bool(base_start and base_end), start=base_start, end=base_end,
                         available_components=len(keys & base), required_components=len(keys), status=state(base, keys)),
        requirements=dict(history='UNAVAILABLE', weights='MET' if keys else 'NOT_MET',
                          base=state(base, keys), current=state(current, keys), matched=state(matched, keys)),
        routes=[dict(route=code, **coverage([g for g in eligible if str(g['route_id'])==rid]),
                     base_status=state(base, {k for k in keys if k[0]==rid})) for rid,code in sorted(route_ids.items())],
        booking_windows=[dict(window=w, **coverage([g for g in eligible if g['window']==w]),
                             base_status=state(base,{k for k in keys if k[1]==w})) for w in sorted({k[1] for k in keys} or {g['window'] for g in eligible}, key=lambda x:int(x[2:]))],
        methodology_version='apix-live-matched-v1', latest_index_id=str(latest['id']) if latest else None)


async def load_index_readiness(db):
    baskets = await rows(db, 'SELECT * FROM index_baskets WHERE active=true ORDER BY created_at DESC LIMIT 1')
    basket = baskets[0] if baskets else None
    weights = await rows(db, '''SELECT w.*,r.route_code FROM index_basket_routes w JOIN routes r ON r.id=w.route_id
        WHERE w.basket_id=:id AND w.weight>0 AND (w.effective_from IS NULL OR w.effective_from<=CURRENT_DATE)
        AND (w.effective_to IS NULL OR w.effective_to>=CURRENT_DATE)''', id=basket['id']) if basket else []
    # Aggregate on the server; no raw fares or ML modules loaded into API memory.
    groups = await rows(db, f'''SELECT v.route_id,r.route_code,v.data_origin,
        (v.collected_at AT TIME ZONE 'Asia/Kolkata')::date AS observed_date,
        (v.collected_at AT TIME ZONE 'UTC')::date AS utc_date,
        CASE WHEN v.booking_window_days<=2 THEN 'T+1' WHEN v.booking_window_days<=10 THEN 'T+7'
          WHEN v.booking_window_days<=20 THEN 'T+15' WHEN v.booking_window_days<=37 THEN 'T+30' ELSE 'T+45' END AS window,
        count(*) AS count FROM validated_fares v JOIN routes r ON r.id=v.route_id
        WHERE {INDEX_ELIGIBILITY_SQL} AND v.collected_at<:tomorrow
        GROUP BY 1,2,3,4,5,6''', tomorrow=datetime.combine(utc_now().date()+timedelta(days=1), datetime.min.time(), timezone.utc))
    latest = await rows(db, "SELECT id FROM airfare_index WHERE methodology_version='apix-live-matched-v1' AND index_type='national' ORDER BY index_date DESC,calculated_at DESC LIMIT 1")
    return index_readiness(groups,basket,weights,utc_now().date(),latest[0] if latest else None)


def shock_readiness(groups, settings):
    # Only observed LIVE channels count; repeated rows/runs never increase diversity.
    live = [g for g in groups if g.get('data_origin')=='LIVE' and g.get('source_id')]
    sources = sorted({str(g['source_id']) for g in live})
    required = settings.SHOCK_MIN_SOURCE_COUNT
    return dict(status='INSUFFICIENT_SOURCE_COVERAGE' if len(sources)<required else 'SOURCE_COVERAGE_AVAILABLE',
        available_sources=len(sources), required_sources=required, remaining_sources=max(required-len(sources),0),
        shock_threshold_pct=settings.SHOCK_MIN_PRICE_CHANGE_PCT, min_quotes=settings.SHOCK_MIN_QUOTE_COUNT,
        min_robust_zscore=settings.SHOCK_MIN_ROBUST_ZSCORE, synchronization_window_minutes=None,
        coverage_period='Current UTC observation day', candidate_count=None, candidates=None,
        eligible_routes=len({g['route_code'] for g in live}),
        latest_observed_at=max((str(g['latest']) for g in live),default=None),
        sources=[dict(id=s, name=next(g['name'] for g in live if str(g['source_id'])==s),
            latest=max(str(g['latest']) for g in live if str(g['source_id'])==s),
            routes=sorted({g['route_code'] for g in live if str(g['source_id'])==s}),
            windows=sorted({g['window'] for g in live if str(g['source_id'])==s})) for s in sources],
        note='Coverage counts distinct source IDs in validated LIVE observations for the current UTC day. Coverage alone does not confirm a shock. Imported fares are historical context, not live confirmation channels.')


async def load_shock_readiness(db):
    from app.config import settings
    today = datetime.combine(utc_now().date(),datetime.min.time(),timezone.utc)
    groups = await rows(db, '''SELECT v.source_id,coalesce(s.display_name,s.name) AS name,r.route_code,
        v.data_origin,max(v.collected_at) AS latest,
        CASE WHEN v.booking_window_days<=2 THEN 'T+1' WHEN v.booking_window_days<=10 THEN 'T+7'
          WHEN v.booking_window_days<=20 THEN 'T+15' WHEN v.booking_window_days<=37 THEN 'T+30' ELSE 'T+45' END AS window
        FROM validated_fares v JOIN sources s ON s.id=v.source_id JOIN routes r ON r.id=v.route_id
        WHERE v.data_origin='LIVE' AND v.validation_status='VALID' AND NOT v.is_duplicate
          AND v.collected_at>=:today AND v.collected_at<:tomorrow
        GROUP BY 1,2,3,4,6''',today=today,tomorrow=today+timedelta(days=1))
    return shock_readiness(groups,settings)
