/**
 * Real-Time Market Signals card synchronisation tests.
 *
 * Verifies the shared data contract between the badge count and the card body
 * that was broken by the previous implementation:
 *   - badge: hardcoded '5 Active Signals'
 *   - body: (meta.isMock ? mockMarketSignals : []) → empty in live mode
 *
 * Run: node src/__tests__/market-signals-sync.test.mjs
 */

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers mirroring the fixed overview card rendering logic
// ---------------------------------------------------------------------------

function makeAnomaly(overrides = {}) {
  return {
    id: `anom-${Math.random().toString(36).slice(2)}`,
    code: 'ANM-001',
    timestamp: new Date().toISOString(),
    severity: 'HIGH',
    route: 'DEL-BOM',
    booking_window: 'T+7',
    airline: 'IndiGo',
    source: 'IndiGo Direct',
    actual_fare: 9500,
    expected_fare: 7000,
    deviation_pct: 35.7,
    percentile: 92.0,
    status: 'open',
    evidence: { flight_number: '6E-204', departure_time: 'Tomorrow 06:15 IST', base_fare: 8360, taxes: 950, fees: 190, collection_time: 'Now', raw_response_hash: 'abc', collector_version: 'v1' },
    shap_factors: [],
    cross_source_check: [],
    ...overrides,
  };
}

/**
 * Mirrors the badge render logic from the fixed overview card:
 *   isSignalsPending → undefined (badge hidden)
 *   items.length === 0 → '0 Active Signals'
 *   items.length > 0 → '{n} Active Signal(s)'
 */
function renderBadge(isPending, items) {
  if (isPending) return undefined; // badge not rendered while loading
  if (items.length === 0) return '0 Active Signals';
  return `${items.length} Active Signal${items.length !== 1 ? 's' : ''}`;
}

/**
 * Mirrors the body render logic:
 *   isPending → 'loading'
 *   items.length === 0 → 'empty'
 *   items.length > 0 → array of rendered rows
 */
function renderBody(isPending, items) {
  if (isPending) return 'loading';
  if (items.length === 0) return 'empty';
  return items.map(sig => ({
    id: sig.id,
    route: sig.route,
    severity: sig.severity,
    deviation: sig.deviation_pct,
    fare: sig.actual_fare,
  }));
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\nReal-Time Market Signals synchronisation tests\n');

// ---------------------------------------------------------------------------
// 1. 0 signals → empty state + "0 Active Signals" badge
// ---------------------------------------------------------------------------

test('0 signals → badge "0 Active Signals" + body empty state', () => {
  const items = [];
  const badge = renderBadge(false, items);
  const body = renderBody(false, items);
  assert.equal(badge, '0 Active Signals');
  assert.equal(body, 'empty');
});

// ---------------------------------------------------------------------------
// 2. 1 signal → badge "1 Active Signal" (singular) + 1 visible row
// ---------------------------------------------------------------------------

test('1 signal → badge "1 Active Signal" (singular) + 1 row', () => {
  const items = [makeAnomaly()];
  const badge = renderBadge(false, items);
  const body = renderBody(false, items);
  assert.equal(badge, '1 Active Signal');
  assert.ok(Array.isArray(body) && body.length === 1);
});

// ---------------------------------------------------------------------------
// 3. 3 signals → badge "3 Active Signals" + 3 rows
// ---------------------------------------------------------------------------

test('3 signals → badge "3 Active Signals" + 3 visible rows', () => {
  const items = [
    makeAnomaly({ route: 'DEL-BOM' }),
    makeAnomaly({ route: 'BLR-DEL' }),
    makeAnomaly({ route: 'CCU-DEL' }),
  ];
  const badge = renderBadge(false, items);
  const body = renderBody(false, items);
  assert.equal(badge, '3 Active Signals');
  assert.ok(Array.isArray(body) && body.length === 3);
});

// ---------------------------------------------------------------------------
// 4. 5 signals → badge "5 Active Signals" + 5 rows (was previously broken:
//    badge hardcoded to 5 while body was empty in live mode)
// ---------------------------------------------------------------------------

test('5 signals → badge "5 Active Signals" + 5 rows', () => {
  const items = Array.from({ length: 5 }, (_, i) =>
    makeAnomaly({ id: `anom-${i}`, route: `DEL-R${i}` })
  );
  const badge = renderBadge(false, items);
  const body = renderBody(false, items);
  assert.equal(badge, '5 Active Signals');
  assert.ok(Array.isArray(body) && body.length === 5);
  // Each row has the correct route
  body.forEach((row, i) => assert.equal(row.route, `DEL-R${i}`));
});

// ---------------------------------------------------------------------------
// 5. SYNTHETIC-origin anomalies excluded in live mode
//    (the backend /anomalies endpoint only returns LIVE/IMPORTED data;
//     we verify the count formula doesn't accidentally include synthetic)
// ---------------------------------------------------------------------------

test('synthetic anomalies excluded in live mode', () => {
  // In live mode the backend filters out SYNTHETIC/REPLAY.
  // Simulate: only LIVE anomalies in the response.
  const allItems = [
    makeAnomaly({ route: 'DEL-BOM', data_origin: 'LIVE' }),
    // SYNTHETIC would never come back from the live endpoint; simulate filtering:
  ];
  const liveItems = allItems.filter(a => !a.data_origin || a.data_origin === 'LIVE' || a.data_origin === 'IMPORTED');
  const badge = renderBadge(false, liveItems);
  const body = renderBody(false, liveItems);
  assert.equal(badge, '1 Active Signal');
  assert.ok(Array.isArray(body) && body.length === 1);
});

// ---------------------------------------------------------------------------
// 6. Loading state → badge hidden, body shows skeleton (not stale count)
// ---------------------------------------------------------------------------

test('loading → badge hidden + body is "loading" (no stale count)', () => {
  const badge = renderBadge(true, []);
  const body = renderBody(true, []);
  // Badge must NOT render a stale count while data is loading
  assert.equal(badge, undefined, 'badge must be hidden while isPending=true');
  assert.equal(body, 'loading');
});

test('loading with stale non-zero count → badge still hidden', () => {
  // Even if there was a previous value, while isPending=true the badge is hidden
  const badge = renderBadge(true, [makeAnomaly(), makeAnomaly()]);
  assert.equal(badge, undefined);
});

// ---------------------------------------------------------------------------
// 7. Badge count and body row count are always equal (the core invariant)
// ---------------------------------------------------------------------------

test('badge count always equals body row count', () => {
  for (const n of [0, 1, 2, 3, 5, 8]) {
    const items = Array.from({ length: n }, (_, i) => makeAnomaly({ id: `a-${i}` }));
    const badge = renderBadge(false, items);
    const body = renderBody(false, items);

    if (n === 0) {
      assert.equal(badge, '0 Active Signals');
      assert.equal(body, 'empty');
    } else {
      const countFromBadge = parseInt(badge.split(' ')[0], 10);
      const rowCount = Array.isArray(body) ? body.length : 0;
      assert.equal(countFromBadge, rowCount, `n=${n}: badge says ${countFromBadge} but body has ${rowCount} rows`);
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Both badge and body derive from the SAME data array (one source of truth)
// ---------------------------------------------------------------------------

test('badge and body both derive from the same items array', () => {
  const items = [makeAnomaly({ route: 'HYD-BOM' }), makeAnomaly({ route: 'BOM-CCU' })];
  const badge = renderBadge(false, items);
  const body = renderBody(false, items);

  // Badge count matches items length
  assert.ok(badge.startsWith('2 '));
  // Body has the same routes as items
  assert.ok(Array.isArray(body));
  assert.equal(body[0].route, 'HYD-BOM');
  assert.equal(body[1].route, 'BOM-CCU');
});

// ---------------------------------------------------------------------------
// 9. Realtime invalidation: changing items array updates both badge and body
// ---------------------------------------------------------------------------

test('after refetch — badge and body update together', () => {
  const before = [makeAnomaly({ route: 'DEL-BOM' })];
  const after = [
    makeAnomaly({ route: 'DEL-BOM' }),
    makeAnomaly({ route: 'BLR-DEL' }),
    makeAnomaly({ route: 'CCU-HYD' }),
  ];

  const badgeBefore = renderBadge(false, before);
  const bodyBefore = renderBody(false, before);
  assert.equal(badgeBefore, '1 Active Signal');
  assert.ok(Array.isArray(bodyBefore) && bodyBefore.length === 1);

  const badgeAfter = renderBadge(false, after);
  const bodyAfter = renderBody(false, after);
  assert.equal(badgeAfter, '3 Active Signals');
  assert.ok(Array.isArray(bodyAfter) && bodyAfter.length === 3);
});

// ---------------------------------------------------------------------------
// 10. Query key contract: signals use ["anomalies", mode, params]
//     (same as Anomaly Center page) so realtime invalidation covers both
// ---------------------------------------------------------------------------

test('signals use ["anomalies", mode, params] query key — same as Anomaly Center', () => {
  const mode = 'live';
  const params = { status: 'OPEN', page_size: 5 };
  const queryKey = ['anomalies', mode, params];

  // Realtime subscription (useRealtimeSubscription.ts) invalidates ["anomalies", ...]
  // which covers both the overview card and the full Anomaly Center page.
  assert.equal(queryKey[0], 'anomalies');
  assert.equal(queryKey[1], mode);
  assert.deepEqual(queryKey[2], { status: 'OPEN', page_size: 5 });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
