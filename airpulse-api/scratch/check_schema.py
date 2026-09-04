import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        for tbl in ['collection_runs', 'pipeline_runs', 'pipeline_steps', 'sources']:
            r = await db.execute(text("""
                SELECT column_name, data_type, udt_name 
                FROM information_schema.columns 
                WHERE table_name = :tbl
                ORDER BY ordinal_position;
            """), {"tbl": tbl})
            cols = r.fetchall()
            print(f"=== {tbl} ===")
            for c in cols:
                print(f"  {c[0]}: {c[1]} ({c[2]})")

        r = await db.execute(text("""
            SELECT column_name, is_generated, generation_expression 
            FROM information_schema.columns 
            WHERE table_name = 'sources';
        """))
        for row in r.fetchall():
            if row[1] != 'NEVER':
                print("GENERATED COLUMN IN sources:", row)

if __name__ == "__main__":
    asyncio.run(check())
