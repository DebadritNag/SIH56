"""Parameterized persistence against the verified hosted schema.

Table/column names are internal constants, never supplied by API callers.
JSON evidence is immutable after the raw_fares INSERT.
"""
import json
from uuid import uuid4
from sqlalchemy import text


async def rows(db, sql, **params):
    return [dict(r) for r in (await db.execute(text(sql), params)).mappings()]


async def insert(db, table, **values):
    allowed = {'collection_runs', 'pipeline_runs', 'pipeline_steps', 'raw_fares',
               'validated_fares', 'fare_index_eligibility', 'fare_features',
               'fare_predictions', 'anomalies', 'shap_explanations', 'alerts',
               'audit_events', 'airfare_index', 'index_components'}
    if table not in allowed:
        raise ValueError('Unknown persistence table')
    values.setdefault('id', uuid4())
    expressions = []
    for key, value in values.items():
        if not key.replace('_', '').isalnum():
            raise ValueError('Invalid internal column')
        if isinstance(value, (dict, list)):
            values[key] = json.dumps(value, default=str, allow_nan=False)
            expressions.append(f'CAST(:{key} AS jsonb)')
        else:
            expressions.append(f':{key}')
    await db.execute(text(f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join(expressions)})"), values)
    return values['id']


async def audit(db, run_id, action, metadata=None, actor=None):
    await insert(db, 'audit_events', actor_id=actor, action=action,
                 entity_type='collection_run', entity_id=str(run_id), metadata=metadata or {})
