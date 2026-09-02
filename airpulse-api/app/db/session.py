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


def _build_connect_args() -> dict:
    # asyncpg negotiates SSL automatically for Supabase hosts, but we require it in prod.
    if settings.is_production:
        return {"ssl": True}
    return {}


# Primary async engine. Uses the pooled URL when configured (transaction pooler),
# otherwise the direct URL.
engine: AsyncEngine = create_async_engine(
    settings.effective_pool_url,
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
