import asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def test_insert():
    async with AsyncSessionLocal() as db:
        # Check existing collection runs
        res = await db.execute(text("SELECT count(*) FROM collection_runs"))
        print("Existing collection_runs count:", res.scalar())
        
        # Check source id
        src_res = await db.execute(text("SELECT id, name FROM sources WHERE name = 'ota_source_01'"))
        src = src_res.fetchone()
        source_id = str(src[0]) if src else None
        print("Source:", src)
        
        col_id = str(uuid4())
        started_at = datetime(2026, 9, 2, 15, 0, 2, tzinfo=timezone.utc)
        finished_at = datetime(2026, 9, 2, 15, 6, 41, tzinfo=timezone.utc)
        
        # Insert test CollectionRun
        insert_sql = text("""
            INSERT INTO collection_runs (
                id, source_id, run_type, trigger_type, data_origin,
                started_at, finished_at, status, routes_requested, searches_requested,
                requests_successful, requests_failed, quotes_received, quotes_validated,
                quotes_rejected, duplicates_detected, duration_ms, collector_version,
                parser_version, created_at, metadata
            ) VALUES (
                :id, :source_id, 'file_import', 'MANUAL', 'IMPORTED',
                :started_at, :finished_at, 'COMPLETED', 3, 3,
                3, 0, 18, 18,
                0, 0, 399000, 'goibibo-ota-v1.2.0',
                'goibibo-csv-importer-v1.0.0', :started_at,
                '{"source": "Goibibo Domestic Scrape", "corridors": ["BOM-BLR", "DEL-CCU", "DEL-BOM"], "notes": "18 verified civil aviation flight observations ingested from Goibibo CSV dataset."}'::jsonb
            )
        """)
        await db.execute(insert_sql, {
            "id": col_id,
            "source_id": source_id,
            "started_at": started_at,
            "finished_at": finished_at,
        })
        
        # Also create PipelineRun
        pipe_id = str(uuid4())
        pipe_sql = text("""
            INSERT INTO pipeline_runs (
                id, collection_run_id, pipeline_type, started_at, finished_at,
                status, records_input, records_processed, records_failed, version,
                created_at
            ) VALUES (
                :id, :col_id, 'batch_ingestion', :started_at, :finished_at,
                'COMPLETED', 18, 18, 0, '1.0.0', :started_at
            )
        """)
        await db.execute(pipe_sql, {
            "id": pipe_id,
            "col_id": col_id,
            "started_at": started_at,
            "finished_at": finished_at,
        })
        
        # Link raw_fares and validated_fares
        await db.execute(text("UPDATE raw_fares SET collection_run_id = :col_id WHERE collection_run_id IS NULL"), {"col_id": col_id})
        await db.execute(text("UPDATE validated_fares SET collection_run_id = :col_id WHERE collection_run_id IS NULL"), {"col_id": col_id})
        
        await db.commit()
        print("Success! Created CollectionRun:", col_id)

if __name__ == "__main__":
    asyncio.run(test_insert())
