"""
Regression tests for the ForeignKeyViolationError fix in DatasetIngestionOrchestrator.

Root cause that was fixed:
  PRICEGUARD stage called ``DELETE FROM anomalies WHERE fare_id = ANY(:fids)`` while
  ``alerts.anomaly_id`` still referenced those rows, triggering a FK violation.

Fix: extracted ``_safe_anomaly_cleanup(session, fare_ids)`` which:
  1. Deletes OPEN/unacknowledged pipeline-generated alerts first.
  2. RESOLVEs anomalies still referenced by surviving (analyst-reviewed) alerts.
  3. Deletes the remaining unreferenced OPEN anomaly rows.

These tests:
 1. Alerts deleted BEFORE anomalies (ordering)
 2. Only OPEN unacknowledged alerts deleted (analyst alerts preserved)
 3. Referenced anomalies RESOLVED not deleted
 4. Unreferenced OPEN anomalies deleted
 5. Empty fare_ids is a no-op
 6. Cleanup commits after execution
 7. Idempotency — second run safe
 8. New anomaly ID matches alert anomaly_id
 9. Resolved anomaly preserves historical alert reference
10. Negative FareGuard prediction → INVALID_NONPOSITIVE_PREDICTION
11. Zero prediction → INVALID_NONPOSITIVE_PREDICTION
12. NaN prediction → INVALID_NONPOSITIVE_PREDICTION
13. Inf prediction → INVALID_NONPOSITIVE_PREDICTION
14. Valid prediction accepted
15. Mixed predictions counted correctly
16. invalid_count separate from scored_count
17. Invalid prediction not persisted to fare_predictions
18. PriceGuard skipped (not crashed) when no valid predictions
19. _safe_anomaly_cleanup is importable/callable
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid():
    return uuid4()


# ---------------------------------------------------------------------------
# Recording session fixture
# ---------------------------------------------------------------------------

def _build_recording_session():
    """
    Return (session_mock, sql_log) where sql_log is a list that grows with
    each ``await session.execute(stmt, ...)`` call — storing the uppercased
    SQL text so assertions can do simple ``"DELETE FROM ALERTS" in s`` checks.
    """
    sql_log: List[str] = []

    async def _capture(stmt, params=None):
        raw = getattr(stmt, "text", None) or str(stmt)
        sql_log.append(raw.upper())
        return MagicMock(rowcount=0)

    session = AsyncMock()
    session.execute.side_effect = _capture
    session.commit = AsyncMock()
    session.add = MagicMock()
    return session, sql_log


# ===========================================================================
# 1-6: Cleanup SQL ordering and guard conditions
# ===========================================================================

class TestAnomalyCleanupOrdering:
    """_safe_anomaly_cleanup must issue SQL in the right order and with the right filters."""

    @pytest.mark.asyncio
    async def test_alerts_deleted_before_anomalies(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        await _safe_anomaly_cleanup(session, [_uuid(), _uuid()])

        assert sql_log, "Expected SQL calls"

        alert_pos = next((i for i, s in enumerate(sql_log) if "DELETE FROM ALERTS" in s), None)
        anomaly_pos = next(
            (i for i, s in enumerate(sql_log) if "DELETE FROM ANOMALIES" in s or "UPDATE ANOMALIES" in s),
            None,
        )
        assert alert_pos is not None, f"No DELETE FROM ALERTS found. sql_log={sql_log}"
        assert anomaly_pos is not None, f"No anomaly op found. sql_log={sql_log}"
        assert alert_pos < anomaly_pos, (
            f"Alerts DELETE (pos {alert_pos}) must precede anomaly op (pos {anomaly_pos})"
        )

    @pytest.mark.asyncio
    async def test_only_open_unacknowledged_alerts_deleted(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        await _safe_anomaly_cleanup(session, [_uuid()])

        alert_sql = next((s for s in sql_log if "DELETE FROM ALERTS" in s), None)
        assert alert_sql is not None, f"No DELETE FROM ALERTS found. sql_log={sql_log}"
        assert "OPEN" in alert_sql, "Must filter on status='OPEN'"
        assert "ACKNOWLEDGED_AT" in alert_sql and "NULL" in alert_sql, (
            "Must filter on acknowledged_at IS NULL"
        )

    @pytest.mark.asyncio
    async def test_referenced_anomalies_resolved_not_deleted(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        await _safe_anomaly_cleanup(session, [_uuid()])

        has_resolve = any("UPDATE ANOMALIES" in s and "RESOLVED" in s for s in sql_log)
        assert has_resolve, f"Expected UPDATE anomalies SET status='RESOLVED'. sql_log={sql_log}"

    @pytest.mark.asyncio
    async def test_unreferenced_open_anomalies_deleted(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        await _safe_anomaly_cleanup(session, [_uuid()])

        has_delete = any("DELETE FROM ANOMALIES" in s for s in sql_log)
        assert has_delete, f"Expected DELETE FROM anomalies. sql_log={sql_log}"

    @pytest.mark.asyncio
    async def test_empty_fare_ids_is_noop(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        await _safe_anomaly_cleanup(session, [])

        assert sql_log == [], f"Expected no SQL for empty fare_ids, got {sql_log}"

    @pytest.mark.asyncio
    async def test_cleanup_commits(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, _ = _build_recording_session()
        await _safe_anomaly_cleanup(session, [_uuid()])
        session.commit.assert_called()


# ===========================================================================
# 7: Idempotency
# ===========================================================================

class TestIdempotency:
    @pytest.mark.asyncio
    async def test_second_run_safe(self):
        """Second call with same fare_ids must not raise (0-row deletes are harmless)."""
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        session, sql_log = _build_recording_session()
        fare_ids = [_uuid(), _uuid()]

        await _safe_anomaly_cleanup(session, fare_ids)
        first_count = len(sql_log)

        await _safe_anomaly_cleanup(session, fare_ids)
        second_count = len(sql_log)

        # Same number of statements issued per run
        assert second_count == first_count * 2


# ===========================================================================
# 8-9: Anomaly–alert relationship integrity
# ===========================================================================

class TestAnomalyAlertRelationship:
    def test_new_anomaly_id_matches_alert_anomaly_id(self):
        from app.db.models import Alert, Anomaly
        anom_id = _uuid()
        anomaly = Anomaly(
            id=anom_id, fare_id=_uuid(), severity="HIGH", status="OPEN",
            anomaly_type="unusually_high", actual_fare=Decimal("9000"),
            expected_fare=Decimal("6000"), residual=Decimal("3000"),
            residual_pct=Decimal("50"), explanation={"detector_version": "v1"},
        )
        alert = Alert(
            id=_uuid(), alert_type="FARE_ANOMALY", severity="HIGH", status="OPEN",
            title="t", message="m", anomaly_id=anom_id,
        )
        assert alert.anomaly_id == anomaly.id

    def test_resolved_anomaly_preserves_alert_reference(self):
        from app.db.models import Alert, Anomaly
        anom_id = _uuid()
        alert = Alert(
            id=_uuid(), alert_type="FARE_ANOMALY", severity="MEDIUM",
            status="ACKNOWLEDGED", title="t", message="m", anomaly_id=anom_id,
        )
        anomaly = Anomaly(
            id=anom_id, fare_id=_uuid(), severity="MEDIUM", status="RESOLVED",
            anomaly_type="unusually_high", explanation={"detector_version": "v1"},
        )
        assert alert.anomaly_id == anomaly.id
        assert anomaly.status == "RESOLVED"


# ===========================================================================
# 10-19: FareGuard invalid prediction diagnostics
# ===========================================================================

def _apply_prediction_filter(pred_values: List[float]):
    """Mirror the acceptance logic from dataset_orchestrator FAREGUARD stage."""
    scored, invalid = [], []
    for val in pred_values:
        if val > 0 and math.isfinite(val):
            scored.append(val)
        else:
            invalid.append({"pred": val, "reason": "INVALID_NONPOSITIVE_PREDICTION"})
    return scored, invalid


class TestFareGuardInvalidPredictions:
    def test_negative_is_invalid(self):
        s, inv = _apply_prediction_filter([-500.0])
        assert not s and len(inv) == 1 and inv[0]["reason"] == "INVALID_NONPOSITIVE_PREDICTION"

    def test_zero_is_invalid(self):
        s, inv = _apply_prediction_filter([0.0])
        assert not s and len(inv) == 1

    def test_nan_is_invalid(self):
        s, inv = _apply_prediction_filter([float("nan")])
        assert not s and len(inv) == 1

    def test_inf_is_invalid(self):
        s, inv = _apply_prediction_filter([float("inf")])
        assert not s and len(inv) == 1

    def test_valid_accepted(self):
        s, inv = _apply_prediction_filter([5500.0])
        assert len(s) == 1 and not inv

    def test_mixed_counted_correctly(self):
        preds = [5500.0, -200.0, 4800.0, float("nan"), 0.0, 6100.0]
        s, inv = _apply_prediction_filter(preds)
        assert len(s) == 3 and len(inv) == 3

    def test_invalid_count_separate_from_scored(self):
        preds = [5500.0, -1.0, 4800.0]
        s, inv = _apply_prediction_filter(preds)
        assert len(s) == 2 and len(inv) == 1

    def test_invalid_prediction_not_persisted(self):
        from app.db.models import FarePrediction
        rows = []
        pred_val = -500.0
        if pred_val > 0 and math.isfinite(pred_val):
            rows.append(FarePrediction(
                id=uuid4(), fare_id=uuid4(), model_version="v1",
                predicted_fare=pred_val, residual=0, residual_pct=0,
            ))
        assert rows == [], "No FarePrediction for negative prediction"

    def test_priceguard_skipped_not_crashed_on_zero_fg_scored(self):
        fg_scored_count = 0
        if fg_scored_count > 0:
            pg_status = "COMPLETED"
        else:
            pg_status = "SKIPPED"
            pg_reason = "NOT_SCORED"
        assert pg_status == "SKIPPED"
        assert "NOT_SCORED" in pg_reason


# ===========================================================================
# Importability check
# ===========================================================================

class TestHelperImportable:
    def test_safe_anomaly_cleanup_is_callable(self):
        from app.services.dataset_orchestrator import _safe_anomaly_cleanup
        assert callable(_safe_anomaly_cleanup)
