# AirPulse Airfare Price Intelligence Platform (SIH26056)

A production-grade, government-standard backend designed for **MoSPI** (Ministry of Statistics and Programme Implementation) and **RBI** (Reserve Bank of India) analysts to collect, normalize, validate, analyze, index, and expose domestic airfare data for inflation measurement and explainable anomaly detection.

---

## Architecture Overview

```
                 SOURCE LAYER
                     │
          ┌──────────┴──────────┐
          │                     │
    ReplayCollector       Live Collectors
          │                     │
          └──────────┬──────────┘
                     ▼
              Collection Run
                     │
                     ▼
              IMMUTABLE RAW
                 raw_fares (SHA-256 Hashed)
                     │
                     ▼
                   Parse
                     │
                     ▼
                 Normalize
                     │
                     ▼
                  Validate
                     │
             ┌───────┴────────┐
             │                │
          Rejected         Accepted
                              │
                              ▼
                         Deduplicate
                              │
                              ▼
                        VALIDATED FARES
                         │           │
                         │           │
             ┌───────────┘           └────────────┐
             ▼                                    ▼
      STATISTICAL ENGINE                     ML ENGINE (QA Only)
             │                                    │
       Fare products                          Features
             │                                    │
       Booking windows                       FareGuard (XGBoost)
             │                                    │
        Route relatives                        Residual
             │                                    │
        Route weights                       PriceGuard (Isolation Forest)
             │                                    │
       Matched basket                     Gated SHAP (Percentile >= 0.75)
             │                                    │
       Official APIx Index                 Anomaly Review
             │                                    │
             └──────────────┬─────────────────────┘
                            ▼
                     ALERT / ANALYTICS
                            │
                            ▼
                    FastAPI REST APIs (/api/v1)
                            │
                            ▼
                    Next.js Dashboard
```

### Critical Architectural Guarantees
1. **Separation of Index & ML**: The official statistical Airfare Price Index (`APIx`) is strictly computed using validated, observed market quotes. ML (FareGuard & PriceGuard) is isolated to data quality assurance, baseline benchmarking, and explainable anomaly alerting.
2. **Explicit Coverage Quality Score**:
   $$Q = 0.40 C_r + 0.25 C_s + 0.20 F + 0.15 V$$
   Derived from measurable Route Coverage ($C_r$), Source Coverage ($C_s$), Freshness ($F$), and Validation Success Rate ($V$).
3. **Route $\times$ Booking-Window Aggregation**: Never collapses $T+1$ and $T+30$ fares into a single naive median. Aggregates price relatives by route and booking window:
   $$APIx_t = \sum_r \sum_b w_{r,b} \frac{P_{r,b,t}}{P_{r,b,0}}$$
4. **Calibrated Anomaly Percentile**: Isolation forest outputs are mapped via empirical percentile ranking $[0.0, 1.0]$, preventing batch-dependent score drift.
5. **Gated SHAP Explainability**: Evaluated only for anomalous fares ($\ge 0.75$) to optimize server workloads, explaining *why XGBoost expected ₹X* with non-causal attribution.

---

## 2026 Fleet & Route Reality
- **Airlines**: IndiGo (`6E`), Air India (`AI`), Air India Express (`IX`), Akasa Air (`QP`), SpiceJet (`SG`). Vistara operations are treated as unified under Air India (effective Nov 2024).
- **Directional Routes vs Undirected Markets**: Routes `DEL-BOM` and `BOM-DEL` are distinct directional entities mapped to the market `BOM-DEL`.

---

## Quickstart Guide

### 1. Prerequisites
- Python 3.11+
- PostgreSQL (Supabase or Docker)
- Redis

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Seed Database & Generate Demo Data
```bash
# Seed 15 airports and 20 major Indian domestic corridors
python scripts/seed_airports_routes.py

# Seed airline and OTA sources
python scripts/seed_sources.py

# Generate 45 days of realistic synthetic airfare observations
python scripts/generate_demo_data.py
```

### 5. Train ML Models (FareGuard & PriceGuard)
```bash
python scripts/train_models.py
```

### 6. Run 30-Day Inflation Backtest
```bash
python scripts/run_backtest.py
```

### 7. Launch Local Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)  
ReDoc Documentation: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Docker Deployment
```bash
docker compose up --build -d
```
Starts `api`, `worker` (Celery), `beat` (Periodic Scheduler), `postgres`, and `redis`.

---

## Testing
Run unit and integration test suites:
```bash
pytest tests/ -v
```
