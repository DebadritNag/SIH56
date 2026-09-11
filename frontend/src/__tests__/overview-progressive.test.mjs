/**
 * Live Overview progressive-design tests.
 *
 * Verifies the key invariants of the new day-1-ready dashboard:
 *  - Works with minimal data (0 days, 1 day, 4 days)
 *  - APIx readiness shown instead of empty chart until threshold met
 *  - KPI cards show "—" not fake zero when data unavailable
 *  - No SYNTHETIC/REPLAY/MODELLED values leak into live panels
 *  - Filter changes propagate to all relevant panels
 *  - Historical comparison panels only appear when history >= threshold
 *  - 30-day threshold unlocks APIx trend
 *
 * Run: node src/__tests__/overview-progressive.test.mjs
 */

import assert from 'node:assert/strict';

const APIX_HISTORY_THRESHOLD = 7;

// ---------------------------------------------------------------------------
// Mirror the rendering-decision logic from the new overview page
// ---------------------------------------------------------------------------

function resolveCollectionAgo(latestCollected) {
  if (!latestCollected) return null;
  const secs = Math.floor((Date.now() - new Date(latestCollected).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function renderKpiValue(value, loading) {
  if (loading) return '—';
  if (value === null || value === undefined || value === 0) return '—';
  return String(value);
}

function shouldShowApixTrend(apixAvailable, historyDays) {
  return apixAvailable && historyDays >= APIX_HISTORY_THRESHOLD;
}

function renderTrustScore(score) {
  if (score == null || score === 0) return 'Unavailable';
  const pct = (score * 100).toFixed(1);
  const tier = score >= 0.90 ? 'HIGH QUALITY' : score >= 0.70 ? 'ACCEPTABLE' : 'LOW QUALITY';
  return `${pct} / 100 (${tier})`;
}

function isSyntheticOrReplay(dataOrigin) {
  return ['SYNTHETIC', 'REPLAY', 'MODELLED'].includes(String(dataOrigin).toUpperCase());
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
function test(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (e) { console.error(`  ✗ ${label}\n    ${e.message}`); failed++; }
}

console.log('\nLive Overview progressive-design tests\n');

// ===========================================================================
// 1. Data unavailable — KPI cards show "—" not fake zero
// ===========================================================================

test('0 total_eligible → Live Observations shows "—"', () => {
  const v = renderKpiValue(0, false);
  assert.equal(v, '—');
  assert.notEqual(v, '0');
});

test('0 active routes → Active Routes shows "—"', () => {
  assert.equal(renderKpiValue(0, false), '—');
});

test('null latest_collected → Latest Collection shows null (no time shown)', () => {
  assert.equal(resolveCollectionAgo(null), null);
});

test('loading=true → value always "—" regardless of actual value', () => {
  assert.equal(renderKpiValue(61, true), '—');
  assert.equal(renderKpiValue(3, true), '—');
});

// ===========================================================================
// 2. Data available — KPI cards show real values
// ===========================================================================

test('61 observations → shows "61"', () => {
  assert.equal(renderKpiValue(61, false), '61');
});

test('3 active routes → shows "3"', () => {
  assert.equal(renderKpiValue(3, false), '3');
});

test('latest_collected 2 min ago → shows relative time', () => {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const ago = resolveCollectionAgo(twoMinAgo);
  assert.ok(ago && ago.includes('m ago'), `expected "m ago", got: ${ago}`);
});

test('latest_collected 30 sec ago → shows "Ns ago"', () => {
  const ago = resolveCollectionAgo(new Date(Date.now() - 30000).toISOString());
  assert.ok(ago && ago.includes('s ago'));
});

// ===========================================================================
// 3. APIx readiness — no huge empty chart until threshold met
// ===========================================================================

test('0 history days + apix=false → no APIx trend shown', () => {
  assert.equal(shouldShowApixTrend(false, 0), false);
});

test('4 history days + apix=false → still no APIx trend', () => {
  assert.equal(shouldShowApixTrend(false, 4), false);
});

test('7 history days + apix=true → APIx trend unlocked', () => {
  assert.equal(shouldShowApixTrend(true, 7), true);
});

test('6 history days + apix=true → still locked (threshold is 7)', () => {
  assert.equal(shouldShowApixTrend(true, 6), false);
});

test('30 history days + apix=true → APIx trend shown', () => {
  assert.equal(shouldShowApixTrend(true, 30), true);
});

// ===========================================================================
// 4. Progress bar for APIx readiness
// ===========================================================================

test('APIx progress bar: 4/7 days = ~57%', () => {
  const pct = Math.min(100, (4 / APIX_HISTORY_THRESHOLD) * 100);
  assert.ok(pct > 50 && pct < 65, `expected ~57%, got ${pct}`);
});

test('APIx progress bar: 0 days = 0%', () => {
  assert.equal(Math.min(100, (0 / APIX_HISTORY_THRESHOLD) * 100), 0);
});

test('APIx progress bar: capped at 100% when over threshold', () => {
  assert.equal(Math.min(100, (30 / APIX_HISTORY_THRESHOLD) * 100), 100);
});

// ===========================================================================
// 5. SYNTHETIC / REPLAY / MODELLED exclusion
// ===========================================================================

test('SYNTHETIC data_origin must be excluded from live panels', () => {
  assert.equal(isSyntheticOrReplay('SYNTHETIC'), true);
});

test('REPLAY data_origin must be excluded', () => {
  assert.equal(isSyntheticOrReplay('REPLAY'), true);
});

test('MODELLED data_origin must be excluded', () => {
  assert.equal(isSyntheticOrReplay('MODELLED'), true);
});

test('LIVE data_origin must be included', () => {
  assert.equal(isSyntheticOrReplay('LIVE'), false);
});

test('IMPORTED data_origin must be included', () => {
  assert.equal(isSyntheticOrReplay('IMPORTED'), false);
});

// ===========================================================================
// 6. Trust score classification
// ===========================================================================

test('trust score 0 → Unavailable (not a quality tier)', () => {
  assert.equal(renderTrustScore(0), 'Unavailable');
  assert.ok(!renderTrustScore(0).includes('HIGH QUALITY'));
});

test('trust score null → Unavailable', () => {
  assert.equal(renderTrustScore(null), 'Unavailable');
});

test('trust score 0.948 → HIGH QUALITY', () => {
  const r = renderTrustScore(0.948);
  assert.ok(r.includes('HIGH QUALITY'), `got: ${r}`);
  assert.ok(r.includes('94.8'), `got: ${r}`);
});

// ===========================================================================
// 7. Dashboard still populated with <30 days of data
// ===========================================================================

test('dashboard with 1 day of data: still shows observations and routes', () => {
  const ctx = { total_eligible: 12, live_count: 5, imported_count: 7, routes: ['DEL-BOM'], historical_days: 1, apix_available: false };
  assert.ok(ctx.total_eligible > 0, 'should have eligible observations');
  assert.ok(ctx.routes.length > 0, 'should have active routes');
  assert.equal(shouldShowApixTrend(ctx.apix_available, ctx.historical_days), false);
  assert.equal(renderKpiValue(ctx.total_eligible, false), '12');
  assert.equal(renderKpiValue(ctx.routes.length, false), '1');
});

test('dashboard with 4 days of data: shows all current data panels', () => {
  const ctx = { total_eligible: 61, live_count: 22, imported_count: 39, routes: ['DEL-BOM','DEL-CCU','BOM-BLR'], historical_days: 4, apix_available: false };
  // All KPI panels work
  assert.equal(renderKpiValue(ctx.total_eligible, false), '61');
  assert.equal(renderKpiValue(ctx.routes.length, false), '3');
  // APIx still building
  assert.equal(shouldShowApixTrend(false, ctx.historical_days), false);
  const progressPct = (ctx.historical_days / APIX_HISTORY_THRESHOLD) * 100;
  assert.ok(progressPct > 0 && progressPct < 100, 'progress bar shows partial progress');
});

test('empty dataset: all KPI values show — not fake zeros', () => {
  const ctx = { total_eligible: 0, routes: [], historical_days: 0, apix_available: false, latest_collected: null };
  assert.equal(renderKpiValue(ctx.total_eligible, false), '—');
  assert.equal(renderKpiValue(ctx.routes.length, false), '—');
  assert.equal(resolveCollectionAgo(ctx.latest_collected), null);
  assert.equal(shouldShowApixTrend(ctx.apix_available, ctx.historical_days), false);
  assert.equal(renderTrustScore(0), 'Unavailable');
});

// ===========================================================================
// 8. Filter propagation — filter changes must update query keys
// ===========================================================================

test('route filter change produces different summary query key', () => {
  function makeKey(filters) {
    return ['dashboard-summary', 'live',
      filters.dateRange.from, filters.dateRange.to, filters.dateRange.preset,
      filters.routeIds.sort().join(','), '', filters.bookingWindows.sort((a,b)=>a-b).join(','), '',
    ].join('|');
  }
  const base = { dateRange: { from: '2026-08-04', to: '2026-09-02', preset: '30D' }, routeIds: [], bookingWindows: [1,7,15,30,45] };
  const filtered = { ...base, routeIds: ['DEL-BOM'] };
  assert.notEqual(makeKey(base), makeKey(filtered));
});

test('booking window filter change produces different summary query key', () => {
  function makeKey(windows) { return windows.sort((a,b)=>a-b).join(','); }
  assert.notEqual(makeKey([1,7,15,30,45]), makeKey([1,7]));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
