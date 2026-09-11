"""Idempotent repair of deterministic LIVE relationships; raw payloads never change."""
import argparse
import asyncio
import json
from uuid import UUID
from sqlalchemy import text
from app.db.session import AsyncSessionLocal, engine
from app.services.live_store import rows, audit


def plan_repair(row):
    source_ids = {str(v) for v in (row.get('source_id'), row.get('raw_source_id'), row.get('run_source_id')) if v}
    run_ids = {str(v) for v in (row.get('collection_run_id'), row.get('raw_run_id')) if v}
    if len(source_ids)>1 or len(run_ids)>1:
        return 'ambiguous', {}
    changes = {}
    if len(run_ids)!=1 or len(source_ids)!=1:
        return 'ambiguous', {}
    if not row.get('source_id'):
        changes['source_id'] = next(iter(source_ids))
    if not row.get('collection_run_id'):
        changes['collection_run_id'] = next(iter(run_ids))
    pipelines = row.get('pipelines') or []
    explicit = [p for p in pipelines if str(row['id']) in (p.get('metadata') or {}).get('processed_fare_ids',[])]
    if not explicit:
        if len(pipelines)!=1:
            return 'ambiguous', {}
        changes['pipeline_run_id'] = str(pipelines[0]['id'])
    return ('repairable' if changes else 'unchanged'), changes


async def repair(db, apply=False):
    if apply:
        await db.execute(text('SELECT pg_advisory_xact_lock(26056)'))
    records = await rows(db, """SELECT v.id,v.source_id,v.collection_run_id,
        r.source_id AS raw_source_id,r.collection_run_id AS raw_run_id,c.source_id AS run_source_id,
        coalesce(p.pipelines,'[]'::jsonb) AS pipelines
        FROM validated_fares v LEFT JOIN raw_fares r ON r.id=v.raw_fare_id
        LEFT JOIN collection_runs c ON c.id=coalesce(v.collection_run_id,r.collection_run_id)
        LEFT JOIN LATERAL (SELECT jsonb_agg(to_jsonb(p)) AS pipelines FROM pipeline_runs p
            WHERE p.status IN ('COMPLETED','PARTIAL') AND
             (p.metadata->'processed_fare_ids' ? v.id::text OR
              (p.collection_run_id=c.id AND p.pipeline_type='live_ingestion'))) p ON true
        WHERE v.data_origin='LIVE' ORDER BY v.id""")
    report = dict(records_examined=len(records),records_repairable=0,records_ambiguous=0,records_unchanged=0,records_repaired=0,mode='apply' if apply else 'dry-run')
    for row in records:
        status, changes = plan_repair(row)
        report[f'records_{status}'] += 1
        if not apply or status != 'repairable':
            continue
        for field in ('source_id','collection_run_id'):
            if field in changes:
                await db.execute(text(f'UPDATE validated_fares SET {field}=:value WHERE id=:id AND {field} IS NULL'), {'id':row['id'],'value':UUID(changes[field])})
        if changes.get('pipeline_run_id'):
            await db.execute(text("""UPDATE pipeline_runs SET metadata=coalesce(metadata,'{}'::jsonb)
                || jsonb_build_object('processed_fare_ids',coalesce(metadata->'processed_fare_ids','[]'::jsonb) || CAST(:fare AS jsonb),
                    'ingestion_run_id',coalesce(metadata->>'ingestion_run_id',id::text))
                WHERE id=:id AND NOT coalesce(metadata->'processed_fare_ids','[]'::jsonb) ? :fare_id"""),
                {'id':UUID(changes['pipeline_run_id']),'fare':json.dumps([str(row['id'])]),'fare_id':str(row['id'])})
        run_id = row.get('collection_run_id') or row.get('raw_run_id')
        await audit(db, run_id, 'LIVE_PROVENANCE_REPAIRED', {'fare_id':str(row['id']),'changes':changes,'repair_version':'live-lineage-v1'})
        report['records_repaired'] += 1
    return report


async def main(apply=False):
    try:
        async with asyncio.timeout(90):
            async with AsyncSessionLocal() as db:
                report = await repair(db, apply)
                if apply:
                    await db.commit()
                print(json.dumps(report, indent=2))
                return 0
    except Exception as exc:
        print(json.dumps({'status':'FAILED','error_type':type(exc).__name__}))
        return 1
    finally:
        await engine.dispose()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.apply)))
