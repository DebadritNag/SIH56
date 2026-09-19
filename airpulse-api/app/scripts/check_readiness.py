"""Read-only diagnostic: python -m app.scripts.check_readiness. Prints no credentials."""
import asyncio
import json
from sqlalchemy import text
from app.db.session import AsyncSessionLocal, engine
from app.services.readiness import load_index_readiness, load_shock_readiness


async def main():
    engine.echo = False
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text('SET TRANSACTION READ ONLY'))
            await db.execute(text("SET LOCAL statement_timeout = '20000'"))
            index = await load_index_readiness(db)
            shocks = await load_shock_readiness(db)
            from app.api.v1.alerts import confirmed_shocks
            confirmed = await confirmed_shocks(db=db, current_user=None)
            shocks['confirmed_count'] = confirmed.data['active_count']
            print(json.dumps({'apix':index,'shock_readiness':shocks},default=str,indent=2))
            await db.rollback()
    finally:
        await engine.dispose()


if __name__ == '__main__':
    try:
        asyncio.run(asyncio.wait_for(main(),timeout=45))
    except Exception as exc:
        # Connection URLs and query parameters may contain secrets; omit exception text.
        print(f'Readiness diagnostic failed: {type(exc).__name__}')
        raise SystemExit(1)
