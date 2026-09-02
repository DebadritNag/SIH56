# AirPulse — Real-Time Airfare Price Index for India

> **Smart India Hackathon SIH26056** — *"Development of a Real-time Airfare Price Index for
> India through Automated Web Scraping of Airline and Online Travel Aggregator Portals for
> Augmentation of the Consumer Price Index (CPI)."*

AirPulse is an **airfare statistical intelligence and inflation-measurement platform** for
the Ministry of Statistics & Programme Implementation (**MoSPI**), the Reserve Bank of India
(**RBI**), and national economic researchers. It automatically collects domestic airfares,
preserves immutable cryptographic provenance, validates and de-duplicates observations, and
computes a transparent, high-frequency **Airfare Price Index (APIx)** to augment the CPI.

AirPulse is **not** a flight-booking app. It is a government-grade analytics platform.

---

## What it does

1. Automatically collects domestic airfare quotes across configured airlines and OTAs.
2. Preserves cryptographic, immutable raw provenance (SHA-256) before any parsing.
3. Normalizes fragmented fare components into a canonical standard product.
4. Enforces strict schema and physical-sanity validation.
5. Detects duplicate quotes without deleting them.
6. Distinguishes corrupt data from genuine market price shocks.
7. Computes the official **APIx** at daily / weekly / monthly frequencies (from *validated
   observed fares only* — never from ML predictions).
8. Provides explainable ML QA: **FareGuard** (expected fare), **PriceGuard** (anomalies),
   and gated **SHAP** attribution.
9. Continuously monitors source health, rate limits, and degradation.
10. Ingests official context from **MoSPI eSankhyiki** and route weights from **DGCA**.
11. Exposes an executive, government-grade analytical dashboard with full audit trails.

---

## Official reference data (MoSPI eSankhyiki) & real-fare ingestion

AirPulse integrates the SIH-provided **MoSPI eSankhyiki** portal as an *official / reference*
statistical source — distinct from high-frequency market fare observations. It is **not**
implemented as an airline/OTA collector.

- **Official-data connector** (`MospiESankhyikiAdapter`): real portal health checks, dataset
  discovery, format detection (CSV/XLS/XLSX/JSON), and SHA-256 checksums. It never fabricates
  data — if the source is unreachable, the sync is recorded as `FAILED`/`PARTIAL` and the
  previously synced version stays active.
- **Immutable versioning + provenance**: `reference_datasets` → `reference_dataset_versions`
  (checksum, schema fingerprint, immutable original stored in the private
  `reference-datasets` bucket) → `benchmark_fares` (normalized series). Every sync is tracked
  in `reference_sync_runs` with audit events.
- **Real benchmark ingested**: the official **MoSPI CPI (General)** All-India Combined index
  (Jan-2025 → Jul-2026, base 2012=100) is synchronized and used as a **contextual** backtest
  benchmark — with an explicit comparability note (CPI covers a broader basket than airfares).

**Real market fares (Live mode).** Manually-scraped OTA CSVs (e.g. Goibibo) are ingested via
`GoibiboCsvImporter` into `validated_fares` as `data_origin = IMPORTED`, matched to real routes
and sources, with a deterministic `quote_hash` for dedup. In **Live** mode every dashboard
metric, chart, top-route table, and booking-window summary is computed **directly from these
real observations** (`/dashboard/*` endpoints); when a selection has no matching fares the API
returns an honest empty/representative state rather than fake data. **Mock** mode remains a
clearly-labelled demo fallback.

**FareGuard training** runs on the real accumulated fares (`FareTrainingService`) and refuses
to emit metrics when there is insufficient real data (reporting `insufficient_data` with the
real fare summary) instead of training a meaningless model — retrain as more CSVs are imported.

**Report generation** (`/exports`, backtest audit PDF) pulls the **real** MoSPI benchmark
series, real per-route medians, and the actual dataset name/version/checksum into the dossier,
generated on demand and listed under Downloads & Exports.

> Scraped CSV/XLSX inputs are git-ignored; they are ingested via
> `scripts/import_goibibo_csvs.py` and `scripts/ingest_mospi_annexure.py`.

---

## Monorepo layout

```
SIH56/
├── airpulse-api/     # FastAPI backend (Python 3.11+) — the application/analytics layer
├── frontend/         # Next.js 16 dashboard (TypeScript) — the analytics UI
├── STARTUP_MANUAL.md # End-to-end startup & operations manual
└── README.md         # You are here
```

---

## System Architecture

AirPulse follows a **decoupled, layered architecture** where Supabase provides managed
infrastructure and FastAPI owns all application and statistical logic. The frontend reads
business data through FastAPI (not directly from the database), and uses Supabase only for
authentication and realtime notifications.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                                    │
│   Next.js 16 Dashboard (React 19, TypeScript, Tailwind, ECharts, TanStack)     │
│   Landing → Login/Signup → Protected Dashboard (20+ analyst views)             │
└───────────────┬──────────────────────────────────────────┬───────────────────┘
                │ REST (Authorization: Bearer <JWT>)         │ Supabase Realtime
                │                                            │ (WebSocket, operational
                ▼                                            │  table change events)
┌──────────────────────────────────────────────┐            │
│                APPLICATION LAYER               │            │
│  FastAPI (async) — the single source of truth  │◄───────────┘
│  • JWT validation (Supabase HS256)             │
│  • RBAC: viewer / analyst / admin              │
│  • Services: ingestion, normalize, validate,   │
│    dedup, index engine, shock detector,        │
│    provenance, backtest, methodology, audit    │
│  • ML QA: FareGuard, PriceGuard, SHAP          │
└───────────────┬───────────────────────────────┘
                │ SQLAlchemy 2.x async + asyncpg
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE LAYER (Supabase)                          │
│  PostgreSQL 17 (canonical store)  │  Auth (JWT)  │  Realtime  │  Storage        │
│  • Native enums, NUMERIC money    │  identity    │  8 ops     │  raw payloads,  │
│  • RLS on sensitive tables        │  + profiles  │  tables    │  datasets,      │
│  • Alembic = schema source truth  │  trigger     │  published │  reports, models│
└──────────────────────────────────────────────────────────────────────────────┘
                ▲
                │ SQLAlchemy async (service role — bypasses RLS)
┌───────────────┴───────────────────────────────┐
│               BACKGROUND LAYER                 │
│  Celery Worker  — collection & pipeline jobs   │
│  Celery Beat    — scheduler (matrix search)    │
│  Redis          — broker + result backend      │
│        │                                       │
│        ▼                                       │
│  Collectors: Airline (Playwright) · OTA (HTTP) │
│  · Government (MoSPI/DGCA) · Replay · Synthetic │
└────────────────────────────────────────────────┘
```

### Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Next.js frontend** | Analyst UI, auth session, realtime cache invalidation. Never scrapes; reads business data via FastAPI. |
| **FastAPI** | All application/analytics logic, JWT validation, RBAC, REST API, ML orchestration. Canonical source of truth for the UI. |
| **Supabase PostgreSQL** | The canonical data store. Accessed directly by FastAPI/Celery via SQLAlchemy async — not through the Supabase REST client. |
| **Supabase Auth** | User identity. Issues JWTs; a signup trigger auto-creates a `profiles` row (default role `viewer`). |
| **Supabase Realtime** | Broadcasts changes on 8 operational tables so the dashboard refreshes live (FastAPI remains authoritative). |
| **Supabase Storage** | Private buckets for large raw payloads, imported datasets, reference files, reports, and model artifacts (backend signs URLs). |
| **Celery Worker + Beat** | Background collection and the multi-stage processing pipeline, on a scheduled search matrix. |
| **Redis** | Celery broker + result backend and rate-limit coordination. |
| **Collectors** | Pluggable sources: live airline (Playwright), OTA (HTTP), government (MoSPI/DGCA), replay, synthetic. |

### Architectural invariants

- **Supabase is infrastructure; FastAPI is the application.**
- **Alembic** is the single source of truth for the database schema (no ad-hoc dashboard edits).
- The official APIx is computed **only** from validated observed fares — never from ML predictions.
- Branch A (statistics/APIx) and Branch B (ML QA) are **decoupled**: if ML errors, APIx still computes.
- Raw records in `raw_fares` are **immutable** (enforced by a DB trigger).

---

## Tech Stack (detailed)

### Backend — `airpulse-api`

| Technology | Version | Why it's used |
|-----------|---------|---------------|
| **Python** | 3.11+ | Core backend language. |
| **FastAPI** | 0.111+ | Async REST framework; automatic OpenAPI/Swagger docs; Pydantic-native. |
| **Pydantic** | v2 | Request/response validation and typed settings (`BaseSettings`). |
| **SQLAlchemy** | 2.x (async) | ORM + core; the primary application data layer. |
| **asyncpg** | 0.29+ | High-performance async PostgreSQL driver (`postgresql+asyncpg`). |
| **Alembic** | 1.13+ | Versioned schema migrations — the single source of truth. |
| **psycopg2-binary** | 2.9+ | Sync driver used by Alembic migrations. |
| **Celery** | 5.4+ | Distributed task queue for collection and the processing pipeline. |
| **Celery Beat** | — | Scheduler for the periodic route × booking-window search matrix. |
| **Redis** | 5.0+ | Celery broker/result backend and rate-limit coordination. |
| **XGBoost** | 2.0+ | **FareGuard** — expected-fare regression benchmark. |
| **scikit-learn** | 1.5+ | **PriceGuard** — Isolation Forest anomaly detection. |
| **SHAP** | 0.45+ | Gated TreeSHAP attribution for flagged anomalies (explainability). |
| **pandas / numpy / scipy** | latest | Data wrangling, statistics, and the APIx aggregation math. |
| **HTTPX** | 0.27+ | Async HTTP client for OTA/API collectors and health checks. |
| **BeautifulSoup4 / lxml** | latest | HTML parsing for scraped responses. |
| **Playwright** | 1.44+ *(optional)* | Headless-browser collection for dynamic airline portals. |
| **python-jose** | 3.x | Supabase JWT (HS256) signature/claims verification. |
| **pytest / pytest-asyncio** | latest | Test suite (schema, RLS, immutability, auth, idempotency). |

### Frontend — `frontend`

| Technology | Version | Why it's used |
|-----------|---------|---------------|
| **Next.js** | 16 (App Router) | React framework; file-based routing, layouts, route protection. |
| **React** | 19 | UI library. |
| **TypeScript** | 5 | End-to-end type safety with the backend contract. |
| **Tailwind CSS** | 4 | Utility-first styling; the government/fintech design system. |
| **TanStack Query** | 5 | Server-state management, caching, and realtime-driven invalidation. |
| **@supabase/supabase-js** | latest | Browser auth (email/password) + Realtime subscriptions. |
| **Apache ECharts** (`echarts-for-react`) | 6 | Interactive analytics charts (APIx trend, heatmaps, waterfalls, SHAP). |
| **lucide-react** | latest | Consistent SVG icon set. |

### Infrastructure & data

| Technology | Role |
|-----------|------|
| **Supabase PostgreSQL 17** | Canonical data store (native enums, JSONB, TIMESTAMPTZ, NUMERIC money). |
| **Supabase Auth** | JWT identity provider; `profiles` auto-provisioning trigger. |
| **Supabase Realtime** | Postgres change broadcast on operational tables. |
| **Supabase Storage** | Private buckets: `raw-responses`, `imported-datasets`, `reference-datasets`, `backtest-reports`, `model-artifacts`, `generated-exports`. |
| **Docker / docker-compose** | Local orchestration (API, worker, beat, Redis). |

---

## System Workflow

### End-to-end data flow (collection → published index)

```
1. SCHEDULE      Celery Beat emits a search matrix:
                 Route (directional) × Booking window (T+1,7,15,30,45) × Source
                        │
2. COLLECT       Collectors fetch quotes (live airline / OTA / replay / synthetic).
                 Each response is SHA-256 hashed and written to raw_fares — IMMUTABLE.
                        │
3. PARSE         Vendor-specific payload → intermediate parsed fields.
                        │
4. NORMALIZE     Canonical product: UTC times, booking-window days, standardized net fare.
                        │
5. VALIDATE      Schema + physical sanity (IATA codes, currency, ₹500–₹500,000, O≠D).
                 ├── Rejected → validation log (kept, not deleted)
                 └── Accepted ▼
6. DEDUPLICATE   Deterministic quote hash → duplicates marked is_duplicate (never dropped).
                        │
                 ┌──────┴───────────────────────────┐
                 ▼ BRANCH A (statistics)             ▼ BRANCH B (ML QA — decoupled)
7a. FEATURES →   route relatives, DGCA weights,      7b. FareGuard (XGBoost) expected fare
    matched basket                                       → residuals → PriceGuard (IsoForest)
                 │                                        → gated SHAP (percentile ≥ 0.75)
8a. APIx ENGINE  Laspeyres matched-basket index +        │
    coverage quality score Q                          8b. Anomalies + alerts (reviewed by
                 │                                         analysts; unusual ≠ invalid)
                 └──────────────┬───────────────────────┘
                                ▼
9. PERSIST       airfare_index + index_components (full provenance); anomalies; alerts.
                                │
10. REALTIME     Operational-table changes broadcast via Supabase Realtime.
                                │
11. DASHBOARD    Next.js invalidates the matching TanStack Query keys and refetches the
                 authoritative result from FastAPI — live, no page reload.
```

### APIx formula (matched-basket Laspeyres)

```
              Σ_r Σ_b  w(r,b) · [ P(r,b,t) / P(r,b,0) ]
APIx_t = 100 × ───────────────────────────────────────
                        Σ_r Σ_b  w(r,b)
```
where `r` = directional route, `b` = booking window, `P` = representative (median validated)
fare, `w` = DGCA-derived route weight. Every published value carries a coverage quality
score `Q = 0.40·Cr + 0.25·Cs + 0.20·F + 0.15·V`.

### Request/auth workflow

```
Browser signs in (Supabase Auth)  →  receives JWT
   → frontend sends `Authorization: Bearer <JWT>` to FastAPI
   → FastAPI verifies signature/exp/aud/issuer, resolves role from `profiles` (DB, not token)
   → RBAC guard (viewer/analyst/admin) authorizes the endpoint
   → SQLAlchemy async query against Supabase PostgreSQL
   → response returned to the frontend
```

### Live scraping test workflow

```
Analyst triggers a live test for a source
   → PlaywrightCollector runs the actual configured collector (no fallback to fake data)
   → each stage is tracked; on failure the exact ScrapeFailureStage is recorded
     (DNS / CONNECTION / TIMEOUT / HTTP_ERROR / BLOCKED / CAPTCHA_DETECTED /
      EMPTY_RESPONSE / SELECTOR_NOT_FOUND / PARSE_ERROR / NO_AVAILABILITY / ...)
   → passes ONLY if ≥1 fare is collected, parsed, validated, and stored with provenance
```

---

## Quick start

> Full, detailed instructions (env vars, migrations, seeding, ML training, Celery,
> live scraping, realtime) are in **[STARTUP_MANUAL.md](./STARTUP_MANUAL.md)**.

### Prerequisites
- Node.js `v20+`, Python `3.11+`, Redis, and a Supabase project (or local PostgreSQL).
- *(Optional)* Playwright + Chromium to enable live airline scraping.

### 1. Backend (`airpulse-api`)
```bash
cd airpulse-api
python -m venv venv && .\venv\Scripts\Activate.ps1   # Windows PowerShell
# source venv/bin/activate                            # macOS/Linux
pip install -r requirements.txt

cp .env.example .env        # then fill DB password, service role key, JWT secret

alembic upgrade head        # apply schema (Alembic = source of truth)
python scripts/seed_supabase.py   # airports, directional routes, 2026 sources

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API: `http://localhost:8000/api/v1` · Docs: `http://localhost:8000/docs`
- Diagnostics: `GET /api/v1/system/supabase-diagnostics`

*(Optional) workers:*
```bash
celery -A app.workers.celery_app worker --loglevel=info -P solo
celery -A app.workers.celery_app beat --loglevel=info
```

### 2. Frontend (`frontend`)
```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL + Supabase public vars
npm run dev
```
Open **`http://localhost:3000`**.

### Navigation flow
```
/  (landing)  →  /login  or  /signup  →  /overview  (protected dashboard)
```
New accounts are provisioned with **viewer** clearance (via the Supabase signup trigger);
an admin elevates roles to `analyst` / `admin`.

---

## Key principles

- The official APIx uses **validated observed fares**, never ML predictions.
- A statistically unusual fare is **not** automatically invalid — it is investigated, not deleted.
- **Scraping never runs in the frontend.** All collection is backend-only.
- Live scraping performs **no anti-bot evasion, CAPTCHA solving, or auth bypass**; a
  blocked/CAPTCHA state is recorded and the scrape stops.
- Complete provenance is preserved from collection through index generation.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [airpulse-api/README.md](./airpulse-api/README.md) | Backend architecture, services, and API reference. |
| [airpulse-api/SUPABASE.md](./airpulse-api/SUPABASE.md) | Supabase foundation: schema, RLS, Realtime, Storage, auth. |
| [airpulse-api/docs/LIVE_SCRAPING_AND_REALTIME.md](./airpulse-api/docs/LIVE_SCRAPING_AND_REALTIME.md) | Live Playwright scraping (selector maintenance, failure stages) & Realtime. |

---

## Security notes

- Backend-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, database
  password) must never reach the browser, be committed, or be logged. Only
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed to the frontend.
- Row Level Security is enabled on sensitive tables; browser clients read operational
  metadata only. Fare and analytics writes happen through the FastAPI service role.
- `.env` files are git-ignored; commit only `.env.example` templates.

---

*Built for the Smart India Hackathon (SIH26056) — airfare statistical intelligence for CPI augmentation.*
