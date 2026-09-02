# Live Scraping (Playwright) & Supabase Realtime

This document covers the two features completed after the initial Supabase foundation:

1. Live scraper collectors for dynamic Indian airline portals (Playwright).
2. Supabase Realtime frontend subscription that keeps the dashboard live.

---

## 1. Live Airline Scraping (Playwright)

### Architecture

| Piece | Path | Role |
|-------|------|------|
| Failure stages | `app/core/enums.py` → `ScrapeFailureStage` | Precise, diagnosable stages (DNS, CONNECTION, TIMEOUT, HTTP_ERROR, BLOCKED, CAPTCHA_DETECTED, EMPTY_RESPONSE, SELECTOR_NOT_FOUND, PARSE_ERROR, NO_AVAILABILITY, VALIDATION_ERROR, DATABASE_ERROR, BROWSER_LAUNCH_FAILURE, NOT_CONFIGURED). |
| Error type | `app/core/exceptions.py` → `ScraperError` | Raised on any scrape failure, carrying the stage + reason + optional HTTP status. |
| Selector config | `app/collectors/config/airline_selectors.json` | **The maintenance point.** URL templates + DOM selectors + enable flags per airline. |
| Collector base | `app/collectors/airline/playwright_collector.py` → `PlaywrightCollector` | Generic, config-driven Playwright collector. |
| Adapters | `app/collectors/airline/adapters.py` | `IndiGoCollector`, `AirIndiaCollector`, `AirIndiaExpressCollector`, `AkasaAirCollector`, `SpiceJetCollector` + `build_airline_collector()`. |
| Selection | `app/collectors/registry.py` → `CollectorRegistry.build_for_source()` | Picks live-airline / synthetic / replay / static per source row. |

### Key guarantees

- **Never fakes data.** If an airline is not enabled or Playwright is not installed, the
  collector raises `ScraperError(NOT_CONFIGURED / BROWSER_LAUNCH_FAILURE)`. It never
  silently falls back to replay/synthetic — matching the BRAIN.md live-test protocol.
- **Ethical only.** Authoritative User-Agent, bounded nav/selector timeouts, per-source
  rate limiting, and heavy-resource blocking. **No** anti-bot evasion, CAPTCHA solving,
  or auth bypass. A block or CAPTCHA is recorded (`BLOCKED` / `CAPTCHA_DETECTED`) and the
  scrape stops.
- **Optional dependency.** `playwright` is imported lazily; the app runs without it.

### Enabling live collection

1. Install the browser runtime:
   ```bash
   pip install playwright
   playwright install chromium
   ```
2. In `app/collectors/config/airline_selectors.json`, set the airline's `"enabled": true`.
3. **Maintain the selectors.** Airline portals change their DOM often. When a live test
   reports `SELECTOR_NOT_FOUND` or `PARSE_ERROR`, update that airline's `selectors` block
   (and `search_url_template` if the URL scheme changed). No code change is required —
   only the JSON. Each selector accepts a comma-separated fallback list.
4. Trigger a live scraper test (`POST /api/v1/ingestion/sources/{id}/collect`). It passes
   only if at least one fare is collected, parsed, validated, and stored with provenance.

### Failure-stage cheat sheet

| Stage | Typical cause | Fix |
|-------|---------------|-----|
| `NOT_CONFIGURED` | airline `enabled: false` | flip the flag in the JSON |
| `BROWSER_LAUNCH_FAILURE` | Playwright/Chromium not installed | `playwright install chromium` |
| `DNS_FAILURE` / `CONNECTION_FAILURE` | network / portal down | retry later; mark source degraded |
| `TIMEOUT` | slow portal | raise `nav_timeout_ms` / `selector_timeout_ms` in defaults |
| `HTTP_ERROR` | 4xx/5xx (non-block) | inspect URL template |
| `BLOCKED` / `CAPTCHA_DETECTED` | portal anti-bot | stop; do NOT evade |
| `NO_AVAILABILITY` | genuinely no flights | none (valid empty result) |
| `SELECTOR_NOT_FOUND` / `PARSE_ERROR` | DOM changed | update selectors in the JSON |

---

## 2. Supabase Realtime (frontend)

### Pattern (source of truth stays FastAPI)

```
FastAPI/Celery mutate an operational table
    → Supabase Realtime broadcasts the change
    → useRealtimeSubscription receives it
    → it invalidates the matching TanStack Query keys
    → the UI refetches the authoritative result from FastAPI
```

### Pieces

| Piece | Path |
|-------|------|
| Browser client | `frontend/src/lib/supabase/client.ts` (lazy, cached; anon key; auth+realtime only) |
| Subscription hook | `frontend/src/lib/hooks/useRealtimeSubscription.ts` |
| Wiring | `frontend/src/components/layout/AppShell.tsx` (subscribes once; shows a Live/Connecting/Offline/Polling pill) |

### Subscribed tables → invalidated query keys

Only the 8 operational tables in the `supabase_realtime` publication emit events (never
the high-volume fare tables):

| Table | Invalidates |
|-------|-------------|
| `collection_runs` | `ingestion-status`, `runs`, `dashboard-summary` |
| `pipeline_runs` | `ingestion-status`, `runs` |
| `pipeline_steps` | `ingestion-status`, `dashboard-summary`, `apix-trend`, `apix-latest`, `top-route-movements` |
| `scraping_test_runs` | `scraping-test` |
| `alerts` | `alerts`, `dashboard-summary` |
| `anomalies` | `anomalies`, `dashboard-summary` |
| `source_health_logs` | `sources`, `source-health`, `dashboard-summary` |
| `airfare_index` | `apix-latest`, `apix-trend`, `dashboard-summary` |

### Access model

Migration `airpulse_15_realtime_anon_read` grants the `anon` role `SELECT` on these 8
operational tables so realtime delivers events before full Supabase Auth is wired. These
contain only operational metadata — **no PII, no raw/validated fare rows**. Sensitive
tables (`raw_fares`, `validated_fares`, `fare_predictions`, `airfare_index` components,
etc.) remain backend-only (service role bypasses RLS; anon/authenticated see no rows).

### Graceful degradation

If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent, the client is
`null`, the hook reports `disabled`, and the app falls back to React Query's normal
polling/staleness — nothing breaks.
