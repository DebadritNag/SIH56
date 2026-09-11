# LIVE lineage and Fare Explorer repair

## Root causes and changes

The stored LIVE records inspected already had genuine source and collection evidence. The application was losing that evidence in its response/display paths:

- The list schema omitted collection/ingestion/pipeline IDs and collector metadata. Source enrichment considered only the immediate source lookup, while the table fabricated generic collector defaults.
- The audit endpoint treated every PriceGuard per-fare outcome as a scored result and accessed `anomaly_percentile` even for `NOT_SCORED` outcomes. Such outcomes contain a reason instead. An endpoint failure left the drawer using its fallback data, including `Unknown Source`, missing run IDs, generic telemetry and zero lead days.
- The table mapper explicitly converted `NOT_SCORED` into `NORMAL`. Absence of an anomaly row was also treated as proof of normal scoring.
- The drawer used zero as a loading fallback. Exact lead days now come from departure and observation dates in Asia/Kolkata; analytical bucket labels remain separate and explicitly say “bucket”.

`canonical_fare_view.py` now builds one projection from validated fare identity, raw evidence, source, collection, downstream pipeline membership, per-observation ML outcomes and stored prediction/anomaly records. Fare Explorer includes that same audit projection in its response; the drawer endpoint calls the same service. It uses actual metadata, not carrier-based inference or generic telemetry defaults. A payload hash is the raw response hash, separate from the deduplication quote hash.

New LIVE ingestion records `processed_fare_ids` and its real ingestion job ID in existing `pipeline_runs.metadata`, within the existing atomic transaction. LIVE ingestion already uses a `pipeline_runs` row as its ingestion job, so its **ingestion_run_id and pipeline_run_id are the same real UUID**. Collection remains a separate original UUID. Imported reprocessing retains its original dataset/collection and resolves the latest real processing collection/pipeline through recorded fare membership.

No scraping, source policy, immutable payload, validation, deduplication, anomaly thresholds, APIx formula or Live/Demo resolver changes were made. APIx without a configured observed base period reports `BUILDING_BASE_HISTORY` with the actual genuine observation-day count. Reaching a particular count does not create or fake a base period automatically.

## Model files

Both API and worker Compose environments now explicitly set `MODEL_DIR=/app/models`. Both mount the host `models/` directory; the worker mount is read-only. Windows registry separators are normalized and the registered filename resolves only under MODEL_DIR. Missing files report `MODEL_ARTIFACT_MISSING`; unreadable files report `MODEL_LOAD_ERROR`. The diagnostic reports the expected path even when a file is absent and explicitly confirms feature-schema loading.

Required files:

```text
/app/models/fareguard-xgb-v1.joblib
/app/models/priceguard-if-v1.joblib
```

These files are Git-ignored. **A git pull cannot install them.** Their local versions load and pass inference tests, but actual EC2 container access has not been verified from this session. `MODEL_ARTIFACT_MISSING` cannot be fixed by a Supabase schema migration. Upload the existing files if they are absent from the host mount. Do not retrain or register replacement models; the ACTIVE registry rows already exist.

## Verified results

Read-only query of an actual LIVE record:

```text
Observation: d3887c5c-5e6f-4571-a878-2d468abfe54d
Source: HappyFares
Collection: e87f1f7a-87d0-40c4-837d-dc8af4ade014
Ingestion: 6d047464-a939-42a4-a350-5a90cd5e13cb
Pipeline: 6d047464-a939-42a4-a350-5a90cd5e13cb
Acquisition: CRAWL4AI
Collector: happyfares-crawl4ai-v1
Window: T+15 bucket · 19 actual lead days
PriceGuard: NOT_SCORED
```

The list response schema and audit endpoint matched for three real records. No database writes were made. Existing repair dry run: 55 examined, 13 repairable, 0 ambiguous, 42 unchanged, 0 repaired. Counts can change as more fares are ingested.

Validation: 46 backend tests passed, including real saved-model inference/SHAP plus lineage, missing predictions, read-only repair planning, imported provenance and ingestion regressions. Frontend canonical mapper and server-rendered drawer checks passed; TypeScript and the Next.js production webpack build passed. All five existing frontend test entry points passed when run directly with Node (the local npm launcher is broken). The existing XGBoost older-serialization warning remains; Linux inference should be checked using the deployed diagnostic.

## EC2 Bash commands

First commit/push the code through your normal workflow. Enter your actual existing backend checkout (`SIH56/airpulse-api`) on EC2. Keep your current production Compose overrides or `COMPOSE_FILE` selection.

```bash
git pull --ff-only
mkdir -p models
pwd
ls -lh models/fareguard-xgb-v1.joblib models/priceguard-if-v1.joblib
```

If either file is missing, upload it before rebuilding. From **Windows PowerShell**, replace the key path and remote backend path with your actual paths; the remote path is the directory printed by `pwd`:

```powershell
scp -i "C:\path\ec2-key.pem" "D:\New projects\SIH56\airpulse-api\models\fareguard-xgb-v1.joblib" "D:\New projects\SIH56\airpulse-api\models\priceguard-if-v1.joblib" ubuntu@13.53.46.72:/YOUR/ACTUAL/SIH56/airpulse-api/models/
```

Then paste this block into **EC2 Bash**, from the backend directory. It runs in a subshell so a failed check stops the block without closing SSH:

```bash
(
  set -eu
  test -f app/scripts/check_ml_models.py
  test -f models/fareguard-xgb-v1.joblib
  test -f models/priceguard-if-v1.joblib
  chmod 755 models
  chmod 644 models/fareguard-xgb-v1.joblib models/priceguard-if-v1.joblib
  docker compose config --quiet
  docker compose up -d --build --no-deps api worker
  docker compose exec -T api python -m app.scripts.check_ml_models
  docker compose exec -T worker python -m app.scripts.check_ml_models
  docker compose exec -T api python -m app.scripts.repair_live_provenance --dry-run
  docker compose ps api worker
)
```

The diagnostics must show ACTIVE models, `/app/models/...` paths, artifact/load/schema PASS and a real sample inference PASS. If a container fails, inspect:

```bash
docker compose logs --tail=100 api worker
```

Redeploy the frontend on Vercel from the same updated code. No frontend environment changes or Supabase Auth/Realtime changes are required.

## Existing record repair / Supabase

**No schema migration, SQL Editor change, RLS change, model registration or Kiro prompt is needed.** The new read projection already recovers deterministic existing relationships for display. The optional repair makes missing canonical source/collection links and per-fare pipeline membership explicit in existing records; it never rewrites immutable raw payloads, predictions, provider guesses or ambiguous histories.

After checking the dry-run report, optionally persist its deterministic repairs from EC2:

```bash
docker compose exec -T api python -m app.scripts.repair_live_provenance --apply
docker compose exec -T api python -m app.scripts.repair_live_provenance --dry-run
```

The apply command uses the existing ingestion advisory lock, fills only missing links, appends missing membership once, and records an audit event. Repeating it does not duplicate membership or audit unchanged records. It does not rescore old fares. Once the model diagnostics pass, test a new eligible collected batch through **Send to Data Ingestion**.

## Files changed

- `app/services/canonical_fare_view.py`
- `app/services/provenance_service.py`
- `app/services/live_processing.py`
- `app/db/repositories/fares.py`
- `app/schemas/fare.py`
- `app/ml/live_inference.py`
- `app/scripts/check_ml_models.py`
- `app/scripts/repair_live_provenance.py`
- `docker-compose.yml`
- `tests/unit/test_canonical_fare_view.py`, `tests/unit/test_live_inference.py`
- `frontend/src/lib/canonical-fare.ts`
- `frontend/src/app/(dashboard)/fares/page.tsx`
- `frontend/src/components/drawers/FareProvenanceDrawer.tsx`
- `frontend/src/types/index.ts`
- `frontend/scripts/verify-canonical-fares.cjs`
- `frontend/src/__tests__/fare-explorer-consistency.test.mjs`
- root/backend `.gitignore` and this report
