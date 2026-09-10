# Adaptive ingestion loading

This change improves loading accuracy, not pipeline execution speed. ML, APIx, ingestion transactions and collection semantics remain unchanged.

## Estimate and completion

- Read the latest 30 **COMPLETED** `import_automated_pipeline` records from `pipeline_runs`; use existing input counts and start/finish timestamps.
- Comparable counts are within `max(10, observation_count × 0.5)` observations of the active count.
- With at least three comparable runs, use their rolling median duration. Otherwise use `base_seconds + observation_count × per_observation_seconds`.
- Defaults: 30 seconds overhead, 0.5 seconds per observation, three historical samples. Server settings `INGESTION_ESTIMATE_BASE_SECONDS`, `INGESTION_ESTIMATE_PER_OBSERVATION_SECONDS`, `INGESTION_ESTIMATE_MIN_HISTORY` override these. They are UX configuration, not task timeouts.
- Remaining-time ranges use 75–125% of estimated remaining time, rounded outward to ten-second intervals. Displayed total estimates adjust gradually (20% of the difference per display update).
- Reliable timing for every stage enables median-duration weighting from `pipeline_steps.duration_ms`. Otherwise use backend-confirmed finished-stage count / total. Freeze weights within an operation to prevent a changing history basis from moving progress backwards.
- Elapsed time never completes a run. Only the backend operational status COMPLETED/FAILED ends active processing. PARTIAL remains preserved as the original pipeline outcome; an operation whose pipeline has finished with partial results is operationally completed, not represented as all analyses successful.
- Completion reaches 100%; queued/running states never do. After an overrun, show “Taking longer than usual” with indeterminate progress and await backend confirmation.

## Dataset size

| Observations | Presentation |
|---|---|
| 0–25 | Compact spinner, stage counts and approximate times |
| 26–100 | Confirmed progress bar and approximate times |
| 101–500 | Progress, latest stage output count, stage and elapsed/remaining range |
| Over 500 | Indeterminate animation with confirmed stage counts |

## Progress transport

Existing Redis carries actor-scoped operational snapshots with a 24-hour TTL. `/ingestion/collect?operation_id=<UUID>` remains the same ingestion action and emits count, stage, confirmed stages, start time and status. `/ingestion/progress/<UUID>` polls those snapshots. `/ingestion/timing-history` reads existing SQL tables without writing history. No migration or duplicate timing table was added.

Dataset stage callbacks publish before and after each stage. Analytical writes retain their existing atomic transaction. Redis failures do not fail ingestion; a successful POST response also includes final progress. If both the response and Redis telemetry are unavailable, the UI keeps waiting instead of inventing a completion. A process crash without a recorded failure requires checking backend logs; no elapsed-time cutoff marks it successful or failed.

Additional staged live-ingestion jobs remain asynchronous and their terminal status is read from existing collection metadata. Intermediate substeps inside their atomic transaction remain unreported until committed; the UI reports live ingestion rather than guessing a substep.

After backend completion the UI awaits query/history refresh. Failed refreshes retry as reads; they never restart ingestion. Rejected authorization/validation requests restore the form. Transport errors during an accepted request keep checking status. Backend failures preserve the retry action.

## Files changed

- Backend: `app/api/v1/ingestion.py`, `app/config.py`, `app/services/available_ingestion.py`, `app/services/dataset_orchestrator.py`, new `app/services/ingestion_progress.py`, `.env.example`.
- Frontend: `src/app/(dashboard)/ingestion/page.tsx`, `src/components/ui/CollectionProgress.tsx`, new `src/lib/ingestion-estimate.ts`, `src/lib/api/endpoints.ts`.
- Verification: `tests/unit/test_ingestion_progress.py`, `frontend/scripts/verify-ingestion-estimates.cjs`; ignore-file exceptions for tests and this document.

## Verification and rollout

43 backend tests passed (including six new operational telemetry/history tests and the existing HappyFares regressions). Estimate and SSR rendering checks cover size bands, median/outlier resistance, configurable fallback, immutable history, overruns, stage weighting, estimate smoothing, failed animation and backend-only 100%. TypeScript and the production Webpack build passed.

Rebuild the EC2 API using your existing production Compose configuration and redeploy Vercel. Redis must be reachable through the existing REDIS_URL for progress while the POST is pending. Optional estimate settings belong in the backend environment. No production deployment or live ingestion execution was performed in this task.
