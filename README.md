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

## Monorepo layout

```
SIH56/
├── airpulse-api/     # FastAPI backend (Python 3.11+) — the application/analytics layer
├── frontend/         # Next.js 16 dashboard (TypeScript) — the analytics UI
├── BRAIN.md          # Durable architecture context & implementation state (read first)
├── STARTUP_MANUAL.md # End-to-end startup & operations manual
└── README.md         # You are here
```

---

## Architecture

```
Next.js 16 Frontend  ──(Supabase Auth JWT)──►  validated by FastAPI
        │  REST + Supabase Realtime
        ▼
FastAPI (application/analytics)
        │  SQLAlchemy 2.x async + asyncpg
        ▼
Supabase PostgreSQL  (canonical data store)
        ├── Auth       — user identity (JWT)
        ├── Realtime   — operational-table change events → live dashboard
        └── Storage    — raw payloads, imported datasets, reports, model artifacts

Background:  Celery Worker + Celery Beat  ──►  collectors  ──►  Supabase PostgreSQL
```

- **Supabase is infrastructure** (Postgres hosting, Auth, Realtime, Storage).
- **FastAPI is the application** and connects directly to Postgres via SQLAlchemy async.
- **Alembic** is the single source of truth for the database schema.
- The official APIx is computed **only** from validated observed fares.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI (async), Pydantic v2 |
| Data access | SQLAlchemy 2.x async, asyncpg, Alembic |
| Database | Supabase-hosted PostgreSQL 17 |
| Workers/scheduler | Celery 5.4+, Celery Beat, Redis |
| ML | XGBoost (FareGuard), scikit-learn IsolationForest (PriceGuard), SHAP |
| Scraping | HTTPX, BeautifulSoup, lxml, Playwright (optional, for live airline portals) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| State/data | TanStack Query, Supabase JS (auth + realtime) |
| Charts | Apache ECharts |

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
| [BRAIN.md](./BRAIN.md) | Durable architecture context, methodology, and implementation state (read first). |
| [STARTUP_MANUAL.md](./STARTUP_MANUAL.md) | Full end-to-end startup & operations manual. |
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
