"""
Canonical Supabase-aligned SQLAlchemy 2.x ORM models for AirPulse.

These models map 1:1 to the tables created by the Supabase SQL migrations
(``airpulse_01`` .. ``airpulse_12``) and use PostgreSQL-native types:
UUID, JSONB, TIMESTAMPTZ, NUMERIC, and native ENUM.

Design notes
------------
* ``create_type=False`` on every ``ENUM`` — the enum types are owned/created by the
  migrations, never by ``metadata.create_all``. This keeps Alembic the source of truth.
* Money uses ``NUMERIC(14, 2)`` (never float) to preserve exact paise precision.
* Timestamps use ``TIMESTAMP(timezone=True)`` (TIMESTAMPTZ) and default to DB ``now()``.
* This module is intentionally separate from the legacy ``app/db/models.py`` to avoid
  breaking existing service imports during migration. New code should import from here.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db import enums as e


class Base(DeclarativeBase):
    """Declarative base for the Supabase-aligned schema."""


# ---------------------------------------------------------------------------
# Native enum column helpers (create_type=False => migrations own the types)
# ---------------------------------------------------------------------------
def pg_enum(py_enum, **kwargs) -> PGEnum:
    return PGEnum(
        py_enum,
        name=e.PG_ENUM_NAMES[py_enum],
        create_type=False,
        values_callable=lambda enum_cls: [member.value for member in enum_cls],
        **kwargs,
    )


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        default=uuid.uuid4,
    )


def _ts_default() -> Mapped[datetime]:
    return mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Identity / profiles
# ---------------------------------------------------------------------------
class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    full_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[e.AppRole] = mapped_column(pg_enum(e.AppRole), nullable=False, server_default=text("'viewer'"))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()


# ---------------------------------------------------------------------------
# Reference / catalog
# ---------------------------------------------------------------------------
class Airport(Base):
    __tablename__ = "airports"

    id: Mapped[uuid.UUID] = _uuid_pk()
    iata_code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'India'"))
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'Asia/Kolkata'"))
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_airports_iata_code", "iata_code"),
        Index("idx_airports_active", "active"),
    )


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    origin_airport_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("airports.id"))
    destination_airport_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("airports.id"))
    route_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    market_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        CheckConstraint("origin_airport_id <> destination_airport_id", name="ck_routes_distinct_airports"),
        Index("idx_routes_origin_airport", "origin_airport_id"),
        Index("idx_routes_destination_airport", "destination_airport_id"),
        Index("idx_routes_active", "active"),
        Index("idx_routes_market_code", "market_code"),
    )


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[e.SourceType] = mapped_column(pg_enum(e.SourceType), nullable=False)
    collection_method: Mapped[e.CollectionMethod] = mapped_column(pg_enum(e.CollectionMethod), nullable=False)
    base_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    supports_live_collection: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    requires_javascript: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    rate_limit_per_minute: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, server_default=text("30"))
    max_retries: Mapped[int] = mapped_column(Integer, server_default=text("3"))
    priority: Mapped[int] = mapped_column(Integer, server_default=text("100"))
    last_success_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_failure_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    reliability_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    collector_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parser_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_sources_source_type", "source_type"),
        Index("idx_sources_enabled", "enabled"),
        Index("idx_sources_active", "active"),
    )


class FareProduct(Base):
    __tablename__ = "fare_products"

    id: Mapped[uuid.UUID] = _uuid_pk()
    product_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cabin: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    baggage_allowance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refundable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    meal_included: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    seat_included: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()


# ---------------------------------------------------------------------------
# Operational runs
# ---------------------------------------------------------------------------
class CollectionRun(Base):
    __tablename__ = "collection_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    run_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[Optional[e.CollectionTriggerType]] = mapped_column(pg_enum(e.CollectionTriggerType), nullable=True)
    data_origin: Mapped[Optional[e.DataOrigin]] = mapped_column(pg_enum(e.DataOrigin), nullable=True)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    status: Mapped[e.CollectionRunStatus] = mapped_column(pg_enum(e.CollectionRunStatus), server_default=text("'QUEUED'"))
    routes_requested: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    searches_requested: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    requests_successful: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    requests_failed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_received: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_validated: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_rejected: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    duplicates_detected: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    duration_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    collector_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parser_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_collection_runs_status", "status"),
        Index("idx_collection_runs_source", "source_id"),
        Index("idx_collection_runs_started_at", text("started_at DESC")),
        Index("idx_collection_runs_trigger_type", "trigger_type"),
    )


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    collection_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("collection_runs.id"))
    pipeline_type: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    status: Mapped[e.PipelineStatus] = mapped_column(pg_enum(e.PipelineStatus), server_default=text("'QUEUED'"))
    records_input: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    records_processed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    records_failed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    steps: Mapped[list["PipelineStep"]] = relationship(
        back_populates="pipeline_run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_pipeline_runs_collection_run", "collection_run_id"),
        Index("idx_pipeline_runs_status", "status"),
        Index("idx_pipeline_runs_type", "pipeline_type"),
        Index("idx_pipeline_runs_created_at", text("created_at DESC")),
    )


class PipelineStep(Base):
    __tablename__ = "pipeline_steps"

    id: Mapped[uuid.UUID] = _uuid_pk()
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False
    )
    step_name: Mapped[str] = mapped_column(Text, nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[e.PipelineStatus] = mapped_column(pg_enum(e.PipelineStatus), server_default=text("'QUEUED'"))
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    records_input: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    records_output: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    records_failed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    duration_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    pipeline_run: Mapped["PipelineRun"] = relationship(back_populates="steps")

    __table_args__ = (
        UniqueConstraint("pipeline_run_id", "step_name", name="uq_pipeline_step_name"),
        Index("idx_pipeline_steps_run", "pipeline_run_id"),
        Index("idx_pipeline_steps_status", "status"),
        Index("idx_pipeline_steps_order", "step_order"),
    )


class ScrapingTestRun(Base):
    __tablename__ = "scraping_test_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    origin: Mapped[str] = mapped_column(Text, nullable=False)
    destination: Mapped[str] = mapped_column(Text, nullable=False)
    departure_date: Mapped[date] = mapped_column(Date, nullable=False)
    booking_window_days: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[e.DataMode] = mapped_column(pg_enum(e.DataMode), nullable=False)
    status: Mapped[e.ScrapingTestStatus] = mapped_column(pg_enum(e.ScrapingTestStatus), server_default=text("'QUEUED'"))
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    source_reachable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    request_submitted: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    response_received: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    raw_response_saved: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    raw_response_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quotes_found: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_parsed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_normalized: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_validated: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    quotes_rejected: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    database_write_verified: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    collector_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parser_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failure_stage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_scraping_test_runs_source", "source_id"),
        Index("idx_scraping_test_runs_status", "status"),
        Index("idx_scraping_test_runs_created_at", text("created_at DESC")),
    )


# ---------------------------------------------------------------------------
# Fare data
# ---------------------------------------------------------------------------
class RawFare(Base):
    __tablename__ = "raw_fares"

    id: Mapped[uuid.UUID] = _uuid_pk()
    collection_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("collection_runs.id"))
    scraping_test_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("scraping_test_runs.id"))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    request_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    data_origin: Mapped[Optional[e.DataOrigin]] = mapped_column(pg_enum(e.DataOrigin), nullable=True)
    origin_requested: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    destination_requested: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    departure_requested: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    booking_window_requested: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    collected_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    raw_storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_hash: Mapped[str] = mapped_column(Text, nullable=False)
    collector_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parser_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_raw_fares_collection_run", "collection_run_id"),
        Index("idx_raw_fares_source", "source_id"),
        Index("idx_raw_fares_collected_at", text("collected_at DESC")),
        Index("idx_raw_fares_origin_requested", "origin_requested"),
        Index("idx_raw_fares_destination_requested", "destination_requested"),
        Index("idx_raw_fares_response_hash", "response_hash"),
    )


class ValidatedFare(Base):
    __tablename__ = "validated_fares"

    id: Mapped[uuid.UUID] = _uuid_pk()
    raw_fare_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("raw_fares.id"))
    collection_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("collection_runs.id"))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    fare_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("fare_products.id"))
    data_origin: Mapped[Optional[e.DataOrigin]] = mapped_column(pg_enum(e.DataOrigin), nullable=True)
    airline: Mapped[str] = mapped_column(Text, nullable=False)
    flight_number: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origin: Mapped[str] = mapped_column(String(3), nullable=False)
    destination: Mapped[str] = mapped_column(String(3), nullable=False)
    departure_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    arrival_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    booking_window_days: Mapped[int] = mapped_column(Integer, nullable=False)
    cabin: Mapped[str] = mapped_column(Text, server_default=text("'Economy'"))
    fare_class: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refundable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    baggage_allowance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_fare: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    taxes: Mapped[float] = mapped_column(Numeric(14, 2), server_default=text("0"))
    mandatory_fees: Mapped[float] = mapped_column(Numeric(14, 2), server_default=text("0"))
    convenience_fee: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    total_fare: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    normalized_total_fare: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'INR'"))
    validation_status: Mapped[e.ValidationStatus] = mapped_column(pg_enum(e.ValidationStatus), nullable=False)
    validation_errors: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    duplicate_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    quote_hash: Mapped[str] = mapped_column(Text, nullable=False)
    collected_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        CheckConstraint("origin <> destination", name="ck_vf_distinct_od"),
        CheckConstraint("total_fare > 0", name="ck_vf_total_fare_pos"),
        CheckConstraint("base_fare >= 0", name="ck_vf_base_fare_nonneg"),
        CheckConstraint("taxes >= 0", name="ck_vf_taxes_nonneg"),
        CheckConstraint("mandatory_fees >= 0", name="ck_vf_fees_nonneg"),
        CheckConstraint("booking_window_days >= 0", name="ck_vf_bw_nonneg"),
        Index("idx_vf_route_collected", "route_id", text("collected_at DESC")),
        Index("idx_vf_source_collected", "source_id", text("collected_at DESC")),
        Index("idx_vf_od_collected", "origin", "destination", text("collected_at DESC")),
        Index("idx_vf_booking_window", "booking_window_days", text("collected_at DESC")),
        Index("idx_vf_validation_status", "validation_status"),
        Index("idx_vf_is_duplicate", "is_duplicate"),
        Index("idx_vf_quote_hash", "quote_hash"),
        Index("idx_vf_departure_at", "departure_at"),
        Index("idx_vf_data_origin", "data_origin"),
    )


class FareIndexEligibility(Base):
    __tablename__ = "fare_index_eligibility"

    id: Mapped[uuid.UUID] = _uuid_pk()
    fare_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("validated_fares.id", ondelete="CASCADE"), unique=True
    )
    eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason_code: Mapped[str] = mapped_column(Text, nullable=False)
    methodology_version: Mapped[str] = mapped_column(Text, nullable=False)
    evaluated_at: Mapped[datetime] = _ts_default()
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))


class FareFeature(Base):
    __tablename__ = "fare_features"

    id: Mapped[uuid.UUID] = _uuid_pk()
    fare_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("validated_fares.id"), unique=True)
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    booking_window_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_weekend: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_festival: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    season: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    route_recent_median: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    route_recent_mean: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    route_recent_std: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    route_volatility: Mapped[Optional[float]] = mapped_column(Numeric(10, 6), nullable=True)
    fuel_price: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    demand_proxy: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    features: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()


class FarePrediction(Base):
    __tablename__ = "fare_predictions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    fare_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("validated_fares.id"))
    model_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    predicted_fare: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    prediction_lower: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    prediction_upper: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    residual: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    residual_pct: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_predictions_fare", "fare_id"),
        Index("idx_predictions_model_version", "model_version"),
        Index("idx_predictions_created_at", text("created_at DESC")),
    )


# ---------------------------------------------------------------------------
# Anomalies / alerts
# ---------------------------------------------------------------------------
class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = _uuid_pk()
    fare_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("validated_fares.id"))
    prediction_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("fare_predictions.id"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    anomaly_score: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    anomaly_percentile: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    severity: Mapped[Optional[e.AnomalySeverity]] = mapped_column(pg_enum(e.AnomalySeverity), nullable=True)
    status: Mapped[e.AnomalyStatus] = mapped_column(pg_enum(e.AnomalyStatus), server_default=text("'OPEN'"))
    anomaly_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actual_fare: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    expected_fare: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    residual: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    residual_pct: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    evidence: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    detected_at: Mapped[datetime] = _ts_default()
    updated_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_anomalies_status", "status"),
        Index("idx_anomalies_severity", "severity"),
        Index("idx_anomalies_route", "route_id"),
        Index("idx_anomalies_detected_at", text("detected_at DESC")),
        Index("idx_anomalies_source", "source_id"),
        Index("idx_anomalies_status_detected", "status", text("detected_at DESC")),
        Index("idx_anomalies_route_detected", "route_id", text("detected_at DESC")),
    )


class ShapExplanation(Base):
    __tablename__ = "shap_explanations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    anomaly_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("anomalies.id", ondelete="CASCADE"))
    model_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_value: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    predicted_value: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    features: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = _ts_default()


class AnomalyReview(Base):
    __tablename__ = "anomaly_reviews"

    id: Mapped[uuid.UUID] = _uuid_pk()
    anomaly_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("anomalies.id"))
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    decision: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _ts_default()


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    alert_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[Optional[e.AnomalySeverity]] = mapped_column(pg_enum(e.AnomalySeverity), nullable=True)
    status: Mapped[e.AlertStatus] = mapped_column(pg_enum(e.AlertStatus), server_default=text("'OPEN'"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    anomaly_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("anomalies.id"))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    acknowledged_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_alerts_status", "status"),
        Index("idx_alerts_severity", "severity"),
        Index("idx_alerts_created_at", text("created_at DESC")),
        Index("idx_alerts_route", "route_id"),
        Index("idx_alerts_source", "source_id"),
        Index("idx_alerts_status_created", "status", text("created_at DESC")),
    )


# ---------------------------------------------------------------------------
# Index / basket
# ---------------------------------------------------------------------------
class IndexBasket(Base):
    __tablename__ = "index_baskets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    base_period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = _ts_default()
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))


class IndexBasketRoute(Base):
    __tablename__ = "index_basket_routes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    basket_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("index_baskets.id"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    booking_window_days: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(14, 10), nullable=False)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        UniqueConstraint("basket_id", "route_id", "booking_window_days", name="uq_basket_route_window"),
        Index("idx_basket_routes_basket", "basket_id"),
        Index("idx_basket_routes_route", "route_id"),
    )


class AirfareIndex(Base):
    __tablename__ = "airfare_index"

    id: Mapped[uuid.UUID] = _uuid_pk()
    index_date: Mapped[date] = mapped_column(Date, nullable=False)
    index_type: Mapped[str] = mapped_column(Text, server_default=text("'NATIONAL'"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    booking_window_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    index_value: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    daily_change_pct: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    weekly_change_pct: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    monthly_change_pct: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    coverage_quality_score: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    route_coverage_pct: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    source_coverage_pct: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    freshness_score: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    methodology_version: Mapped[str] = mapped_column(Text, nullable=False)
    basket_version: Mapped[str] = mapped_column(Text, nullable=False)
    calculated_at: Mapped[datetime] = _ts_default()
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        Index("idx_airfare_index_date", text("index_date DESC")),
        Index("idx_airfare_index_route", "route_id"),
    )


class IndexComponent(Base):
    __tablename__ = "index_components"

    id: Mapped[uuid.UUID] = _uuid_pk()
    airfare_index_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("airfare_index.id", ondelete="CASCADE"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    booking_window_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    base_price: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    current_price: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    price_relative: Mapped[Optional[float]] = mapped_column(Numeric(14, 8), nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(14, 10), nullable=True)
    weighted_contribution: Mapped[Optional[float]] = mapped_column(Numeric(14, 8), nullable=True)
    eligible_observations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        Index("idx_index_components_index", "airfare_index_id"),
        Index("idx_index_components_route", "route_id"),
    )


# ---------------------------------------------------------------------------
# Reference datasets / weights / benchmarks
# ---------------------------------------------------------------------------
class ReferenceDataset(Base):
    __tablename__ = "reference_datasets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    dataset_name: Mapped[str] = mapped_column(Text, nullable=False)
    dataset_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dataset_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_origin: Mapped[Optional[e.DataOrigin]] = mapped_column(pg_enum(e.DataOrigin), server_default=text("'REFERENCE'"))
    reference_period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reference_period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    retrieved_at: Mapped[datetime] = _ts_default()
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    row_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_ref_datasets_source_retrieved", "source_id", text("retrieved_at DESC")),
        Index("idx_ref_datasets_code", "dataset_code"),
    )


class RouteTrafficWeight(Base):
    __tablename__ = "route_traffic_weights"

    id: Mapped[uuid.UUID] = _uuid_pk()
    reference_dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("reference_datasets.id"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    passenger_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    traffic_share: Mapped[Optional[float]] = mapped_column(Numeric(14, 10), nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(14, 10), nullable=True)
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_rtw_dataset", "reference_dataset_id"),
        Index("idx_rtw_route", "route_id"),
    )


class BenchmarkFare(Base):
    __tablename__ = "benchmark_fares"

    id: Mapped[uuid.UUID] = _uuid_pk()
    reference_dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("reference_datasets.id"))
    route_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("routes.id"))
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    benchmark_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_benchmark_dataset", "reference_dataset_id"),
        Index("idx_benchmark_route", "route_id"),
    )


# ---------------------------------------------------------------------------
# Health / calendar / fuel / models / backtests / audit / imports
# ---------------------------------------------------------------------------
class SourceHealthLog(Base):
    __tablename__ = "source_health_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sources.id"))
    checked_at: Mapped[datetime] = _ts_default()
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    failure_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    average_latency_ms: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    empty_result_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    parse_error_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    route_coverage_pct: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    freshness_minutes: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    consecutive_failures: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reliability_score: Mapped[Optional[float]] = mapped_column(Numeric(8, 6), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (Index("idx_source_health_source_checked", "source_id", text("checked_at DESC")),)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = _uuid_pk()
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    event_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impact_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (Index("idx_calendar_events_date", "event_date"),)


class FuelPriceSeries(Base):
    __tablename__ = "fuel_price_series"

    id: Mapped[uuid.UUID] = _uuid_pk()
    price_date: Mapped[Optional[date]] = mapped_column(Date, unique=True, nullable=True)
    value: Mapped[Optional[float]] = mapped_column(Numeric(14, 4), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _ts_default()


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = _uuid_pk()
    model_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trained_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    training_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    training_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    feature_schema: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    artifact_storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (UniqueConstraint("model_name", "version", name="uq_model_name_version"),)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    started_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    benchmark_dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("reference_datasets.id"))
    methodology_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    basket_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fareguard_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priceguard_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _ts_default()


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = _uuid_pk()
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    before_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _ts_default()

    __table_args__ = (
        Index("idx_audit_actor", "actor_id"),
        Index("idx_audit_action", "action"),
        Index("idx_audit_created_at", text("created_at DESC")),
        Index("idx_audit_entity", "entity_type", "entity_id"),
    )


class DatasetImport(Base):
    __tablename__ = "dataset_imports"

    id: Mapped[uuid.UUID] = _uuid_pk()
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("profiles.id"))
    filename: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detected_columns: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    column_mapping: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    total_rows: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    valid_rows: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    warning_rows: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    rejected_rows: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    duplicate_rows: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    created_at: Mapped[datetime] = _ts_default()
    validated_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    committed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (Index("idx_dataset_imports_uploaded_by", "uploaded_by"),)
