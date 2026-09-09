# HappyFares Crawl4AI adapter — EC2 deployment and verification

## Result and scope

Implemented HappyFares only. A real local Windows Crawl4AI 0.9.3/headless Chromium run succeeded on 9 September 2026 at 11:55:29 UTC: HTTP 200 and five validated DEL–BOM fares for 16 September 2026. Evidence is saved locally at `scratch/happyfares-crawl4ai-real-result.json`, including each raw card and SHA-256. No EC2 live crawl or database ingestion was performed; local success does not prove EC2 availability. The first adapter supports DEL/BOM only.

The adapter uses HappyFares' existing public `/flights/` search URL and observed card selector. If a direct public search redirects or cards do not appear, it reports the actual failure. No private fare API, CAPTCHA bypass, session spoofing, LLM fares, screenshots, video, or PDF is used. There are no automatic crawl retries.

## Files

- `app/collectors/crawl4ai_collector.py`: lazy-loaded headless Chromium Crawl4AI engine, bounded DOM extraction, policy/access guards, lifecycle/status reporting.
- `app/collectors/sources/happyfares.py`: HappyFares card parser; reuses the existing public URL builder and selector. Records raw card text, SHA-256, UTC observation time, exact observed route/date, positive INR price, nullable optional fields, LIVE origin and CRAWL4AI acquisition method.
- `app/collectors/registry.py`: HappyFares resolves to Crawl4AI even while DEMO_MODE is enabled.
- `app/services/live_acquisition.py`: dispatches HappyFares to Celery, claims durable jobs and writes raw_fares only. Collection status detail remains in metadata.result; database lifecycle enum remains compatible (COMPLETED/FAILED). Result metadata contains run ID, source, engine, timestamps, observation count and failure details.
- `app/workers/collection_tasks.py`: new staging-only task; loop-safe DB connections preserve the existing Supabase pooler and SSL configuration. No analytics dispatch.
- `app/workers/celery_app.py`: registers tasks and defaults worker concurrency to one.
- `app/services/collection_orchestrator.py`: excludes HappyFares from automatic batch ingestion.
- `app/api/v1/live.py`: includes Crawl4AI enablement and leaves HappyFares memory checks to the worker host.
- `app/scripts/test_happyfares_crawl4ai.py`: bounded real worker diagnostic.
- `tests/unit/test_happyfares_crawl4ai.py`: parser, access, registry, mocked browser lifecycle, cap and staging tests.
- `frontend/src/lib/config.ts`: uses `/backend-api/api/v1`, preserving next.config.ts EC2 rewrite. Existing `/api/proxy` compatibility handler remains present.
- Root/backend `.gitignore`: narrowly includes this diagnostic, test and runbook in version control.

## Deploy the reviewed changes

First commit and push the reviewed changes to your deployment branch. These instructions do not deploy or alter your EC2 instance automatically.

SSH into the existing EC2 host using your existing key and account. From the existing SIH56 clone (use its actual installed path):

```bash
git status --short
git pull --ff-only
cd airpulse-api
```

Use the **existing production Compose file/configuration on EC2**. The repository's stock docker-compose.yml is a local-development stack with a local Postgres service and hardcoded development DB settings. Do not replace the working EC2/Supabase configuration with it. The following commands assume your current production Compose selection is already active (for example through COMPOSE_FILE) and its services are named `api`, `worker`, and `redis`:

```bash
docker compose config --services
docker compose ps
nano .env
```

Preserve all existing secrets, database URLs, Nginx and Redis settings. Ensure the API and worker receive these non-secret settings through the existing production environment wiring:

```dotenv
CRAWL4AI_ENABLED=true
CRAWL4AI_BROWSER_CONCURRENCY=1
CRAWL4AI_DEFAULT_MAX_RESULTS=5
HAPPYFARES_PROTOTYPE_ENABLED=true
HAPPYFARES_REVIEW_NOTES=<your actual review of current source terms and permitted public paths>
LIVE_WORKER_ENABLED=true
DEMO_MODE=true
```

Do not copy the review placeholder as an approval. If review is not complete, leave the prototype disabled; the collector returns SKIPPED_POLICY. Keep the existing worker command's `--concurrency=1`; do not increase browser concurrency. Merely saving `.env` is insufficient unless your existing production Compose file passes these settings to both services.

Build and recreate only the application services, keeping the existing Nginx and database arrangement:

```bash
docker compose build api worker
docker compose up -d --no-deps api worker
docker compose exec worker celery -A app.workers.celery_app inspect registered
docker compose exec worker python -m app.scripts.check_crawl4ai
docker compose logs --tail=80 api worker
```

Confirm registered tasks include `app.workers.collection_tasks.collect_staged_live_task`. A successful browser installation check is not a successful HappyFares collection.

## First real diagnostic

```bash
docker compose exec api python -m app.scripts.test_happyfares_crawl4ai
```

Equivalent inside the configured Python environment:

```bash
python -m app.scripts.test_happyfares_crawl4ai
```

This queues DEL → BOM, T+7 (Indian local date), Economy, one adult, INR, max five through Celery. It prints a run ID immediately and polls for up to five minutes. The worker independently bounds acquisition to 180 seconds. Diagnostic timeout does not cancel a queued job: inspect the printed run before submitting another. No secrets are deliberately printed.

The result must contain genuinely observed fares and persisted raw evidence before calling collection successful. Fewer valid fares than requested return PARTIAL; zero valid fares cannot return SUCCESS. HTTP 403→BLOCKED, 429→RATE_LIMITED, visible challenge→CAPTCHA_DETECTED. Missing cards, failed navigation, changed selectors and policy restrictions remain explicit failures. No APIx, FareGuard or PriceGuard update occurs until the user selects **Send to Data Ingestion**.

Source registration must already exist as an enabled, active HappyFares live prototype. This change needs no new schema migration. If it is missing, use the project's existing HappyFares source registration migration after checking your database migration state.

## Vercel 404 correction

Keep the current rewrite `/backend-api/:path*` → `http://54.234.16.107/:path*`. Set the client-safe Vercel variables and rebuild/redeploy the frontend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/backend-api
NEXT_PUBLIC_API_V1_PREFIX=/api/v1
```

No EC2 address belongs in React components. Backend secrets stay on EC2. After deploying, browser requests should target `/backend-api/api/v1/...`, not the old `/api/proxy/...`. A remaining 404 should be checked against the exact rewritten upstream endpoint and the deployed backend revision; this frontend fix does not create missing backend routes.

## Verification performed locally

```bash
python -m pytest tests/unit/test_happyfares_crawl4ai.py tests/unit/test_happyfares.py -q
```

23 tests passed, including the existing captured-card parser tests. The new test file is self-contained and can be run alone on a clean checkout. Frontend `tsc --noEmit` passed. Unit browser-hook tests use a mocked Crawl4AI runtime. Separately, the real local headless Crawl4AI run returned five fares: QP-1836 ₹5,967; QP-1112 ₹5,961; QP-1128 ₹5,961; QP-1820 ₹5,961; QP-1119 ₹5,971. All were Akasa Air, with route/date and raw evidence verified. Base fare and taxes remained null because the cards did not disclose them. No production DB writes or deployments were made. EC2 remains untested. The real test exposed and fixed missing originName/destinationName/BType URL fields, repeated DOM-read timeouts, and misclassification of source-code excerpts in wrapped Crawl4AI errors.

The hook integration follows the official Crawl4AI lifecycle documentation: https://docs.crawl4ai.com/advanced/hooks-auth/ .


## Main application integration update

The Live Collection page defaults to HappyFares, DEL–BOM, T+7 and five fares. It explicitly requests CRAWL4AI. The API validates the supported route and dispatches to the existing durable Celery job; it does not use API-container memory to reject a browser running on a separate worker. Browser availability is unknown until checked on that worker. Actual source URL is persisted in the result and linked from the UI to make departure-date comparison explicit. The API readiness response reports CRAWL4AI and Celery accurately.

requirements.txt pins Crawl4AI 0.9.3, the version used by the successful local test. Rebuild both API and worker images, then redeploy the Vercel frontend to pick up the form and routing changes. Keep the existing reviewed HappyFares enablement settings on both API and worker; local test-only environment overrides were not written to production configuration. Do not increase concurrency. EC2 success still needs the real worker diagnostic.

New integration checks cover the application's POST handler preserving date/limit and selecting CRAWL4AI, worker-host readiness, and Celery dispatch only after the durable database commit. These are mocked integration checks; no production DB or broker was contacted. All 23 selected tests and the frontend TypeScript check passed.
