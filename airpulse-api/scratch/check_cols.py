import asyncio
import sys
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as session:
        for tbl in ['validated_fares', 'collection_runs', 'pipeline_runs', 'pipeline_steps', 'raw_fares', 'fare_predictions', 'anomalies']:
            res = await session.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{tbl}'
                ORDER BY ordinal_position
            """))
            cols = [r[0] for r in res.fetchall()]
            print(f"{tbl}: {cols}")

if __name__ == "__main__":
    asyncio.run(check())
