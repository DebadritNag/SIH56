"""Read-only inventory; never imports, relabels, or generates observations."""
import asyncio
import json
from app.db.session import AsyncSessionLocal, engine
from app.services.live_store import rows

async def main():
    async with AsyncSessionLocal() as db:
        from app.services.data_context_resolver import DataContextResolver
        print(json.dumps({'context': (await DataContextResolver(db).resolve()).to_dict()},default=str))
        queries = {
            'origins': 'SELECT data_origin,validation_status,is_duplicate,count(*) FROM validated_fares GROUP BY 1,2,3',
            'coverage': "SELECT origin,destination,booking_window_days,count(*),min(collected_at),max(collected_at) FROM validated_fares WHERE data_origin IN ('LIVE','IMPORTED') GROUP BY 1,2,3",
            'runs': 'SELECT id,run_type,data_origin,status,created_at,metadata FROM collection_runs ORDER BY created_at DESC LIMIT 8',
            'references': 'SELECT dataset_name,status,row_count,metadata FROM reference_datasets',
            'indices': 'SELECT count(*) FROM airfare_index',
        }
        for name, sql in queries.items():
            try:
                async with db.begin_nested():
                    print(json.dumps({name: await rows(db, sql)},default=str))
            except Exception as exc:
                print(name, type(exc).__name__)
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
