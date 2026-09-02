# AirPulse — Supabase Backend Foundation

This document describes the Supabase infrastructure for **AirPulse** and how it fits the
architecture: **Supabase is infrastructure; FastAPI is the application.**

- **Project:** `airpulse`
- **Project ref:** `bbvdujskgbqjhawwgxsa`
- **Region:** `ap-south-1` (Mumbai)
- **Project URL:** `https://bbvdujskgbqjhawwgxsa.supabase.co`
- **PostgreSQL:** 17

## Role of each component

| Component | Responsibility |
|-----------|----------------|
| Supabase PostgreSQL | Canonical data store. FastAPI/Celery connect directly via SQLAlchemy 2.x async + asyncpg. |
| Supabase Auth | User identity. Frontend gets a JWT; FastAPI validates it and resolves role from `profiles`. |
| Supabase Realtime | A small set of operational tables broadcast state changes to the UI. |
| Supabase Storage | Large raw payloads, imported datasets, reference files, reports, model artifacts. |
| Alembic | Single source of truth for schema migrations. |
| FastAPI | All application/analytics logic. Never replaced by Supabase REST. |

The Supabase REST client is **not** used as the analytics data layer. The frontend
normally reads business data through FastAPI; direct Supabase access is limited to
auth, optional Realtime subscriptions, and authorized Storage downloads (signed URLs).

## Environment variables

Backend-only secrets (never expose to the browser, never commit, never log):
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `DATABASE_POOL_URL`.

Frontend-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

See `.env.example` for the full list with the project's real URL/anon key. The database
password and service-role key/JWT secret must be copied from the Supabase Dashboard
(Project Settings → Database / API).

## Schema (Alembic = source of truth)

The full schema — native enums, tables, indexes, constraints, the `profiles` auth
trigger, the `raw_fares` immutability trigger, RLS, the Realtime publication, DB
functions, materialized views, and the `dataset_catalog` view — is defined in:

- `alembic/versions/20260902120000_0001_airpulse_initial_schema.py`
- `alembic/versions/sql/0001_airpulse_initial.sql`

The canonical SQLAlchemy ORM models (PostgreSQL-native types: UUID, JSONB, TIMESTAMPTZ,
NUMERIC, ENUM) live in `app/db/schema.py`, with enum definitions in `app/db/enums.py`.

### Applying migrations

- **Fresh environment (local Docker Postgres / CI):**
  ```bash
  alembic upgrade head
  ```
  The migration guards Supabase-only objects (auth trigger, RLS grants to the
  `authenticated` role, the `supabase_realtime` publication) so it also runs on plain
  PostgreSQL.

- **Hosted Supabase project:** the schema is already applied (via the Supabase migration
  history `airpulse_01`..`airpulse_13`). The `public.alembic_version` table is stamped to
  `0001_airpulse_initial` so Alembic and Supabase agree. Future changes: add an Alembic
  migration **and** apply the equivalent to Supabase, keeping both in sync.

## Authentication + RBAC

`app/auth/supabase_jwt.py`:
- Validates the Supabase JWT (HS256 via `SUPABASE_JWT_SECRET`): signature, expiration,
  audience (`authenticated`), and issuer (`<SUPABASE_URL>/auth/v1`).
- Resolves the application role from `profiles` — **never** from token/request payload.
- Rejects inactive profiles.
- Dependencies: `require_viewer`, `require_analyst`, `require_admin` (hierarchical:
  admin > analyst > viewer).

Roles: `viewer` (read), `analyst` (+ trigger collection, scraper tests, imports, reviews,
backtests), `admin` (+ manage sources/schedules/baskets/models/users).

New auth users automatically get a `profiles` row with role `viewer` (trigger
`on_auth_user_created`). Users cannot escalate their own role (RLS policy
`profiles_update_self_no_escalation`).

## Row Level Security

- `profiles`: read own (admins read all); update own without changing role/active.
- `anomaly_reviews`: analysts/admins insert (as themselves); everyone reads.
- `alerts`, `anomalies`, and operational tables: read-only for authenticated (Realtime).
- Sensitive tables (`raw_fares`, `validated_fares`, `fare_predictions`, `airfare_index`,
  `collection_runs`, `pipeline_*`, `reference_datasets`, `model_registry`, …): RLS enabled
  with **no** browser policies. Only the FastAPI/Celery **service role** (which bypasses
  RLS) writes to them.

## Realtime

Publication `supabase_realtime` includes only high-value operational tables:
`collection_runs`, `pipeline_runs`, `pipeline_steps`, `scraping_test_runs`, `alerts`,
`anomalies`, `source_health_logs`, `airfare_index`. High-volume fare tables are **not**
published (the browser must never receive thousands of fare-row events).

### Frontend pattern (source of truth stays FastAPI)

```
FastAPI/Celery updates pipeline_steps
        → Supabase Realtime emits UPDATE
        → Next.js receives the event
        → Next.js invalidates the matching TanStack Query
        → Next.js refetches the authoritative result from FastAPI
```

Example: when the `APIx` pipeline step becomes `COMPLETED`, invalidate
`dashboard-summary`, `apix-latest`, `apix-trend`, and `route-intelligence`.

## Storage

Five **private** buckets: `raw-responses`, `imported-datasets`, `reference-datasets`,
`backtest-reports`, `model-artifacts`. Access is backend-only via the service role
(`app/services/storage_service.py`); authorized downloads are handed to the browser as
short-lived signed URLs. Recreate buckets on a fresh project with
`python scripts/setup_storage_buckets.py`.

## Diagnostics

- `GET /api/v1/system/supabase-diagnostics` — database connectivity + latency, supabase /
  realtime / storage / auth configuration, latest migration, raw/validated fare counts,
  latest collection.
- `POST /api/v1/system/realtime-self-test` (admin) — creates a temporary pipeline run +
  step, transitions QUEUED → RUNNING → COMPLETED (the events Realtime broadcasts), verifies
  the DB write, and cleans up. Does not require a connected browser.

## Seeding

```bash
python scripts/seed_supabase.py   # 15 airports, directional routes, 12 sources
```
Airlines seeded for 2026: IndiGo, Air India, Air India Express, Akasa Air, SpiceJet
(Vistara is intentionally NOT a live source). OTAs use generic identifiers.

## Tests

```bash
# Auth/RBAC unit tests (no DB required)
pytest tests/unit/test_supabase_jwt.py -v

# Schema/constraint/RLS/immutability integration tests
#   Require a reachable DB via DATABASE_URL_SYNC; otherwise they skip.
pytest tests/integration/test_supabase_schema.py tests/integration/test_profile_trigger.py -v
```

## Frontend types

`supabase/types/database.types.ts` (enums + client wiring). Regenerate full table types:
```bash
supabase gen types typescript --project-id bbvdujskgbqjhawwgxsa > supabase/types/database.types.ts
```
