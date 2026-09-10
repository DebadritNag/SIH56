"""Read confirmed shock alerts; never promote anomaly records into shocks."""
import math
from datetime import datetime
from app.config import settings
from app.core.utils import utc_now


def confirmed_live_shock(alert, now=None):
    now = now or utc_now()
    meta = alert.get('metadata') or {}
    if str(alert.get('alert_type', '')).upper() != 'PRICE_SHOCK':
        return None
    if str(alert.get('status', '')).upper() not in ('OPEN', 'ACKNOWLEDGED'):
        return None
    # Legacy alerts without explicit provenance cannot be certified as LIVE.
    if str(meta.get('data_origin', '')).upper() != 'LIVE':
        return None
    if str(meta.get('pipeline_mode', '')).upper() in ('REPLAY', 'SYNTHETIC', 'DEMO', 'MODELLED'):
        return None
    if meta.get('expires_at'):
        try:
            expiry = datetime.fromisoformat(str(meta['expires_at']).replace('Z', '+00:00'))
            if expiry <= now:
                return None
        except (ValueError, TypeError):
            return None
    try:
        values = {k:float(meta[k]) for k in ('source_count','quote_count','percentage_change','robust_zscore','current_median','historical_median')}
        if not all(math.isfinite(n) for n in values.values()):
            return None
        if (values['source_count'] < settings.SHOCK_MIN_SOURCE_COUNT or
            values['quote_count'] < settings.SHOCK_MIN_QUOTE_COUNT or
            values['percentage_change'] < settings.SHOCK_MIN_PRICE_CHANGE_PCT or
            values['robust_zscore'] < settings.SHOCK_MIN_ROBUST_ZSCORE or
            min(values['current_median'],values['historical_median']) <= 0):
            return None
    except (KeyError, TypeError, ValueError):
        return None
    return {'id':str(alert['id']), 'route':alert.get('route_code') or 'Not recorded',
            'window':meta.get('booking_window') or '—', 'surgePct':values['percentage_change'],
            'medianFare':values['current_median'], 'baselineFare':values['historical_median'],
            'agreementCount':f"{int(values['source_count'])} Sources", 'carriers':meta.get('carriers') or 'Not recorded',
            'detectedAt':str(alert.get('created_at') or ''), 'status':'CONFIRMED'}
