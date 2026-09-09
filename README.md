# AirPulse — Real-Time Airfare Price Index for India

> **Smart India Hackathon SIH 2026** — **Problem Statement SIH26056**  
> *"Development of a Real-time Airfare Price Index for India through Automated Web Scraping of Airline and Online Travel Aggregator Portals for Augmentation of the Consumer Price Index (CPI)."*

AirPulse is an **airfare statistical intelligence and inflation-measurement platform** developed for the Ministry of Statistics & Programme Implementation (**MoSPI**), the Reserve Bank of India (**RBI**), and national economic researchers. It automates the collection of domestic airfare quotes across multiple airline and Online Travel Aggregator (OTA) portals, preserves immutable cryptographic provenance, enforces strict physical-sanity validation, and computes a transparent, high-frequency **Airfare Price Index (APIx)** to augment the national Consumer Price Index (CPI).

AirPulse is **not** a consumer flight-booking application; it is an institutional-grade macroeconomic analytics platform designed to deliver statistically uncompromised price intelligence.

---

## What AirPulse Does

1. **Automated Multi-Source Acquisition**: Collects scheduled economy fare quotes across domestic airline and OTA portals via bounded, headless browser and HTTP collectors.
2. **Cryptographic Raw Provenance**: Computes SHA-256 hashes for all raw payloads and enforces immutable storage before downstream parsing.
3. **Canonical Normalization**: Standardizes disparate vendor structures into uniform route, cabin, flight number, departure timing, and net/gross fare definitions.
4. **Physical Sanity & Schema Validation**: Rejects invalid records (e.g., negative prices, fare bounds outside ₹500–₹500,000, identical origin and destination) into audit logs without data deletion.
5. **Deterministic Deduplication**: Flags duplicate observations using SHA-256 quote hashes without purging records, maintaining complete observation history.
6. **Economic Shock Differentiation**: Distinguishes corrupt data inputs from genuine macroeconomic market shocks (e.g., holiday surges, capacity crunches) via cross-source corroboration.
7. **Official APIx Index Computation**: Derives a route- and booking-window-aware Laspeyres price index strictly from validated, observed fares (never from ML predictions).
8. **Decoupled Machine Learning QA**: Applies **FareGuard** (XGBoost expected fare), **PriceGuard** (Isolation Forest anomaly detection), and gated **SHAP** attribution strictly for data quality control and outlier review.
9. **Official Reference Benchmarking**: Synchronizes historical **MoSPI eSankhyiki** CPI (General) All-India datasets as external economic benchmarks.
10. **Executive Analytics Dashboard**: Provides high-frequency index trendlines, route volatility heatmaps, lead-time yield curves, and downloadable audit-grade PDF dossiers.

---

## Current System Architecture

AirPulse adopts a decoupled, multi-tier architecture designed to maintain complete operational independence between high-frequency statistical indexing, machine learning quality checks, and web presentation.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│         Next.js 16 Dashboard (React 19, TypeScript, Tailwind CSS, ECharts)    │
│         Hosted on Vercel · Dynamic API Routing via Environment Variables     │
└───────────────────────┬──────────────────────────────┬───────────────────────┘
                        │ REST (Bearer JWT)            │ Supabase Realtime
                        │                              │ (WebSocket Notifications)
                        ▼                              │
┌──────────────────────────────────────────────────────┴───────────────────────┐
│                              APPLICATION LAYER                               │
│                   FastAPI (Async Python 3.11+) on Render                     │
│  • JWT Verification & RBAC (Viewer, Analyst, Admin)                          │
│  • Services: Normalization, Validation, Deduplication, Feature Extraction    │
│  • Statistical Engine: Laspeyres/Jevons Matched Basket Index (APIx)          │
│  • ML QA Engine: FareGuard (XGBoost), PriceGuard (Isolation Forest), SHAP    │
└───────────────────────┬──────────────────────────────────────────────────────┘
                        │ SQLAlchemy 2.x asyncpg (Service Role)
                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL DATA & STORAGE (Supabase)                   │
│  PostgreSQL 17 (Triggers, RLS)  │  Supabase Auth  │  Private Storage Buckets │
│  • Immutable raw_fares          │  • JWT tokens   │  • Raw HTML/JSON payloads│
│  • Validated fares & APIx index │  • Role profiles│  • Reference datasets    │
└──────────────────────────────────────────────────────────────────────────────┘
                        ▲
                        │ Task Scheduling & Ingestion Triggers
┌───────────────────────┴──────────────────────────────────────────────────────┐
│                             BACKGROUND WORKERS                               │
│  Celery Worker + Beat  │  Redis Broker  │  Embedded Async Ingestion Pipeline │
│  • Bounded Crawl4AI / Playwright browser runs                                │
│  • Scheduled matrix search (Route × Booking Window × Source)                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Processing Pipeline

The platform enforces a strict unidirectional pipeline from raw collection to published index metrics:

```
[ Acquisition Layer ]
  │  Multi-source crawling (Crawl4AI / Playwright / HTTP / Replay / Synthetic)
  ▼
[ Collection / Staging ]
  │  Payloads staged with run metadata in collection_runs
  ▼
[ Send to Data Ingestion ]  ◄── EXPLICIT INGESTION GATE (Manual or Worker-Triggered)
  │  (Staged data DOES NOT affect analytics or index until this step!)
  ▼
[ Canonical Raw Store ]
  │  raw_fares table: SHA-256 hashed, immutable PostgreSQL trigger enforced
  ▼
[ Normalize ]
  │  Uniform fields: IST/UTC timestamps, route codes, carrier, gross/base/tax fares
  ▼
[ Validate ]
  │  Strict physical sanity: ₹500–₹500,000 range, origin ≠ destination, valid IATA
  │  Rejections logged with explicit reason codes; valid rows move forward
  ▼
[ Deduplicate ]
  │  Deterministic quote_hash; duplicates marked (is_duplicate = true), never purged
  ▼
[ Feature Generation ]
  │  Historical route medians, lead days, day of week; missing features kept as null
  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  DECOUPLED EXECUTION BRANCHES                                                │
│                                                                              │
│  [ Branch A: Statistical Index Engine ]   [ Branch B: ML Quality Assurance ] │
│  • Filter strictly for eligible fares     • FareGuard (XGBoost prediction)   │
│  • Route & booking-window relatives       • PriceGuard (Isolation Forest)    │
│  • Laspeyres matched-basket aggregation   • Gated SHAP on anomalies (p≥0.75) │
│  • Coverage quality metric (Q score)      • Statistical alerts logged        │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       ▼
                             [ APIx / Index Persistence ]
                                       ▼
                             [ Dashboard & Alerts ]
```

> [!IMPORTANT]
> **Explicit Ingestion Gate:**
> Staged collection payloads do **NOT** affect analytics, price index calculations, or ML models until they pass through the Data Ingestion step. This architectural boundary prevents incomplete scrapes, in-flight browser sessions, or corrupt payloads from contaminating the canonical analytical database.

---

## Unique Selling Propositions (USPs) — Four Pillars

AirPulse is designed around four defensible institutional pillars tailored for national statistical agencies:

### 1. TRUST: Cryptographic Provenance & Institutional Auditability
- **Observation-Level Provenance**: Every fare quote permanently preserves its raw extraction evidence, exact HTTP status, source URL, scraping engine, and timestamp.
- **Cryptographic Immutability**: Every raw payload is hashed via SHA-256 before parsing and written to `raw_fares`, protected by PostgreSQL database triggers preventing mutation or deletion.
- **Zero Synthetic Contamination in Live Mode**: Live Mode exclusively computes metrics from verified `LIVE` observations and genuine `IMPORTED` fallbacks. Synthetic data is strictly barred from Live Mode.

### 2. RESILIENCE: Hybrid LIVE + IMPORTED Data Architecture
- **Fail-Safe Operational Continuity**: Automated browser scrapers operate alongside structured data importers (`GoibiboCsvImporter`, `ReferenceDataService`).
- **Graceful Upstream Handling**: When live scrapers encounter upstream rate limits or anti-bot defenses, the platform falls back to verified imported baseline observations rather than crashing or stalling index publication.
- **Decoupled Architecture**: Statistical index generation (Branch A) and machine learning scoring (Branch B) run independently. An ML exception or missing feature set will never delay or prevent index publication.

### 3. INTELLIGENCE: Booking-Window & Economic Shock Awareness
- **Standardized Advance-Purchase Buckets**: Eliminates airline yield-management bias by segmenting fares into canonical booking windows (`T+1`, `T+7`, `T+14`, `T+30`, `T+45`) rather than computing misleading single-point route medians.
- **Corrupt Data vs. Genuine Market Shocks**: Physical-sanity violations (e.g. negative fares, malformed routes) are flagged as corrupt. Conversely, genuine market price shocks (e.g. festival surges, sudden route capacity crunches) are validated and preserved to ensure economic inflation metrics reflect reality.
- **Explainable Anomaly Attribution**: Anomalies flagged by PriceGuard are accompanied by gated TreeSHAP feature attributions, explaining the variance (e.g., short lead time, carrier premium) in interpretable rupee terms.

### 4. STATISTICAL INTEGRITY: Pure Index Formulation (Zero ML Imputation)
- **Zero ML Imputation in Official APIx**: The official Airfare Price Index is calculated strictly from validated, observed market quotes using the chained Laspeyres / Jevons formulation—never from synthetic, predicted, or imputed numbers.
- **Explicit Coverage Quality Metric ($Q$)**: Every published index point carries an auditable quality score:
  $$Q = 0.40 C_r + 0.25 C_s + 0.20 F + 0.15 V$$
  evaluating route coverage ($C_r$), source coverage ($C_s$), temporal freshness ($F$), and validation rate ($V$).

---

## Crawl4AI Web Acquisition Engine

AirPulse incorporates **Crawl4AI** as the primary crawling engine for its automated web acquisition prototype.

- **Role & Scope**: Crawl4AI operates exclusively within the **Acquisition Layer**. It is responsible for orchestrating headless Playwright/Chromium instances to render dynamic, client-side JavaScript applications on airline and aggregator portals.
- **Deterministic Extraction**: Crawl4AI is used for headless page execution and DOM extraction. Parsing extracted flight cards into structured fare quotes remains strictly **deterministic and DOM-based** (using specific CSS/text selectors, date/time parsers, and regex patterns). No generative or non-deterministic AI models are used to infer fare amounts or flight metadata.
- **Extensible Collector Framework**: Crawl4AI is not the project USP. The collector layer is built on an extensible `BaseCollector` contract that supports interchangeable collection adapters:
  - `Crawl4AICollector`: Headless Chromium navigation for complex JavaScript shells.
  - `PlaywrightCollector`: Direct browser automation scripts.
  - `ScrapyCollector`: High-throughput asynchronous crawler for static/lightweight endpoints.
  - `StaticCollector`: Standard async HTTP client (HTTPX) for public APIs and JSON endpoints.
  - `ReplayCollector` & `SyntheticCollector`: Offline reproducible replay and testing adapters.
- **Problem Statement Clarification**: The SIH26056 problem statement requires automated web scraping of airline and OTA portals; it does not mandate Crawl4AI specifically. Crawl4AI was selected for this prototype to efficiently navigate modern dynamic single-page web applications.

---

## Ethical & Defensive Collection Standards

AirPulse follows strict ethical harvesting principles suited for government and academic research:

- **Bounded Collection**: Requests are strictly capped (default 5–15 observations per crawl, browser concurrency set to 1) to prevent any denial-of-service load on upstream servers.
- **Throttling & Cooldowns**: Built-in rate limiters enforce minimum request intervals (e.g. 60s cooldowns) and an automatic 5-minute cooldown following any upstream failure.
- **No Anti-Bot Evasion**: AirPulse does **not** bypass CAPTCHAs, circumvent cloud firewalls, rotate residential proxies, or forge browser fingerprints.
- **Truthful Status Reporting**: When access challenges or restrictions occur, the pipeline records honest operational failure stages:
  - `BLOCKED`: Upstream HTTP 403 response or explicit access-denied body text.
  - `RATE_LIMITED`: Upstream HTTP 429 Too Many Requests response.
  - `CAPTCHA_DETECTED`: Challenge page or verification prompt detected; execution terminates immediately.
  - `NO_AVAILABILITY`: Source returns no matching scheduled flights.
  - `POLICY_RESTRICTED`: Source disabled pending operator compliance review.
- **Robots.txt & Compliance Review**: The engine inspects upstream `robots.txt` files and requires configured review notes (`<SOURCE>_REVIEW_NOTES`) before live collection can be initiated.

---

## Current Prototype Source Status

In the spirit of complete scientific and engineering integrity, the current operational status of the prototype is documented below:

- **HappyFares Prototype**: HappyFares is currently the first controlled, code-verified Crawl4AI prototype source in the codebase. It is tested and verified locally for the high-density DEL–BOM corridor (Economy, 1 adult).
- **Realistic Portal Coverage**: AirPulse does **not** claim all airline and OTA portals are operational. Commercial travel portals frequently implement aggressive anti-bot challenges (e.g. Yatra challenge pages) or change frontend DOM structures without notice.
- **Extensible Architecture**: The multi-source framework is fully implemented in `app/collectors/`, allowing new portal adapters to be activated as DOM selectors and access permissions are reviewed.
- **Resilient Fallback**: Because live portals can be volatile, the platform incorporates verified historical datasets (e.g., real Goibibo OTA exports) to ensure Live Mode functions reliably during live demonstrations.
- **Demo Mode**: Demo Mode remains fully available with isolated synthetic and replay datasets for platform inspection without triggering network traffic.

---

## Provenance Model & Data Origins

Every record in AirPulse tracks its complete chain of custody through a standardized `data_origin` classification:

| Origin | Definition | Usage & Restrictions |
|---|---|---|
| `LIVE` | Real fare quotes collected via automated live crawling engines (e.g. Crawl4AI, Playwright). | Eligible for Live Mode analytics and official APIx calculation. |
| `IMPORTED` | Verified real-world fare observations imported from static files (e.g. OTA CSV exports, MoSPI press releases). | Eligible for Live Mode analytics and official APIx calculation as a reliable fallback. |
| `REPLAY` | Historical recorded payloads replayed through the pipeline. | Used for deterministic testing and reproducible validation. |
| `SYNTHETIC` | Mathematically simulated observations generated for load testing and empty-state development. | **Strictly prohibited** from entering Live Mode metrics or official APIx calculations. |
| `MODELLED` | Algorithmic estimates generated by machine learning models (e.g. FareGuard expected fare). | Used solely for QA benchmarks and anomaly residuals; never enters the price index. |

### Operational Modes
- **Live Mode**: Uses strictly `LIVE` observations and genuine `IMPORTED` historical data. If data is unavailable for a selected route or time window, the platform displays an honest empty state (`—`) rather than fabricating numbers.
- **Demo Mode**: Employs clearly-labelled `SYNTHETIC` or `REPLAY` data for offline demonstration and testing. Visible badges (`MOCK DATA`) alert the user whenever simulated data is in view.

---

## Machine Learning Quality Assurance

Machine learning in AirPulse functions as an **observational quality assurance system** around the index pipeline, never inside it.

```
                          [ Validated Fare Observation ]
                                       │
                                       ▼
                             [ Feature Extraction ]
                 (Route distance, lead days, seasonality, route historical median)
                                       │
                                       ▼
                       [ FareGuard (XGBoost Regressor) ]
                           Predicts Expected Fare (₹)
                                       │
                                       ▼
                              Residual Calculation
                         residual = actual_fare - expected_fare
                                       │
                                       ▼
                     [ PriceGuard (Isolation Forest) ]
                      Evaluates Multivariate Anomaly Score
                                       │
                                       ▼
                            Percentile Ranking (0.0–1.0)
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
         Percentile < 0.75                           Percentile ≥ 0.75
                 │                                           │
          Normal Variance                             Flagged Anomaly
                 │                                           │
                 ▼                                           ▼
         Recorded in DB                              [ Gated TreeSHAP Explainer ]
                                                     Computes Marginal Feature Drivers (₹)
                                                             │
                                                             ▼
                                                     Analyst Alert Dashboard
```

- **FareGuard (XGBoost)**: Generates an expected-fare reference estimate based on observable market features (booking window lead days, carrier, distance, historical medians).
  - **No Fake Predictions**: If features are missing or the model returns an invalid or non-positive result, the prediction is recorded as `NULL` / `MODEL_UNAVAILABLE` / `SKIPPED`. The platform **never** outputs fake ₹0 predictions or imputed values.
- **PriceGuard (Isolation Forest)**: Detects multi-dimensional pricing anomalies by scoring actual fares against predicted baselines and route distributions.
- **Gated TreeSHAP**: Evaluated only for anomalous observations (percentile $\ge 0.75$) to minimize compute overhead on constrained runtimes. Provides interpretable feature drivers (e.g., booking window penalty, weekend surcharge) in rupee terms.
  - *Non-Causal Attribution*: SHAP values explain *why the model predicted ₹X*; they do not represent causal economic mechanisms.
  - *Index Decoupling*: SHAP and ML models are QA tools and are **not required** for APIx index computation.

---

## Official APIx Airfare Price Index

The **Airfare Price Index (APIx)** is a transparent, high-frequency measure of domestic airfare inflation designed for the Ministry of Statistics & Programme Implementation (MoSPI).

### Mathematical Formulation
APIx uses a matched-basket chained Laspeyres index methodology disaggregated by directional route $r$ and booking window $b$:

$$APIx_t = 100 \times \frac{\sum_r \sum_b w(r,b) \cdot \left[ \frac{P(r,b,t)}{P(r,b,0)} \right]}{\sum_r \sum_b w(r,b)}$$

Where:
- $r$: Directional route corridor (e.g., `DEL → BOM`).
- $b$: Standard advance booking window bucket (`T+1`, `T+7`, `T+14`, `T+30`, `T+45`).
- $P(r,b,t)$: Representative price (median validated fare) for route $r$ and window $b$ on day $t$.
- $P(r,b,0)$: Baseline period price for the identical route and booking-window cell.
- $w(r,b)$: Statistical basket weight.

> [!NOTE]
> **Basket Weights Status:**
> Route and booking-window weights in the prototype database are structured according to passenger volume methodologies but are marked as **prototype baseline weights** until official DGCA annual traffic weights are directly synchronized into the active basket.

---

## Smart India Hackathon (SIH 2026) Alignment

This project directly addresses the deliverables outlined in **SIH Problem Statement SIH26056**:

| SIH Deliverable Requirement | AirPulse Implementation | Status |
|---|---|---|
| **Automated Web Scraping** | Modular collection engine combining Crawl4AI (headless Chromium) and HTTP collectors with bounded rate limits and ethical access guards. | Implemented (HappyFares prototype operational; multi-source framework ready) |
| **Cleaned & Deduplicated Database** | Strict physical sanity filters (₹500–₹500k bounds, valid IATA, O≠D), canonical normalization, and deterministic SHA-256 deduplication. | Fully Implemented & Enforced via DB Triggers |
| **Airfare Price Index (APIx)** | Chained Laspeyres/Jevons price index segmented by route and booking window (`T+1` to `T+45`) with coverage quality metric ($Q$). | Fully Implemented (Calculated strictly from observed fares) |
| **Analytical Web Dashboard** | Next.js 16 dashboard with 20+ specialized analytical views (index trends, yield curves, anomaly alerts, SHAP attributions, executive dossier generation). | Fully Implemented on Vercel |
| **Official CPI Integration** | Ingestion adapter for MoSPI eSankhyiki All-India Combined CPI series for contextual macro-economic comparison. | Fully Implemented (Annexure-IV series ingested) |
| **DGCA Route Weighting** | Route weighting framework structured according to DGCA passenger traffic volume methodology. | Framework Implemented (*Prototype baseline weights loaded; live DGCA sync pending*) |

---

## Cloud Deployment Architecture

AirPulse is architected for containerized deployment across modern cloud platforms:

```
┌────────────────────────┐         ┌────────────────────────┐         ┌────────────────────────┐
│     Vercel (Edge)      │  HTTPS  │     Render (Cloud)     │  async  │   Supabase (Cloud)     │
│   Next.js 16 Frontend  │────────▶│    FastAPI Application │────────▶│  PostgreSQL 17 Database │
│   Static + SSR Dashboard│         │    Docker Web Service  │         │  Auth / Realtime / S3  │
└────────────────────────┘         └────────────────────────┘         └────────────────────────┘
```

- **Frontend (Vercel)**: Next.js 16 App Router application deployed on Vercel. Communicates with the backend exclusively via environment variables (`NEXT_PUBLIC_API_BASE_URL`). No backend IPs or secrets are hardcoded in frontend code.
- **Backend (Render - Active Deployment Target)**: FastAPI application packaged as a Docker container running on Render (`airpulse-api/render.yaml`). Exposes REST API endpoints and manages background tasks.
- **Data & Auth (Supabase)**: Managed PostgreSQL 17 database with native enums, JSONB, Row-Level Security (RLS), Supabase Auth (JWT), Realtime websockets, and private storage buckets.
- **Background Tasks (Redis + Celery)**: Handles scheduled matrix collection and asynchronous data ingestion.
- **Alternative / Previous Deployments**: AWS EC2 was used as an earlier host environment for Playwright workers and remains documented in `docs/` as an alternative self-hosted infrastructure option. Render is the primary cloud deployment target for the current prototype.
- **Security Invariant**: No credentials, private URLs, database passwords, service-role keys, or JWT secrets are hardcoded in repository files.

### Low-Memory Deployment Notes (Render 512MB Runtime)
To run reliably on memory-constrained hosting tiers (e.g. Render Free 512MB RAM):
1. **Lazy Loading**: Heavy scientific dependencies (`torch`, `xgboost`, `shap`, `playwright`, `crawl4ai`) are imported lazily inside specific worker tasks rather than at application boot time.
2. **Strict Browser Concurrency**: Headless Chromium concurrency is strictly limited to 1 (`CRAWL4AI_BROWSER_CONCURRENCY=1`).
3. **Bounded Result Sizes**: Search results per crawl are restricted to 5–15 observations.
4. **Immediate Browser Cleanup**: Chromium processes, browser contexts, and temporary disk profiles are cleanly terminated immediately upon task completion.
5. **No Synchronous Retraining**: Machine learning model training is never performed inside interactive web request lifecycles.
6. **Decoupled Index Execution**: If ML execution is skipped due to memory limits, the statistical APIx index pipeline executes without interruption.

---

## Tech Stack

### Backend — `airpulse-api`
| Technology | Version | Role in Platform |
|---|---|---|
| **Python** | 3.11+ | Core backend runtime |
| **FastAPI** | 0.111+ | High-performance asynchronous REST API framework |
| **Pydantic** | v2 | Request/response validation and typed configuration |
| **SQLAlchemy** | 2.x (async) | Asynchronous ORM and SQL expression layer |
| **asyncpg** | 0.29+ | Asynchronous PostgreSQL driver (`postgresql+asyncpg`) |
| **Alembic** | 1.13+ | Database schema migrations (single source of truth) |
| **Crawl4AI** | 0.9.3 | Headless Chromium web scraping engine for dynamic pages |
| **Playwright** | 1.44+ | Headless browser automation driver |
| **Celery** | 5.4+ | Distributed task queue for collection and ingestion jobs |
| **Celery Beat** | — | Periodic scheduler for the route × booking-window search matrix |
| **Redis** | 5.0+ | Celery message broker and result backend |
| **XGBoost** | 2.0+ | **FareGuard** expected fare regression benchmark |
| **scikit-learn** | 1.5+ | **PriceGuard** Isolation Forest anomaly detection |
| **SHAP** | 0.45+ | Gated TreeSHAP feature attributions on anomalies |
| **pandas / numpy / scipy** | latest | Statistical data processing and index aggregation math |
| **HTTPX** | 0.27+ | Async HTTP client for static/API collection and health checks |

### Frontend — `frontend`
| Technology | Version | Role in Platform |
|---|---|---|
| **Next.js** | 16 (App Router) | React framework; SSR, layouts, dynamic routing |
| **React** | 19 | Core UI component library |
| **TypeScript** | 5 | End-to-end type safety with backend schema contracts |
| **Tailwind CSS** | 4 | Utility-first styling with institutional design system |
| **TanStack Query** | 5 | Asynchronous server-state management and caching |
| **Apache ECharts** (`echarts-for-react`) | 6 | Interactive analytical charts (APIx trends, heatmaps, SHAP waterfalls) |
| **@supabase/supabase-js** | latest | Client-side authentication and Realtime event subscriptions |
| **lucide-react** | latest | Clean SVG icon set |

### Infrastructure
| Technology | Role in Platform |
|---|---|
| **Supabase PostgreSQL 17** | Canonical database (native enums, JSONB, TIMESTAMPTZ, NUMERIC money) |
| **Supabase Auth** | JWT identity provider; `profiles` table provisioning |
| **Supabase Realtime** | WebSocket broadcasts for live table updates |
| **Supabase Storage** | Private object storage for raw payloads, reference datasets, and PDF dossiers |
| **Render** | Docker web service host for FastAPI backend |
| **Vercel** | Edge hosting platform for Next.js frontend |
| **Docker / Compose** | Local container orchestration (API, worker, beat, Redis) |

---

## Monorepo Layout

```
SIH56/
├── airpulse-api/               # FastAPI backend application (Python 3.11+)
│   ├── alembic/                # Database schema migrations (Alembic = source of truth)
│   ├── app/
│   │   ├── api/                # REST route controllers (/api/v1)
│   │   ├── auth/               # Supabase JWT verification & RBAC authorization
│   │   ├── collectors/         # Modular collection adapters (Crawl4AI, Playwright, Scrapy, HTTP, Replay)
│   │   │   ├── airline/        # Airline portal adapters
│   │   │   └── sources/        # Source-specific extractors (e.g., happyfares.py)
│   │   ├── core/               # Configuration, logging, exception handlers, utilities
│   │   ├── db/                 # Database session, models, and repositories
│   │   ├── ml/                 # FareGuard (XGBoost), PriceGuard (Isolation Forest), SHAP explainer
│   │   ├── schemas/            # Pydantic validation schemas
│   │   ├── services/           # Ingestion, normalization, validation, dedup, live processing, APIx engine
│   │   └── workers/            # Celery application, collection tasks, and periodic Beat scheduler
│   ├── docs/                   # Technical deep-dives & architecture specifications
│   ├── models/                 # Pre-trained serialized model artifacts (.joblib)
│   ├── scripts/                # Database seeders, test scripts, ingestion runners
│   ├── tests/                  # Unit and integration test suites (pytest)
│   ├── Dockerfile              # Production Dockerfile with Chromium & Crawl4AI setup
│   ├── render.yaml             # Cloud deployment blueprint for Render
│   └── requirements.txt        # Python dependency manifest
├── frontend/                   # Next.js 16 analytical dashboard (TypeScript, Tailwind CSS)
│   ├── src/
│   │   ├── app/                # App Router pages, layouts, and API proxy routes
│   │   ├── components/         # Reusable UI components, analytical charts (ECharts), data tables
│   │   └── lib/                # API clients, auth hooks, data mappers, client-side PDF exporter
│   └── package.json            # Frontend dependency manifest
├── docs/                       # Project-level deployment and architectural documentation
├── STARTUP_MANUAL.md           # End-to-end local development & production setup manual
└── README.md                   # Main system documentation
```

---

## Getting Started

> For comprehensive environment setup, migration, and seeding instructions, refer to **[STARTUP_MANUAL.md](./STARTUP_MANUAL.md)**.

### Prerequisites
- **Python**: `3.11+`
- **Node.js**: `v20+`
- **Database**: Managed Supabase PostgreSQL 17 instance (or local PostgreSQL 16+)
- **Cache/Broker**: Redis (for Celery workers)

---

### 1. Backend Setup (`airpulse-api`)

```bash
cd airpulse-api

# Create and activate virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env to set your database credentials, JWT secret, and Supabase keys

# Apply schema migrations
alembic upgrade head

# Seed foundational data (airports, routes, sources)
python scripts/seed_supabase.py

# Launch development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Base URL: `http://localhost:8000/api/v1`
- OpenAPI Documentation: `http://localhost:8000/docs`
- Diagnostics: `GET /api/v1/system/supabase-diagnostics`

*(Optional) Start Celery background workers:*
```bash
celery -A app.workers.celery_app worker --loglevel=info -P solo
celery -A app.workers.celery_app beat --loglevel=info
```

---

### 2. Frontend Setup (`frontend`)

```bash
cd frontend

# Install Node dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
# NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Start Next.js development server
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### Navigation Flow
```
/ (Landing Page)  ──▶  /login or /signup  ──▶  /overview (Protected Analyst Dashboard)
```
New user registrations automatically receive `viewer` clearance via Supabase Auth database triggers. An administrator can elevate roles to `analyst` or `admin`.

---

### Docker Local Orchestration

To launch the complete local containerized stack:
```bash
cd airpulse-api
docker compose up --build -d
```
Starts `api`, `worker`, `beat`, `postgres`, and `redis` containers.

---

## Documentation Index

| Documentation File | Description |
|---|---|
| [STARTUP_MANUAL.md](./STARTUP_MANUAL.md) | Comprehensive step-by-step setup guide for local dev, database seeding, and production deployment. |
| [airpulse-api/README.md](./airpulse-api/README.md) | Detailed backend architecture, API endpoints, and ML service documentation. |
| [airpulse-api/SUPABASE.md](./airpulse-api/SUPABASE.md) | Supabase schema design, Row-Level Security (RLS) policies, Realtime configuration, and Storage buckets. |
| [airpulse-api/docs/LIVE_SCRAPING_AND_REALTIME.md](./airpulse-api/docs/LIVE_SCRAPING_AND_REALTIME.md) | Live Playwright / Crawl4AI scraping guide, failure stage diagnostics, and Realtime cache invalidation. |
| [airpulse-api/docs/HAPPYFARES_CRAWL4AI_EC2.md](./airpulse-api/docs/HAPPYFARES_CRAWL4AI_EC2.md) | HappyFares Crawl4AI implementation details and diagnostic procedures. |
| [docs/LIVE_DEPLOYMENT.md](./docs/LIVE_DEPLOYMENT.md) | Deployment runbook for Render backend and Vercel frontend. |

---

## Security & Access Control

- **Zero Secret Exposure**: Backend secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, database passwords) must never be committed to Git or exposed to the client. Only public anonymous keys (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) are loaded in the browser.
- **Row-Level Security (RLS)**: Enforced across sensitive database tables. Client-side browser sessions read operational metadata only; all analytical fare writes and index calculations happen through the privileged backend service role.
- **Authentication & RBAC**: Every protected API route enforces cryptographic JWT validation and checks database-persisted user roles (`viewer`, `analyst`, `admin`).
- **Environment Isolation**: `.env` files are git-ignored; only sanitized `.env.example` templates are tracked.

---

*AirPulse — Developed for Smart India Hackathon (SIH26056). Airfare statistical intelligence and high-frequency price indexing for CPI augmentation.*
