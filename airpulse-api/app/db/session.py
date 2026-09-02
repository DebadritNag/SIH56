"""
Async SQLAlchemy engine + session factory for Supabase PostgreSQL.

Uses the ``postgresql+asyncpg`` driver with connection pooling. In production the
connection is made over SSL. The engine connects directly to Supabase PostgreSQL —
Supabase is treated purely as managed infrastructure; all application/analytics logic
runs here in FastAPI/Celery via SQLAlchemy, never through the Supabase REST client.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings


_DB_URL = settings.effective_pool_url
_USING_POOLER = "pooler.supabase.com" in _DB_URL or bool(settings.DATABASE_POOL_URL)


def _build_connect_args() -> dict:
    args: dict = {}
    # asyncpg negotiates SSL automatically for Supabase hosts, but require it in prod.
    if settings.is_production:
        args["ssl"] = True
    # Supabase transaction pooler (pgBouncer) does NOT support prepared statements;
    # asyncpg must disable statement caching or every query 500s.
    if _USING_POOLER:
        args["statement_cache_size"] = 0
    return args


# Primary async engine. Uses the transaction pooler (IPv4) in production; the pooler
# manages connections, so use NullPool to avoid double-pooling.
if _USING_POOLER:
    from sqlalchemy import NullPool

    engine: AsyncEngine = create_async_engine(
        _DB_URL,
        echo=settings.DEBUG,
        poolclass=NullPool,
        connect_args=_build_connect_args(),
    )
else:
    engine = create_async_engine(
        _DB_URL,
        echo=settings.DEBUG,
        pool_size=20,
        max_overflow=10,
        pool_recycle=1800,
        pool_pre_ping=True,
        connect_args=_build_connect_args(),
    )

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async DB session with rollback-on-error cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
