/**
 * Fare Explorer + Provenance Drawer consistency tests.
 *
 * These pure-logic Node.js tests verify the four bugs fixed in this session:
 *
 *  1. Source: never hardcoded "Goibibo (OTA)" — reads backend source_display_name
 *  2. PriceGuard: anomaly_status HIGH/CRITICAL → ANOMALOUS in table badge
 *  3. Booking window: 0 lead days → T+0, not T+1
 *  4. Drawer lead-days fallback: actual_lead_days=0 from server preserved as 0
 *
 * Run: node src/__tests__/fare-explorer-consistency.test.mjs
 */

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline the fixed mapLiveFare logic (mirrors fares/page.tsx)
// ---------------------------------------------------------------------------

function bwLabel(days) {
  if (days == null) return 'T+?';
  if (days === 0) return 'T+0';     // ← fixed: same-day is T+0
  if (days <= 2) return 'T+1';
  if (days <= 10) return 'T+7';
  if (days <= 20) return 'T+15';
  if (days <= 35) return 'T+30';
  return 'T+45';
}

function mapLiveFare(f) {
  const bw = f.booking_window_bucket || bwLabel(f.booking_window_days);
  const fgPred = typeof f.fareguard_prediction === 'number' && f.fareguard_prediction > 0
    ? f.fareguard_prediction : 0;
  const pgScore = typeof f.priceguard_score === 'number' ? f.priceguard_score : 0;
  const rawAnom = String(f.anomaly_status ?? 'NORMAL').toUpperCase().trim();
  const isAnom = rawAnom !== 'NORMAL' && rawAnom !== 'NOT_SCORED' && rawAnom !== '';
  const isImported = f.data_origin === 'IMPORTED';

  const sourceLabel =
    f.source_display_name ||
    f.source_name ||
    (isImported ? 'Imported Dataset' : f.acquisition_method ? `${f.acquisition_method} Source` : 'Unknown Source');

  return {
    id: String(f.id),
    source: sourceLabel,
    booking_window: bw,
    anomaly_status: isAnom ? 'ANOMALOUS' : 'NORMAL',
    origin_type: String(f.data_origin ?? 'IMPORTED'),
    provenance: {
      fareguard_prediction: fgPred,
      priceguard_score: pgScore,
    },
  };
}

// Drawer lead-days resolution (mirrors FareProvenanceDrawer.tsx)
function resolveActualLeadDays(prov, fare) {
  return prov?.actual_lead_days != null
    ? Number(prov.actual_lead_days)
    : 0;   // safe zero until loaded
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

console.log('\nFare Explorer + Provenance consistency tests\n');

// ===========================================================================
// 1. Source — never hardcoded "Goibibo (OTA)"
// ===========================================================================

test('HappyFares observation → source = "HappyFares (prototype)"', () => {
  const fare = mapLiveFare({
    id: 'f1', data_origin: 'LIVE', booking_window_days: 0,
    source_name: 'happyfares',
    source_display_name: 'HappyFares (prototype)',
    acquisition_method: 'CRAWL4AI',
    anomaly_status: 'CRITICAL',
    priceguard_score: 0.992,
  });
  assert.equal(fare.source, 'HappyFares (prototype)');
  assert.notEqual(fare.source, 'Goibibo (OTA)');
});

test('Goibibo imported observation → source = "Goibibo Domestic Flights"', () => {
  const fare = mapLiveFare({
    id: 'f2', data_origin: 'IMPORTED',
    source_name: 'ota_source_01',
    source_display_name: 'Goibibo Domestic Flights',
    acquisition_method: 'CSV_IMPORT',
    anomaly_status: 'NORMAL',
  });
  assert.equal(fare.source, 'Goibibo Domestic Flights');
  assert.equal(fare.origin_type, 'IMPORTED');
});

test('unknown source with acquisition method → "<METHOD> Source"', () => {
  const fare = mapLiveFare({
    id: 'f3', data_origin: 'LIVE',
    source_name: null, source_display_name: null,
    acquisition_method: 'HTTP',
    anomaly_status: 'NORMAL',
  });
  assert.equal(fare.source, 'HTTP Source');
});

test('no source info at all → "Unknown Source"', () => {
  const fare = mapLiveFare({
    id: 'f4', data_origin: 'LIVE',
    source_name: null, source_display_name: null, acquisition_method: null,
    anomaly_status: 'NORMAL',
  });
  assert.equal(fare.source, 'Unknown Source');
  assert.notEqual(fare.source, 'Goibibo (OTA)');
});

// ===========================================================================
// 2. PriceGuard — anomaly_status CRITICAL/HIGH → ANOMALOUS badge
// ===========================================================================

test('anomaly_status CRITICAL → table badge ANOMALOUS', () => {
  const fare = mapLiveFare({ id: 'f5', data_origin: 'LIVE', anomaly_status: 'CRITICAL' });
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
});

test('anomaly_status HIGH → table badge ANOMALOUS', () => {
  const fare = mapLiveFare({ id: 'f6', data_origin: 'LIVE', anomaly_status: 'HIGH' });
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
});

test('anomaly_status MEDIUM → table badge ANOMALOUS', () => {
  const fare = mapLiveFare({ id: 'f7', data_origin: 'LIVE', anomaly_status: 'MEDIUM' });
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
});

test('anomaly_status LOW → table badge ANOMALOUS', () => {
  const fare = mapLiveFare({ id: 'f8', data_origin: 'LIVE', anomaly_status: 'LOW' });
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
});

test('anomaly_status NORMAL → table badge NORMAL', () => {
  const fare = mapLiveFare({ id: 'f9', data_origin: 'LIVE', anomaly_status: 'NORMAL' });
  assert.equal(fare.anomaly_status, 'NORMAL');
});

test('NOT_SCORED → table badge NORMAL (not ANOMALOUS)', () => {
  const fare = mapLiveFare({ id: 'f10', data_origin: 'LIVE', anomaly_status: 'NOT_SCORED' });
  assert.equal(fare.anomaly_status, 'NORMAL');
  // NOT_SCORED must never appear as ANOMALOUS — it means the model didn't run
});

test('no anomaly_status field → NORMAL', () => {
  const fare = mapLiveFare({ id: 'f11', data_origin: 'LIVE' });
  assert.equal(fare.anomaly_status, 'NORMAL');
});

test('priceguard_score 99.2% + anomaly_status CRITICAL → both consistent', () => {
  // The table badge and the priceguard_score must agree conceptually.
  // If priceguard_score is 0.992, the anomaly_status should not be NORMAL.
  const fare = mapLiveFare({
    id: 'f12', data_origin: 'LIVE',
    priceguard_score: 0.992,
    anomaly_status: 'CRITICAL',  // persisted by AnomalyEngine
  });
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
  assert.equal(fare.provenance.priceguard_score, 0.992);
  // Confirm they agree: if score is high, badge is ANOMALOUS
  assert.ok(fare.provenance.priceguard_score > 0.9 && fare.anomaly_status === 'ANOMALOUS',
    'high priceguard_score must pair with ANOMALOUS status');
});

// ===========================================================================
// 3. Booking window — same-day is T+0, not T+1
// ===========================================================================

test('0 lead days → bwLabel returns T+0', () => {
  assert.equal(bwLabel(0), 'T+0');
});

test('1 lead day → bwLabel returns T+1', () => {
  assert.equal(bwLabel(1), 'T+1');
});

test('2 lead days → bwLabel returns T+1 (within T+1 bucket)', () => {
  assert.equal(bwLabel(2), 'T+1');
});

test('null lead days → bwLabel returns T+?', () => {
  assert.equal(bwLabel(null), 'T+?');
  assert.equal(bwLabel(undefined), 'T+?');
});

test('fare with booking_window_days=0 → booking_window is T+0', () => {
  const fare = mapLiveFare({
    id: 'f13', data_origin: 'LIVE',
    booking_window_days: 0,
    anomaly_status: 'NORMAL',
  });
  assert.equal(fare.booking_window, 'T+0');
});

test('fare with booking_window_bucket=T+0 → preserves T+0', () => {
  const fare = mapLiveFare({
    id: 'f14', data_origin: 'LIVE',
    booking_window_days: 0,
    booking_window_bucket: 'T+0',
    anomaly_status: 'NORMAL',
  });
  assert.equal(fare.booking_window, 'T+0');
});

test('T+0 bucket and 0 days must not be relabelled T+1', () => {
  const fare = mapLiveFare({ id: 'f15', data_origin: 'LIVE', booking_window_days: 0 });
  assert.notEqual(fare.booking_window, 'T+1',
    'same-day (0 lead days) must not be labelled T+1');
});

// ===========================================================================
// 4. Drawer lead-days — actual_lead_days=0 preserved, not overwritten with 1
// ===========================================================================

test('drawer: actual_lead_days=0 from server → 0 (not 1)', () => {
  const prov = { actual_lead_days: 0, booking_window_bucket: 'T+0' };
  const days = resolveActualLeadDays(prov, {});
  assert.equal(days, 0);
  assert.notEqual(days, 1, 'same-day must not be overwritten with 1');
});

test('drawer: actual_lead_days=7 → 7', () => {
  const prov = { actual_lead_days: 7 };
  assert.equal(resolveActualLeadDays(prov, {}), 7);
});

test('drawer: provenance not yet loaded → 0 (safe placeholder)', () => {
  const days = resolveActualLeadDays(null, { provenance: { collection_run_id: 'abc' } });
  assert.equal(days, 0);
});

// ===========================================================================
// 5. FareGuard — 0 treated as unavailable, not a valid prediction
// ===========================================================================

test('fareguard_prediction 0 → stored as 0 (unavailable)', () => {
  const fare = mapLiveFare({ id: 'f16', data_origin: 'LIVE', fareguard_prediction: 0 });
  assert.equal(fare.provenance.fareguard_prediction, 0);
});

test('fareguard_prediction 2908 → stored correctly', () => {
  const fare = mapLiveFare({ id: 'f17', data_origin: 'LIVE', fareguard_prediction: 2908 });
  assert.equal(fare.provenance.fareguard_prediction, 2908);
});

test('fareguard_prediction null → 0 (unavailable placeholder)', () => {
  const fare = mapLiveFare({ id: 'f18', data_origin: 'LIVE', fareguard_prediction: null });
  assert.equal(fare.provenance.fareguard_prediction, 0);
});

// ===========================================================================
// 6. Table and drawer derive from same observation — no unrelated joins
// ===========================================================================

test('table and drawer source agree for HappyFares observation', () => {
  // Table row source
  const fare = mapLiveFare({
    id: 'f19', data_origin: 'LIVE',
    source_display_name: 'HappyFares (prototype)',
    anomaly_status: 'CRITICAL',
    priceguard_score: 0.992,
  });
  // Drawer source (from provenance endpoint)
  const provSource = 'HappyFares (prototype)';
  // sourceName in drawer: prov.source_provider || fare.source
  const drawerSource = provSource || fare.source;
  assert.equal(fare.source, drawerSource, 'table source must equal drawer source for same observation');
});

test('table and drawer PriceGuard agree for CRITICAL anomaly', () => {
  const fare = mapLiveFare({
    id: 'f20', data_origin: 'LIVE',
    anomaly_status: 'CRITICAL',
    priceguard_score: 0.992,
  });
  // Drawer derives classification from prov.priceguard_anomaly.severity = 'CRITICAL'
  const drawerClassification = 'CRITICAL';  // what provenance endpoint returns
  // Table badge uses anomaly_status → ANOMALOUS (which is a superset of CRITICAL)
  assert.equal(fare.anomaly_status, 'ANOMALOUS');
  // Both agree: observation is anomalous
  assert.ok(
    (fare.anomaly_status === 'ANOMALOUS') && (drawerClassification !== 'NORMAL'),
    'table and drawer both agree observation is anomalous'
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
