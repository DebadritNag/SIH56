# Readiness dashboards and Overview loading

## What changed

APIx now presents persisted observation history, route/window coverage, base-period status and methodology requirements when no calculated national index exists. Price Shocks presents live source coverage and configured verification criteria, alongside the existing confirmed-event list. Overview renders its dashboard-shaped skeleton during the shared ingestion gate and data-context resolution, then replaces panels as their queries settle.

No schema changes, migrations, model changes, threshold changes, scraping changes or analytical writes are included.

## Backend truth and limitations

New authenticated read-only endpoints:

- `GET /api/v1/index/readiness`
- `GET /api/v1/alerts/readiness`

Existing endpoints retained:

- `/index/latest` and `/index/{id}/components` supply actual persisted APIx values.
- `/alerts/confirmed-shocks` remains the shared source for the sidebar and confirmed-shock page.
- `/ingestion/readiness`, `/live-mode/status`, Overview summary, route, fare and anomaly endpoints retain their meanings.

The active `apix-live-matched-v1` calculator has **no configured minimum observation-day count**. Consequently `required_days` and `remaining_days` are null. This change does not introduce a 30-day eligibility gate. The UI supports a backend-provided day target, but honestly displays an unconfigured target for the current methodology. An analyst must still configure the base basket; collecting more days alone does not configure it.

APIx readiness reuses the calculator's exact eligibility predicate: validated, nonduplicate, economy, LIVE/IMPORTED observations with an eligible `fare_index_eligibility` record. When active positive weights exist, route/window history is restricted to those components. Before weights exist, the eligible observation inventory is shown as context. It does not certify a basket.

History counts distinct `collected_at` dates in Asia/Kolkata. LIVE and IMPORTED dates are combined as a union, not a sum. Multiple departures or booking windows observed on the same day still count once. Base/current matching retains the calculator's UTC date semantics and canonical booking-window buckets. SYNTHETIC, REPLAY and MODELLED observations never enter the readiness query.

Shock coverage counts distinct existing source IDs in validated, nonduplicate LIVE observations for the current UTC day. Repeated observations or collections from one channel do not increase source diversity. Imported observations do not count as live independent confirmation channels. This is inventory coverage, not proof of synchronized route/window agreement; coverage never creates a confirmed event. Actual confirmation still uses the existing `confirmed_live_shock` rules unchanged.

The backend does not currently expose persisted unverified surge candidates, candidate-stage evaluations or an explicit minute-level synchronization setting. Those fields remain unavailable, not zero or inferred from PriceGuard anomalies. The UI explains this limitation. No fake event history is added.

## Read-only database verification: 19 September 2026

- APIx status: `MISSING_BASE_PERIOD`
- Genuine observation dates: **9** (7 LIVE dates, 2 IMPORTED dates)
- Eligible fares: **111** across **3** observed corridors
- Required/remaining days: **not configured**, not 30/21
- Base period: absent; active required components: 0
- Route/window base coverage cannot be certified without that configuration.
- Current UTC-day independent LIVE sources: **1 (HappyFares)**
- Required independent sources: **2**
- Configured minimum movement: **20%**, minimum quotes: **10**, robust Z-score: **3**
- Active confirmed shocks: **0**, from the existing confirmed-shock endpoint
- Candidate count: unavailable

These are a dated diagnostic snapshot, not hardcoded application values. To recheck in the backend environment:

```bash
python -m app.scripts.check_readiness
```

The diagnostic uses a read-only transaction, a statement timeout and an overall timeout, and prints no credentials.

## Loading, refresh and mode isolation

The old `Checking processed observations…` screen lived in `components/data/LiveDataGate.tsx`. Overview now uses `OverviewSkeleton` there, and the existing `overview/loading.tsx` already uses that same component. APIx and Shock readiness may render even when no processed fares exist, allowing genuine zero-data explanations.

Critical Overview queries: the ingestion gate, live data context, and dashboard summary. Secondary panels use their own route-contributor, latest-fare, signal, source and history queries. Context resolution starts with a full shell; once it resolves, critical results and independent panel skeletons render together. `isPending`/absence of cached data controls initial skeletons; `isFetching` retains cached data. Query errors have retry controls rather than becoming empty data. Reports are disabled until the required initial observations, summary and route queries are available.

An existing anomaly-query error fallback that returned demo anomalies in Live Mode was removed. Previous-data placeholders are now mode-scoped so mode switches cannot reuse synthetic source/fare data.

Readiness query keys join canonical post-ingestion invalidation and existing Supabase Realtime table mappings. Existing subscriptions, publications and auth remain unchanged. Existing bounded polling continues; no simulated loading phases or completion timers were introduced.

## Files

Backend:

- `app/services/readiness.py`: read-only readiness projections, aggregate SQL and shared APIx eligibility predicate
- `app/services/live_processing.py`: reuse predicate, unchanged calculation
- `app/api/v1/index.py`, `app/api/v1/alerts.py`: viewer-protected readiness routes
- `app/scripts/check_readiness.py`: safe database diagnostic
- `tests/unit/test_readiness.py`: history, provenance, coverage and read-only tests

Frontend:

- `src/components/readiness/APIxReadinessDashboard.tsx`
- `src/components/readiness/PriceShockReadiness.tsx`
- `src/components/readiness/ReadinessUI.tsx`
- `src/components/ObservedIndex.tsx`
- `src/app/(dashboard)/shocks/page.tsx`
- `src/app/(dashboard)/overview/page.tsx`
- `src/components/skeletons/OverviewSkeleton.tsx`
- `src/components/data/LiveDataGate.tsx`
- `src/components/data/GenerateReportButton.tsx`
- `src/lib/hooks/useLiveModeContext.ts`
- `src/lib/hooks/useResources.ts`
- `src/lib/hooks/useRealtimeSubscription.ts`
- `src/lib/queryInvalidation.ts`
- `src/__tests__/readiness.test.cjs`
- `package.json`: add readiness regression suite

Gitignore files keep the new tests and this report tracked.

## Validation

- 41 backend readiness/confirmed-shock tests passed.
- Frontend readiness tests render actual components: initial skeleton, context gate, genuine empty state, query failure, cached refresh, actual stored APIx transition, partial history/progress bounds, mode separation, report gating and retry.
- Existing corridor/PDF, Overview, Price Shock sync, stale-data sync and market-signal tests passed.
- Source TypeScript check passed.
- All three surfaces inspected at desktop and mobile widths, with no horizontal page overflow.
- Production webpack compilation succeeded, but the full build's typecheck is blocked by pre-existing malformed generated files in `.next/dev/types/routes.d.ts` and `validator.ts`. Those generated files were not edited and type checking was not disabled.

Backend and frontend must both be deployed for the new endpoints. No Supabase SQL or environment-variable changes are required. Changes have not been deployed from this task.
