# LIVE FareGuard / PriceGuard inference repair

## Findings

The configured Supabase database already has ACTIVE models:

| Model | Version | Features | Registered artifact |
|---|---|---:|---|
| FAREGUARD_XGBOOST | fareguard-xgb-v1 | 12 | `./models\fareguard-xgb-v1.joblib` |
| PRICEGUARD_ISOLATION_FOREST | priceguard-if-v1 | 10 | `./models\priceguard-if-v1.joblib` |

Both artifacts exist and are fitted in the local backend `models/` directory. No registration or retraining is required. No production database writes were made during diagnostics.

The previous LIVE path skipped all fares without prior route history, even though these fitted estimators support missing optional values. The loader selected environment filenames instead of the ACTIVE registry and could permanently cache an untrained wrapper when a file was initially missing. The deployed registry uses `status` and `artifact_storage_path`, unlike the local ORM's older field names. The new lookup reads the existing schema without migrations and normalizes Windows path separators for Linux.

The API already mounted `./models:/app/models`; the worker did not. The worker now mounts the same directory read-only. Dockerfile copies files present in the build context and `.dockerignore` does not exclude models, but Git ignores both model files. A fresh checkout does not contain them. **Actual EC2 container file access has not been verified from this session.**

## Inference behavior

- Only registry ACTIVE, fitted artifacts with matching version, schema/order, feature count and optional checksum are loaded. Successful models are cached; registry activation or artifact modification invalidates the selection. Failures are not cached.
- The current trained schemas contain numeric features only. Carrier/cabin strings are retained in features but are not input columns to these models; no new categorical encoding is invented.
- Core FareGuard inputs are distance and date/window-derived fields. Missing prior route statistics, fuel price, demand, festival information and source reliability stay null/NaN. No default external values are fabricated. Native estimator missing-value support is checked.
- FareGuard only persists finite positive predictions and their ACTIVE version. Unavailable predictions are audited as `prediction: null`, `NOT_SCORED`, and an exact reason in existing `pipeline_steps.metadata.outcomes`. There is no zero-valued placeholder or invalid `fare_predictions` row; that table's existing non-null schema is preserved.
- PriceGuard requires a positive FareGuard prediction and scores residual features using the ACTIVE fitted Isolation Forest and its saved empirical calibration. Unscored observations are `NOT_SCORED`, never NORMAL. Its model version is persisted in stage score metadata and anomaly evidence.
- SHAP uses the same ACTIVE FareGuard model, only for detected anomalies in this ingestion path. Normal scored observations yield `SKIPPED / NOT_REQUIRED`. Existing on-demand explainability behavior is preserved.
- `MODEL_UNAVAILABLE`, `MODEL_ARTIFACT_MISSING`, `MODEL_LOAD_ERROR`, `INSUFFICIENT_FEATURES`, `FEATURE_SCHEMA_MISMATCH`, and `NOT_ELIGIBLE` remain distinct. Invalid prediction/score and missing upstream prediction have explicit additional reasons.
- Scraping, atomic ingestion, provenance, anomaly thresholds and independent APIx calculation are unchanged. No model is fitted during ingestion.

## Validation

32 tests passed using scikit-learn 1.6.1: new inference tests plus available-ingestion, Live acceptance, and progress regressions. Tests exercise actual saved model inference and actual selective SHAP with mocked persistence, missing/core/optional fields, schema/artifact failures, active-version cache refresh, nonpositive/nonfinite prediction rejection, NULL failure auditing, and PriceGuard gating.

The read-only diagnostic against one actual stored LIVE feature vector returned:

```text
fare_id: 962add76-21fa-4f01-bb0d-d1fba9cd216c
FareGuard ACTIVE artifact load: PASS
PriceGuard ACTIVE artifact load: PASS
FareGuard prediction: 1205.7900390625
PriceGuard isolation score: 0.06652286894858839
PriceGuard calibrated percentile: 0.992
PriceGuard classification: critical / unusually_high
Database writes: 0
```

This proves inference execution, not predictive accuracy. The XGBoost artifact emits an older-serialization compatibility warning, although prediction and TreeExplainer checks pass locally. Re-run the diagnostic in the deployed Linux container before accepting the deployment. scikit-learn is pinned to **1.6.1**, the version used to fit the saved Isolation Forest; cross-version sklearn loads fail explicitly rather than silently accepting an unsupported pickle.

## EC2 deployment

First commit/push the code changes through your usual workflow. On EC2, open your existing repository checkout and enter `airpulse-api/`:

```bash
git pull --ff-only
mkdir -p models
```

If either file is missing, upload the existing trained files from Windows. Replace the key and checkout path below with your real paths (do not use these placeholders literally):

```powershell
scp -i "C:\path\ec2-key.pem" "D:\New projects\SIH56\airpulse-api\models\fareguard-xgb-v1.joblib" "D:\New projects\SIH56\airpulse-api\models\priceguard-if-v1.joblib" ubuntu@13.53.46.72:/path/to/SIH56/airpulse-api/models/
```

Back in the EC2 backend directory, verify these exact tested files:

```bash
sha256sum models/fareguard-xgb-v1.joblib models/priceguard-if-v1.joblib
```

Expected hashes:

```text
43f6a68b2df6942c0ebe50ad49ab6d593bbbf250bc059a96e96bb192f1ac9f2b  fareguard-xgb-v1.joblib
320178845118ce1051588fa932f19f5af21095215ed4a8beb4016c99af8b0e51  priceguard-if-v1.joblib
```

Ensure the backend `.env` has `MODEL_DIR=/app/models` (or keep the working default `./models`). Both services read this same file. Then:

```bash
chmod 755 models
chmod 644 models/fareguard-xgb-v1.joblib models/priceguard-if-v1.joblib
docker compose up -d --build --no-deps api worker
docker compose exec worker python -m app.scripts.check_ml_models
docker compose exec api python -m app.scripts.check_ml_models
docker compose logs --tail=100 worker
```

The diagnostic prints ACTIVE versions, runtime versions, feature schemas/counts, artifact paths, load results and one real stored LIVE-vector inference result. It does not train, insert observations, or print credentials. Exit 0 requires both models and representative inference to pass; no stored LIVE vector returns NOT_TESTED with a nonzero exit.

After both diagnostics pass, collect a new bounded live batch and use **Send to Data Ingestion**. Verify FareGuard/PriceGuard counts, model versions and per-fare outcomes. Previously ingested/duplicate fares are not silently reprocessed by this repair.

## Files changed for this repair

- `app/ml/live_inference.py`
- `app/ml/model_registry.py`
- `app/ml/priceguard.py` (JSON-native anomaly boolean)
- `app/services/live_processing.py`
- `app/scripts/check_ml_models.py`
- `docker-compose.yml`
- `requirements.txt`
- `tests/unit/test_live_inference.py`
- backend and root `.gitignore` (track regression test/report)
- `docs/LIVE_ML_INFERENCE.md`

Earlier UI/shock-count changes in the working tree are separate from this repair. No frontend changes, schema migrations, new registry rows or model training are required here.
