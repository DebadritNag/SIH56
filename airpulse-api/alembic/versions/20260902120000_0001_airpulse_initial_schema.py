"""AirPulse initial schema (enums, tables, indexes, constraints, profiles trigger,
raw immutability, RLS, realtime publication, DB functions, materialized views,
dataset_catalog view, storage buckets).

This mirrors the Supabase-applied migrations airpulse_01..airpulse_12 so any fresh
environment (local Docker PostgreSQL, CI) is provisioned identically. Alembic is the
single source of truth for schema; the hosted Supabase project was built from the same
DDL and is kept in sync.

Revision ID: 0001_airpulse_initial
Revises:
Create Date: 2026-09-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001_airpulse_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The DDL is split into logical statements applied in order. Kept as SQL to preserve
# exact parity with the hosted Supabase schema (native enums, triggers, RLS, realtime).
UPGRADE_STATEMENTS: list[str] = []


def _load_sql() -> list[str]:
    import os

    here = os.path.dirname(__file__)
    sql_path = os.path.join(here, "sql", "0001_airpulse_initial.sql")
    with open(sql_path, "r", encoding="utf-8") as fh:
        raw = fh.read()
    # Split on the sentinel used between logical migration blocks.
    return [chunk.strip() for chunk in raw.split("\n-- >>> STATEMENT SPLIT <<<\n") if chunk.strip()]


def upgrade() -> None:
    for stmt in _load_sql():
        op.execute(stmt)


def downgrade() -> None:
    # Full teardown in reverse dependency order. Drops the AirPulse public schema objects.
    op.execute(
        """
        DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_daily_summary CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS public.mv_daily_route_fares CASCADE;
        DROP VIEW IF EXISTS public.dataset_catalog CASCADE;
        DROP TABLE IF EXISTS public.dataset_imports CASCADE;
        DROP TABLE IF EXISTS public.audit_events CASCADE;
        DROP TABLE IF EXISTS public.backtest_runs CASCADE;
        DROP TABLE IF EXISTS public.model_registry CASCADE;
        DROP TABLE IF EXISTS public.fuel_price_series CASCADE;
        DROP TABLE IF EXISTS public.calendar_events CASCADE;
        DROP TABLE IF EXISTS public.source_health_logs CASCADE;
        DROP TABLE IF EXISTS public.benchmark_fares CASCADE;
        DROP TABLE IF EXISTS public.route_traffic_weights CASCADE;
        DROP TABLE IF EXISTS public.reference_datasets CASCADE;
        DROP TABLE IF EXISTS public.index_components CASCADE;
        DROP TABLE IF EXISTS public.airfare_index CASCADE;
        DROP TABLE IF EXISTS public.index_basket_routes CASCADE;
        DROP TABLE IF EXISTS public.index_baskets CASCADE;
        DROP TABLE IF EXISTS public.alerts CASCADE;
        DROP TABLE IF EXISTS public.anomaly_reviews CASCADE;
        DROP TABLE IF EXISTS public.shap_explanations CASCADE;
        DROP TABLE IF EXISTS public.anomalies CASCADE;
        DROP TABLE IF EXISTS public.fare_predictions CASCADE;
        DROP TABLE IF EXISTS public.fare_features CASCADE;
        DROP TABLE IF EXISTS public.fare_index_eligibility CASCADE;
        DROP TABLE IF EXISTS public.validated_fares CASCADE;
        DROP TABLE IF EXISTS public.raw_fares CASCADE;
        DROP TABLE IF EXISTS public.scraping_test_runs CASCADE;
        DROP TABLE IF EXISTS public.pipeline_steps CASCADE;
        DROP TABLE IF EXISTS public.pipeline_runs CASCADE;
        DROP TABLE IF EXISTS public.collection_runs CASCADE;
        DROP TABLE IF EXISTS public.fare_products CASCADE;
        DROP TABLE IF EXISTS public.sources CASCADE;
        DROP TABLE IF EXISTS public.routes CASCADE;
        DROP TABLE IF EXISTS public.airports CASCADE;
        DROP TABLE IF EXISTS public.profiles CASCADE;
        DROP FUNCTION IF EXISTS public.refresh_dashboard_views() CASCADE;
        DROP FUNCTION IF EXISTS public.get_dashboard_summary() CASCADE;
        DROP FUNCTION IF EXISTS public.get_route_daily_median(uuid, date) CASCADE;
        DROP FUNCTION IF EXISTS public.get_latest_apix() CASCADE;
        DROP FUNCTION IF EXISTS public.get_latest_source_health(uuid) CASCADE;
        DROP FUNCTION IF EXISTS public.is_analyst_or_admin() CASCADE;
        DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
        DROP FUNCTION IF EXISTS public.current_app_role() CASCADE;
        DROP FUNCTION IF EXISTS public.prevent_raw_fare_mutation() CASCADE;
        DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
        DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
        DROP TYPE IF EXISTS alert_status CASCADE;
        DROP TYPE IF EXISTS anomaly_status CASCADE;
        DROP TYPE IF EXISTS anomaly_severity CASCADE;
        DROP TYPE IF EXISTS validation_status CASCADE;
        DROP TYPE IF EXISTS data_mode CASCADE;
        DROP TYPE IF EXISTS scraping_test_status CASCADE;
        DROP TYPE IF EXISTS pipeline_status CASCADE;
        DROP TYPE IF EXISTS collection_trigger_type CASCADE;
        DROP TYPE IF EXISTS collection_run_status CASCADE;
        DROP TYPE IF EXISTS collection_method CASCADE;
        DROP TYPE IF EXISTS source_type CASCADE;
        DROP TYPE IF EXISTS data_origin CASCADE;
        DROP TYPE IF EXISTS app_role CASCADE;
        """
    )
