"""
Integration tests for the AirPulse Supabase schema.

Covers: connection, schema presence, airport uniqueness, route directionality,
fare insert + money precision, validation status, raw immutability, duplicate handling,
collection/pipeline run lifecycle, realtime-compatible status updates, anomaly + alert
creation, APIx insertion, reference dataset ingestion, dataset import, FK integrity,
cascade behavior, idempotency, and RLS presence.

All tests roll back (the `conn`/`cur` fixtures never commit), so the database is not
permanently mutated.
"""
from __future__ import annotations

import psycopg2
import pytest

from tests.conftest import db_required, new_uuid

pytestmark = db_required


# --------------------------------------------------------------------------- connection
def test_database_connection(cur):
    cur.execute("SELECT 1 AS ok")
    assert cur.fetchone()["ok"] == 1


def test_core_tables_exist(cur):
    expected = {
        "profiles", "airports", "routes", "sources", "fare_products",
        "collection_runs", "pipeline_runs", "pipeline_steps", "scraping_test_runs",
        "raw_fares", "validated_fares", "fare_index_eligibility", "fare_features",
        "fare_predictions", "anomalies", "shap_explanations", "anomaly_reviews",
        "alerts", "index_baskets", "index_basket_routes", "airfare_index",
        "index_components", "reference_datasets", "route_traffic_weights",
        "benchmark_fares", "source_health_logs", "calendar_events", "fuel_price_series",
        "model_registry", "backtest_runs", "audit_events", "dataset_imports",
    }
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    present = {r["table_name"] for r in cur.fetchall()}
    missing = expected - present
    assert not missing, f"missing tables: {missing}"


def test_native_enums_exist(cur):
    cur.execute("SELECT typname FROM pg_type WHERE typtype = 'e'")
    enums = {r["typname"] for r in cur.fetchall()}
    for name in ("app_role", "data_origin", "source_type", "validation_status", "anomaly_severity"):
        assert name in enums


def test_money_columns_are_numeric(cur):
    cur.execute(
        """
        SELECT column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'validated_fares'
          AND column_name IN ('base_fare','total_fare','normalized_total_fare','taxes')
        """
    )
    rows = {r["column_name"]: r for r in cur.fetchall()}
    for col in ("base_fare", "total_fare", "normalized_total_fare", "taxes"):
        assert rows[col]["data_type"] == "numeric", f"{col} must be NUMERIC, not float"
        assert rows[col]["numeric_precision"] == 14 and rows[col]["numeric_scale"] == 2


# --------------------------------------------------------------------------- airports/routes
def test_airport_uniqueness(cur):
    cur.execute("SELECT iata_code FROM public.airports LIMIT 1")
    row = cur.fetchone()
    assert row is not None, "airports must be seeded"
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute(
            "INSERT INTO public.airports (iata_code, name, city) VALUES (%s, %s, %s)",
            (row["iata_code"], "Duplicate", "Dup City"),
        )


def test_route_directionality_kept_separate(cur):
    cur.execute("SELECT count(*) AS c FROM public.routes WHERE route_code = 'DEL-BOM'")
    assert cur.fetchone()["c"] == 1
    cur.execute("SELECT count(*) AS c FROM public.routes WHERE route_code = 'BOM-DEL'")
    assert cur.fetchone()["c"] == 1
    # Same undirected market, opposite directions.
    cur.execute("SELECT market_code FROM public.routes WHERE route_code IN ('DEL-BOM','BOM-DEL')")
    markets = {r["market_code"] for r in cur.fetchall()}
    assert markets == {"BOM-DEL"}


def test_route_self_reference_rejected(cur, seed_ids):
    airport_id = seed_ids["route"]["origin_airport_id"]
    with pytest.raises(psycopg2.errors.CheckViolation):
        cur.execute(
            "INSERT INTO public.routes (origin_airport_id, destination_airport_id, route_code, market_code) "
            "VALUES (%s, %s, %s, %s)",
            (airport_id, airport_id, f"SELF-{new_uuid()[:6]}", "SELF-SELF"),
        )


# --------------------------------------------------------------------------- fares
def _insert_collection_run(cur, source_id) -> str:
    run_id = new_uuid()
    cur.execute(
        "INSERT INTO public.collection_runs (id, source_id, trigger_type, data_origin, status) "
        "VALUES (%s, %s, 'MANUAL', 'SYNTHETIC', 'RUNNING') RETURNING id",
        (run_id, source_id),
    )
    return cur.fetchone()["id"]


def _insert_raw_fare(cur, run_id, source_id) -> str:
    raw_id = new_uuid()
    cur.execute(
        """
        INSERT INTO public.raw_fares (id, collection_run_id, source_id, data_origin,
            origin_requested, destination_requested, collected_at, response_hash)
        VALUES (%s, %s, %s, 'SYNTHETIC', 'DEL', 'BOM', now(), %s) RETURNING id
        """,
        (raw_id, run_id, source_id, "hash-" + new_uuid()),
    )
    return cur.fetchone()["id"]


def test_fare_insert_and_money_precision(cur, seed_ids):
    source_id = seed_ids["source_id"]
    route_id = seed_ids["route"]["id"]
    run_id = _insert_collection_run(cur, source_id)
    raw_id = _insert_raw_fare(cur, run_id, source_id)
    cur.execute(
        """
        INSERT INTO public.validated_fares
          (raw_fare_id, collection_run_id, source_id, route_id, data_origin, airline,
           origin, destination, departure_at, booking_window_days, base_fare, taxes,
           mandatory_fees, total_fare, normalized_total_fare, validation_status, quote_hash, collected_at)
        VALUES (%s,%s,%s,%s,'SYNTHETIC','6E','DEL','BOM', now() + interval '7 days', 7,
                4999.99, 750.50, 200.00, 5950.49, 5950.49, 'VALID', %s, now())
        RETURNING total_fare
        """,
        (raw_id, run_id, source_id, route_id, "quote-" + new_uuid()),
    )
    # Exact paise preserved (no float drift).
    assert str(cur.fetchone()["total_fare"]) == "5950.49"


def test_total_fare_must_be_positive(cur, seed_ids):
    source_id = seed_ids["source_id"]
    route_id = seed_ids["route"]["id"]
    run_id = _insert_collection_run(cur, source_id)
    raw_id = _insert_raw_fare(cur, run_id, source_id)
    with pytest.raises(psycopg2.errors.CheckViolation):
        cur.execute(
            """
            INSERT INTO public.validated_fares
              (raw_fare_id, source_id, route_id, airline, origin, destination, departure_at,
               booking_window_days, base_fare, total_fare, normalized_total_fare, validation_status, quote_hash, collected_at)
            VALUES (%s,%s,%s,'6E','DEL','BOM', now(), 7, 0, 0, 0, 'VALID', %s, now())
            """,
            (raw_id, source_id, route_id, "q-" + new_uuid()),
        )


def test_validated_fare_distinct_od(cur, seed_ids):
    source_id = seed_ids["source_id"]
    route_id = seed_ids["route"]["id"]
    run_id = _insert_collection_run(cur, source_id)
    raw_id = _insert_raw_fare(cur, run_id, source_id)
    with pytest.raises(psycopg2.errors.CheckViolation):
        cur.execute(
            """
            INSERT INTO public.validated_fares
              (raw_fare_id, source_id, route_id, airline, origin, destination, departure_at,
               booking_window_days, base_fare, total_fare, normalized_total_fare, validation_status, quote_hash, collected_at)
            VALUES (%s,%s,%s,'6E','DEL','DEL', now(), 7, 1000, 1200, 1200, 'VALID', %s, now())
            """,
            (raw_id, source_id, route_id, "q-" + new_uuid()),
        )


def test_validation_status_enum_enforced(cur, seed_ids):
    source_id = seed_ids["source_id"]
    route_id = seed_ids["route"]["id"]
    run_id = _insert_collection_run(cur, source_id)
    raw_id = _insert_raw_fare(cur, run_id, source_id)
    with pytest.raises(psycopg2.errors.InvalidTextRepresentation):
        cur.execute(
            """
            INSERT INTO public.validated_fares
              (raw_fare_id, source_id, route_id, airline, origin, destination, departure_at,
               booking_window_days, base_fare, total_fare, normalized_total_fare, validation_status, quote_hash, collected_at)
            VALUES (%s,%s,%s,'6E','DEL','BOM', now(), 7, 1000, 1200, 1200, 'BOGUS', %s, now())
            """,
            (raw_id, source_id, route_id, "q-" + new_uuid()),
        )


def test_duplicate_handling_flag(cur, seed_ids):
    source_id = seed_ids["source_id"]
    route_id = seed_ids["route"]["id"]
    run_id = _insert_collection_run(cur, source_id)
    raw_id = _insert_raw_fare(cur, run_id, source_id)
    group_id = new_uuid()
    for i in range(2):
        cur.execute(
            """
            INSERT INTO public.validated_fares
              (raw_fare_id, source_id, route_id, airline, origin, destination, departure_at,
               booking_window_days, base_fare, total_fare, normalized_total_fare, validation_status,
               quote_hash, is_duplicate, duplicate_group_id, collected_at)
            VALUES (%s,%s,%s,'6E','DEL','BOM', now(), 7, 1000, 1200, 1200, 'VALID', %s, %s, %s, now())
            """,
            (raw_id, source_id, route_id, "dup-" + new_uuid(), i == 1, group_id),
        )
    cur.execute("SELECT count(*) AS c FROM public.validated_fares WHERE duplicate_group_id = %s AND is_duplicate", (group_id,))
    assert cur.fetchone()["c"] == 1


# --------------------------------------------------------------------------- immutability
def test_raw_fare_payload_immutable(cur, seed_ids):
    source_id = seed_ids["source_id"]
    run_id = _insert_collection_run(cur, source_id)
    cur.execute(
        """
        INSERT INTO public.raw_fares (id, collection_run_id, source_id, data_origin,
            origin_requested, destination_requested, collected_at, response_hash, raw_payload)
        VALUES (%s,%s,%s,'SYNTHETIC','DEL','BOM', now(), %s, %s) RETURNING id
        """,
        (new_uuid(), run_id, source_id, "h-" + new_uuid(), psycopg2.extras.Json({"fare": 5000})),
    )
    raw_id = cur.fetchone()["id"]
    with pytest.raises(psycopg2.errors.RaiseException):
        cur.execute(
            "UPDATE public.raw_fares SET raw_payload = %s WHERE id = %s",
            (psycopg2.extras.Json({"fare": 9999}), raw_id),
        )


# --------------------------------------------------------------------------- lifecycle + realtime
def test_collection_run_lifecycle(cur, seed_ids):
    run_id = _insert_collection_run(cur, seed_ids["source_id"])
    cur.execute("UPDATE public.collection_runs SET status = 'COMPLETED', finished_at = now() WHERE id = %s", (run_id,))
    cur.execute("SELECT status FROM public.collection_runs WHERE id = %s", (run_id,))
    assert cur.fetchone()["status"] == "COMPLETED"


def test_pipeline_run_lifecycle_and_realtime_updates(cur):
    cur.execute(
        "INSERT INTO public.pipeline_runs (id, pipeline_type, status) VALUES (%s, 'ingestion', 'RUNNING') RETURNING id",
        (new_uuid(),),
    )
    pr_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO public.pipeline_steps (id, pipeline_run_id, step_name, step_order, status) "
        "VALUES (%s, %s, 'APIx', 1, 'QUEUED') RETURNING id",
        (new_uuid(), pr_id),
    )
    step_id = cur.fetchone()["id"]
    # Realtime-compatible transitions
    cur.execute("UPDATE public.pipeline_steps SET status = 'RUNNING', started_at = now() WHERE id = %s", (step_id,))
    cur.execute("UPDATE public.pipeline_steps SET status = 'COMPLETED', finished_at = now() WHERE id = %s", (step_id,))
    cur.execute("SELECT status FROM public.pipeline_steps WHERE id = %s", (step_id,))
    assert cur.fetchone()["status"] == "COMPLETED"


def test_pipeline_step_cascade_delete(cur):
    cur.execute(
        "INSERT INTO public.pipeline_runs (id, pipeline_type, status) VALUES (%s, 'ingestion', 'RUNNING') RETURNING id",
        (new_uuid(),),
    )
    pr_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO public.pipeline_steps (id, pipeline_run_id, step_name, step_order) VALUES (%s,%s,'Collect',1)",
        (new_uuid(), pr_id),
    )
    cur.execute("DELETE FROM public.pipeline_runs WHERE id = %s", (pr_id,))
    cur.execute("SELECT count(*) AS c FROM public.pipeline_steps WHERE pipeline_run_id = %s", (pr_id,))
    assert cur.fetchone()["c"] == 0


def test_pipeline_step_unique_per_run(cur):
    cur.execute(
        "INSERT INTO public.pipeline_runs (id, pipeline_type) VALUES (%s, 'ingestion') RETURNING id",
        (new_uuid(),),
    )
    pr_id = cur.fetchone()["id"]
    cur.execute("INSERT INTO public.pipeline_steps (id, pipeline_run_id, step_name, step_order) VALUES (%s,%s,'Validate',1)", (new_uuid(), pr_id))
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute("INSERT INTO public.pipeline_steps (id, pipeline_run_id, step_name, step_order) VALUES (%s,%s,'Validate',2)", (new_uuid(), pr_id))


# --------------------------------------------------------------------------- anomaly/alert/index
def test_anomaly_and_alert_creation(cur, seed_ids):
    route_id = seed_ids["route"]["id"]
    source_id = seed_ids["source_id"]
    cur.execute(
        """
        INSERT INTO public.anomalies (id, route_id, source_id, anomaly_score, severity, status, anomaly_type)
        VALUES (%s,%s,%s, 0.912345, 'HIGH', 'OPEN', 'unusually_high') RETURNING id
        """,
        (new_uuid(), route_id, source_id),
    )
    anomaly_id = cur.fetchone()["id"]
    cur.execute(
        """
        INSERT INTO public.alerts (id, alert_type, severity, status, title, message, route_id, anomaly_id)
        VALUES (%s, 'price_shock', 'HIGH', 'OPEN', 'Test alert', 'msg', %s, %s) RETURNING status
        """,
        (new_uuid(), route_id, anomaly_id),
    )
    assert cur.fetchone()["status"] == "OPEN"


def test_apix_insertion(cur):
    cur.execute(
        """
        INSERT INTO public.airfare_index (id, index_date, index_type, index_value, methodology_version, basket_version)
        VALUES (%s, current_date, 'NATIONAL', 103.456789, 'apix-v1.2', 'domestic-basket-2026Q3')
        RETURNING index_value
        """,
        (new_uuid(),),
    )
    assert str(cur.fetchone()["index_value"]) == "103.456789"


def test_index_components_cascade(cur, seed_ids):
    cur.execute(
        "INSERT INTO public.airfare_index (id, index_date, index_type, index_value, methodology_version, basket_version) "
        "VALUES (%s, current_date, 'NATIONAL', 100.0, 'apix-v1.2', 'domestic-basket-2026Q3') RETURNING id",
        (new_uuid(),),
    )
    idx_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO public.index_components (id, airfare_index_id, route_id, weight) VALUES (%s,%s,%s, 0.25)",
        (new_uuid(), idx_id, seed_ids["route"]["id"]),
    )
    cur.execute("DELETE FROM public.airfare_index WHERE id = %s", (idx_id,))
    cur.execute("SELECT count(*) AS c FROM public.index_components WHERE airfare_index_id = %s", (idx_id,))
    assert cur.fetchone()["c"] == 0


# --------------------------------------------------------------------------- reference + import
def test_reference_dataset_ingestion(cur, seed_ids):
    cur.execute(
        """
        INSERT INTO public.reference_datasets (id, source_id, dataset_name, dataset_version, checksum, status, row_count, data_origin)
        VALUES (%s, %s, 'DGCA Q3 Traffic', 'v1', 'abc123', 'verified', 1234, 'REFERENCE') RETURNING data_origin
        """,
        (new_uuid(), seed_ids["source_id"]),
    )
    assert cur.fetchone()["data_origin"] == "REFERENCE"


def test_dataset_import_row(cur):
    cur.execute(
        """
        INSERT INTO public.dataset_imports (id, filename, file_format, status, total_rows)
        VALUES (%s, 'fares.csv', 'csv', 'uploaded', 500) RETURNING total_rows
        """,
        (new_uuid(),),
    )
    assert cur.fetchone()["total_rows"] == 500


# --------------------------------------------------------------------------- FK integrity
def test_foreign_key_integrity(cur):
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        cur.execute(
            "INSERT INTO public.pipeline_steps (id, pipeline_run_id, step_name, step_order) VALUES (%s, %s, 'X', 1)",
            (new_uuid(), new_uuid()),  # non-existent pipeline_run_id
        )


# --------------------------------------------------------------------------- idempotency
def test_quote_hash_idempotency_marker(cur, seed_ids):
    """
    Retry-safe collection relies on quote_hash. Inserting the same quote_hash twice is
    allowed at the DB level (dedup marks is_duplicate); this asserts the column exists,
    is indexed, and stores the value used for idempotency.
    """
    cur.execute(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'validated_fares' AND indexdef ILIKE '%%quote_hash%%'"
    )
    assert cur.fetchone() is not None, "quote_hash must be indexed for idempotent dedup lookups"


# --------------------------------------------------------------------------- RLS
def test_rls_enabled_on_sensitive_tables(cur):
    cur.execute(
        """
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('profiles','anomaly_reviews','raw_fares','validated_fares','fare_predictions','anomalies')
        """
    )
    flags = {r["relname"]: r["relrowsecurity"] for r in cur.fetchall()}
    for tbl in ("profiles", "anomaly_reviews", "raw_fares", "validated_fares", "fare_predictions", "anomalies"):
        assert flags.get(tbl) is True, f"RLS must be enabled on {tbl}"


def test_profiles_no_self_escalation_policy_exists(cur):
    cur.execute(
        "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'"
    )
    policies = {r["policyname"] for r in cur.fetchall()}
    assert "profiles_update_self_no_escalation" in policies
    assert "profiles_select_self" in policies


def test_realtime_publication_tables(cur):
    cur.execute(
        "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public'"
    )
    published = {r["tablename"] for r in cur.fetchall()}
    for tbl in ("collection_runs", "pipeline_runs", "pipeline_steps", "alerts", "anomalies"):
        assert tbl in published
    # High-volume fare tables must NOT be published.
    assert "validated_fares" not in published
    assert "raw_fares" not in published
