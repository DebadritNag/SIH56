# Live corridor implementation and verification

Verified locally on 10 September 2026. Changes are ready for deployment; EC2 and Vercel were not deployed in this task.

## Inspection before corridor changes

Inspected `frontend/src/components/LiveCollection.tsx`, the live/demo wrapper in `frontend/src/app/(dashboard)/scraping-test/page.tsx`, Overview and its `useDashboard` hooks; backend `app/api/v1/live.py`, `app/schemas/runs.py`, `app/collectors/base.py`, `app/collectors/crawl4ai_collector.py`, `app/collectors/sources/happyfares.py`, `app/scraping/happyfares_browser.py`, `app/services/live_acquisition.py`, `app/db/models.py`, `app/core/utils.py`, the existing acquisition migration and diagnostic script. Existing registry/Celery/staging regression tests cover dispatch through the current system.

Hardcoded restrictions found:

- API required the DEL/BOM airport pair. Replaced with the exact directed corridor registry.
- HappyFares airport-name map contained only DEL and BOM. Added CCU/kolkata and BLR/bengaluru.
- UI defaulted to DEL/BOM free-text inputs. Replaced with server-provided corridor options, default DEL-BOM.
- Diagnostic script used DEL-BOM and T+7. Kept those safe defaults, added explicit route/date arguments.
- No permanent 17 September production date existed. T+7 remains the UI default; every submission sends its selected ISO date.
- The API and canonical search model capped lead time at 365 days. Removed that artificial ceiling; actual upstream inventory still controls availability.

## Implementation

`app/collectors/corridors.py` owns DEL-BOM, DEL-CCU and BOM-BLR. `/live/config` returns that registry for the dropdown. API validation rejects unsupported/reversed/same-airport corridors, malformed dates and past dates in Asia/Kolkata. The source adapter uses the same registry and retains the exact existing URL structure, date formatting and selectors. Browser configuration, concurrency and access checks were not changed.

Card parsing still verifies observed origin, destination and departure date before accepting a price. Missing optional fields remain null. Exact `advance_purchase_days` and `booking_window_days` are derived from the observation date in India; `booking_window_bucket` uses the existing separate bucket mapping. No price prediction or substitute fare is introduced.

The UI retains the cooldown countdown and real stage telemetry. It locks source/corridor/date/limit controls during acquisition, suppresses immediate duplicate submission, shows requested context and displays source, status, quote count and timestamps in history. Ingestion stays visibly busy while queued/running and during query refresh. Terminal ingestion invalidates the existing TanStack Query cache, including inactive pages for their next mount. Overview now has an initial Live Mode skeleton and independent pending trend/contribution skeletons.

Collection remains staging-only. The explicit ingestion action is required before canonical processing, FareGuard, PriceGuard, APIx or dashboard publication. Ingestion substeps are committed with the processing transaction: the UI says it is waiting for committed results rather than inventing an intermediate step.

## Database compatibility

Migration required: **NO**.

`collection_runs.metadata.request` already stores requested route/date. `raw_fares` already stores `origin_requested`, `destination_requested`, `departure_requested`, `booking_window_requested`, `collection_run_id`, `collected_at`, immutable `raw_payload` and hash. `validated_fares.booking_window_days` stores exact lead time; the model already exposes a separately derived bucket. New optional observation metadata fits the existing JSON payload. No schema, RLS, auth, secrets or production data was changed.

## Actual live evidence

One headless Crawl4AI session per test, five-fare cap, local Windows host. All departure dates were **2026-09-17**. No EC2 live test is claimed.

| Corridor | Run started (UTC) | Result | Fares | First observed quote |
|---|---|---|---|---|
| DEL-BOM baseline | 2026-09-10 12:24:28 | SUCCESS | 5 | SG-162, INR 4,968 |
| DEL-CCU | 2026-09-10 12:27:40 | SUCCESS | 5 | 6E-6236,342, INR 6,976 |
| BOM-BLR | 2026-09-10 12:28:58 | SUCCESS | 5 | AI-2812, INR 4,983 |

Local evidence files are `scratch/happyfares-DEL-BOM-2026-09-17.json`, `scratch/happyfares-DEL-CCU-2026-09-17.json` and `scratch/happyfares-BOM-BLR-2026-09-17.json`. Each includes the original search URL, observed UTC timestamps, card fragments and SHA-256 hashes. All 15 hashes, positive fares and route/date contexts were checked. These files are local test evidence, not imported analytics. Connecting itineraries are retained as observed.

The first sandboxed baseline attempt could not connect; the authorized network-enabled run then succeeded. No blocked source response was bypassed. Other departure dates, future inventory horizons and production-host access are not guaranteed. Year rollover (2027-01-02) and leap day (2028-02-29) were validated with fixtures, not live inventory searches.

## Tests

- 42 backend tests passed: registry/engine, bounds, observed/null values, context mismatch, all three corridors, baseline URL, date serialization, year rollover/leap years, invalid dates/routes, request forwarding, history context, lead days, staging-only storage, no-availability, access blocks and browser cleanup.
- `node scripts/verify-live-collection-ui.cjs`: component-state checks for locked/unlocked controls, route/date payload, double-click guard, cooldown expiry, real stage rendering and persistent asynchronous ingestion loading. Overview guard is checked statically.
- TypeScript passed; production `next build --webpack` passed after allowing the configured font download. Later small UI adjustments were checked again with TypeScript/component tests.
- Desktop 1366px and mobile 390px isolated component previews inspected. Fixed run-selector overflow; both widths passed the page-overflow check. Preview uses explicit test state, not a production database session.

## Files changed for corridor support

- `.gitignore` (track this report)
- `app/collectors/corridors.py`
- `app/collectors/sources/happyfares.py`
- `app/api/v1/live.py`
- `app/schemas/runs.py`
- `app/scripts/test_happyfares_crawl4ai.py`
- `tests/unit/test_happyfares_crawl4ai.py`
- `frontend/src/components/LiveCollection.tsx`
- `frontend/src/app/(dashboard)/overview/page.tsx`
- `frontend/scripts/verify-live-collection-ui.cjs`
- This report; scratch evidence/previews remain local.

## Deployment and EC2 verification

After the changes are committed and available on your deployment branch, pull them on EC2. In `airpulse-api/`, use your existing production Compose files/environment and rebuild both processes:

```bash
git pull --ff-only
docker compose up -d --build --no-deps api worker
docker compose logs --tail=80 api worker
```

Redeploy the frontend on Vercel. Existing `BACKEND_ORIGIN`, `/backend-api` rewrite and Supabase settings remain unchanged. Deploy backend first so the frontend receives the corridor registry.

To exercise the deployed Celery → staging path (one command at a time, respecting cooldowns):

```bash
docker compose exec api python -m app.scripts.test_happyfares_crawl4ai --origin DEL --destination BOM --departure 2026-09-17
docker compose exec api python -m app.scripts.test_happyfares_crawl4ai --origin DEL --destination CCU --departure 2026-09-17
docker compose exec api python -m app.scripts.test_happyfares_crawl4ai --origin BOM --destination BLR --departure 2026-09-17
```

Choose a future date if these dates have passed. Each command creates a real staging run and prints its ID/status/count; it does not ingest observations. Use **Send to ingestion** in the application and verify the completed ingestion run and refreshed pages separately. This production handoff was covered with mocks locally, not executed against your live database in this task.
