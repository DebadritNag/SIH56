"""
Shared pytest fixtures for AirPulse Supabase foundation tests.

Database-backed tests require a reachable PostgreSQL (the hosted Supabase project or a
local Postgres) via ``DATABASE_URL_SYNC``. When the DB is unreachable or still using the
localhost placeholder, those tests are skipped so the suite stays green in offline CI.

Every DB test runs inside a transaction that is rolled back at the end, so the database
is never mutated permanently (except the auth-trigger test which manages its own cleanup).
"""
from __future__ import annotations

import os
import uuid

import pytest

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    _HAS_PSYCOPG2 = True
except Exception:  # pragma: no cover
    _HAS_PSYCOPG2 = False

from app.config import settings


def _dsn() -> str:
    # psycopg2 wants a plain postgresql:// DSN (no +driver suffix).
    return settings.DATABASE_URL_SYNC.replace("postgresql+psycopg2", "postgresql")


def _db_reachable() -> bool:
    if not _HAS_PSYCOPG2:
        return False
    if "localhost" in _dsn() or "[YOUR-DB-PASSWORD]" in _dsn():
        # Placeholder / unconfigured — treat as unreachable to skip DB tests.
        if os.getenv("AIRPULSE_FORCE_DB_TESTS") != "1":
            return False
    try:
        conn = psycopg2.connect(_dsn(), connect_timeout=5)
        conn.close()
        return True
    except Exception:
        return False


db_required = pytest.mark.skipif(not _db_reachable(), reason="PostgreSQL not reachable / not configured")


@pytest.fixture()
def conn():
    """A psycopg2 connection whose work is rolled back after each test."""
    connection = psycopg2.connect(_dsn(), cursor_factory=RealDictCursor)
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


@pytest.fixture()
def cur(conn):
    with conn.cursor() as cursor:
        yield cursor
    # No commit: fixture teardown rolls the connection back.


@pytest.fixture()
def seed_ids(cur):
    """Fetch a source_id and route_id from seeded reference data for FK-valid inserts."""
    cur.execute("SELECT id FROM public.sources ORDER BY priority LIMIT 1")
    source = cur.fetchone()
    cur.execute("SELECT id, origin_airport_id, destination_airport_id FROM public.routes LIMIT 1")
    route = cur.fetchone()
    return {"source_id": source["id"] if source else None, "route": route}


def new_uuid() -> str:
    return str(uuid.uuid4())
