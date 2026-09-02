import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, JSONB, UUID

# Bind to the EXISTING Postgres enum type (do not let SQLAlchemy try to CREATE it).
_DataOriginType = PGEnum(
    "LIVE", "REPLAY", "SYNTHETIC", "IMPORTED", "REFERENCE",
    name="data_origin", create_type=False,
)
_ValidationStatusType = PGEnum(
    "VALID", "WARNING", "REJECTED",
    name="validation_status", create_type=False,
)
from sqlalchemy.orm import declarative_base, relationship

from app.core.utils import utc_now

Base = declarative_base()


class Airport(Base):
    __tablename__ = "airports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    iata_code = Column(String(3), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False)
    country = Column(String(100), default="India", nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin_airport_id = Column(UUID(as_uuid=True), ForeignKey("airports.id"), nullable=True, index=True)
    destination_airport_id = Column(UUID(as_uuid=True), ForeignKey("airports.id"), nullable=True, index=True)
    route_code = Column(Text, unique=True, nullable=False, index=True)  # Directional: DEL-BOM
    market_code = Column(Text, nullable=True, index=True)  # Undirected city pair: BOM-DEL
    distance_km = Column(Float, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(150), nullable=True)
    source_type = Column(String(30), nullable=False)  # airline, ota, government_api, replay, synthetic
    base_url = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    collection_method = Column(String(50), nullable=False, default="http")
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    timeout_seconds = Column(Integer, default=15, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=1, nullable=False)
    requires_javascript = Column(Boolean, default=False, nullable=False)
    supports_live_collection = Column(Boolean, default=True, nullable=False)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)
    consecutive_failures = Column(Integer, default=0, nullable=False)
    reliability_score = Column(Float, default=1.0, nullable=False)
    collector_version = Column(String(50), default="1.0.0", nullable=False)
    parser_version = Column(String(50), default="1.0.0", nullable=False)
    source_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class CollectionRun(Base):
    __tablename__ = "collection_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    run_type = Column(String(50), default="batch_search", nullable=False)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="running")  # queued, running, completed, partial, failed
    routes_requested = Column(Integer, default=0, nullable=False)
    searches_requested = Column(Integer, default=0, nullable=False)
    requests_successful = Column(Integer, default=0, nullable=False)
    requests_failed = Column(Integer, default=0, nullable=False)
    quotes_received = Column(Integer, default=0, nullable=False)
    quotes_validated = Column(Integer, default=0, nullable=False)
    quotes_rejected = Column(Integer, default=0, nullable=False)
    duplicates_detected = Column(Integer, default=0, nullable=False)
    duration_ms = Column(Integer, nullable=True)
    collector_version = Column(String(50), nullable=False, default="1.0.0")
    parser_version = Column(String(50), nullable=False, default="1.0.0")
    trigger_type = Column(String(30), default="scheduled", nullable=False)  # scheduled, manual, replay, synthetic
    triggered_by = Column(String(100), nullable=True)
    run_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_run_id = Column(UUID(as_uuid=True), ForeignKey("collection_runs.id"), nullable=True, index=True)
    pipeline_type = Column(String(50), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="running")  # queued, running, completed, partial, failed
    records_input = Column(Integer, default=0, nullable=False)
    records_processed = Column(Integer, default=0, nullable=False)
    records_failed = Column(Integer, default=0, nullable=False)
    version = Column(String(50), nullable=False, default="1.0.0")
    error_summary = Column(JSONB, nullable=True)
    run_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    steps = relationship("PipelineStep", back_populates="pipeline_run", cascade="all, delete-orphan")


class PipelineStep(Base):
    __tablename__ = "pipeline_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_run_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id"), nullable=False, index=True)
    step_name = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed, skipped
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    records_input = Column(Integer, default=0, nullable=False)
    records_output = Column(Integer, default=0, nullable=False)
    records_failed = Column(Integer, default=0, nullable=False)
    duration_ms = Column(Integer, nullable=True)
    message = Column(String(255), nullable=True)
    step_metadata = Column(JSONB, nullable=True)

    pipeline_run = relationship("PipelineRun", back_populates="steps")


class FareProduct(Base):
    __tablename__ = "fare_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cabin = Column(String(20), default="economy", nullable=False)
    product_name = Column(String(100), nullable=False)
    baggage_allowance = Column(Float, default=15.0, nullable=False)
    refundability = Column(Boolean, default=False, nullable=False)
    meal_included = Column(Boolean, default=False, nullable=False)
    seat_included = Column(Boolean, default=False, nullable=False)
    other_features = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class RawFare(Base):
    __tablename__ = "raw_fares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_run_id = Column(UUID(as_uuid=True), ForeignKey("collection_runs.id"), nullable=True, index=True)
    scraping_test_run_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    request_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    data_origin = Column(_DataOriginType, nullable=True)
    origin_requested = Column(String(3), nullable=True)
    destination_requested = Column(String(3), nullable=True)
    departure_requested = Column(Date, nullable=True)
    booking_window_requested = Column(Integer, nullable=True)
    collected_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    http_status = Column(Integer, nullable=True)
    raw_payload = Column(JSONB, nullable=True)  # IMMUTABLE after insert
    raw_storage_path = Column(Text, nullable=True)
    response_hash = Column(Text, nullable=True)  # SHA-256
    collector_version = Column(Text, default="1.0.0", nullable=True)
    parser_version = Column(Text, default="1.0.0", nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class ValidatedFare(Base):
    __tablename__ = "validated_fares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_fare_id = Column(UUID(as_uuid=True), ForeignKey("raw_fares.id"), nullable=True, index=True)
    collection_run_id = Column(UUID(as_uuid=True), ForeignKey("collection_runs.id"), nullable=True, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True, index=True)
    fare_product_id = Column(UUID(as_uuid=True), ForeignKey("fare_products.id"), nullable=True)
    data_origin = Column(_DataOriginType, nullable=True)
    airline = Column(Text, nullable=False, index=True)
    flight_number = Column(Text, nullable=True)
    origin = Column(String(3), nullable=False, index=True)
    destination = Column(String(3), nullable=False, index=True)
    departure_at = Column(DateTime(timezone=True), nullable=False, index=True)
    arrival_at = Column(DateTime(timezone=True), nullable=True)
    booking_window_days = Column(Integer, nullable=True, index=True)
    cabin = Column(Text, default="economy", nullable=True)
    fare_class = Column(Text, nullable=True)
    refundable = Column(Boolean, default=False, nullable=True)
    baggage_allowance = Column(Text, nullable=True)
    base_fare = Column(Numeric(10, 2), nullable=True)
    taxes = Column(Numeric(10, 2), nullable=True)
    mandatory_fees = Column(Numeric(10, 2), nullable=True)
    convenience_fee = Column(Numeric(10, 2), nullable=True, default=0.0)
    total_fare = Column(Numeric(10, 2), nullable=False)
    normalized_total_fare = Column(Numeric(10, 2), nullable=False)  # base + taxes + mandatory fees
    currency = Column(String(3), default="INR", nullable=False)
    validation_status = Column(_ValidationStatusType, nullable=False, index=True)  # VALID, WARNING, REJECTED
    validation_errors = Column(JSONB, nullable=True)
    duplicate_group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    is_duplicate = Column(Boolean, default=False, nullable=False, index=True)
    quote_hash = Column(Text, unique=True, nullable=False, index=True)  # Deterministic SHA-256
    collected_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class FareIndexEligibility(Base):
    __tablename__ = "fare_index_eligibility"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fare_id = Column(UUID(as_uuid=True), ForeignKey("validated_fares.id"), nullable=False, index=True)
    eligible = Column(Boolean, default=True, nullable=False, index=True)
    reason_code = Column(String(50), nullable=False)  # VALID, DUPLICATE, REJECTED_VALIDATION, etc.
    methodology_version = Column(String(50), nullable=False)
    evaluated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class ReferenceDataset(Base):
    __tablename__ = "reference_datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    dataset_name = Column(String(255), nullable=False)
    dataset_code = Column(String(100), nullable=True, index=True)
    external_dataset_id = Column(String(200), nullable=True)
    dataset_version = Column(String(50), nullable=False)
    reference_period_start = Column(Date, nullable=True)
    reference_period_end = Column(Date, nullable=True)
    retrieved_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    source_url = Column(Text, nullable=True)
    download_url = Column(Text, nullable=True)
    api_url = Column(Text, nullable=True)
    landing_page_url = Column(Text, nullable=True)
    product_name = Column(Text, nullable=True)
    dataset_type = Column(Text, nullable=True)
    frequency = Column(Text, nullable=True)
    relevance = Column(Text, default="MEDIUM", nullable=True)
    checksum = Column(Text, nullable=False)  # SHA-256
    storage_bucket = Column(Text, default="reference-datasets", nullable=True)
    storage_path = Column(Text, nullable=True)
    file_format = Column(Text, default="json", nullable=True)  # json, csv, xlsx
    status = Column(Text, default="DISCOVERED", nullable=False)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    schema_fingerprint = Column(Text, nullable=True)
    current_version_id = Column(UUID(as_uuid=True), nullable=True)
    dataset_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=True)


class ReferenceDatasetVersion(Base):
    __tablename__ = "reference_dataset_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference_dataset_id = Column(UUID(as_uuid=True), ForeignKey("reference_datasets.id"), nullable=False, index=True)
    version_label = Column(Text, nullable=False)
    version_sequence = Column(Integer, default=1, nullable=False)
    reference_period = Column(Text, nullable=True)
    source_url = Column(Text, nullable=True)
    download_url = Column(Text, nullable=True)
    api_url = Column(Text, nullable=True)
    retrieved_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    checksum_sha256 = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    schema_fingerprint = Column(Text, nullable=True)
    storage_bucket = Column(Text, default="reference-datasets", nullable=True)
    storage_path = Column(Text, nullable=True)
    file_format = Column(Text, nullable=True)
    status = Column(Text, default="SYNCED", nullable=False)
    version_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class ReferenceSyncRun(Base):
    __tablename__ = "reference_sync_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    official_source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    reference_dataset_id = Column(UUID(as_uuid=True), ForeignKey("reference_datasets.id"), nullable=True)
    trigger_type = Column(Text, default="manual", nullable=False)
    triggered_by = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Text, default="RUNNING", nullable=False)
    datasets_discovered = Column(Integer, default=0, nullable=True)
    datasets_checked = Column(Integer, default=0, nullable=True)
    datasets_downloaded = Column(Integer, default=0, nullable=True)
    datasets_updated = Column(Integer, default=0, nullable=True)
    datasets_unchanged = Column(Integer, default=0, nullable=True)
    datasets_failed = Column(Integer, default=0, nullable=True)
    bytes_downloaded = Column(Integer, default=0, nullable=True)
    error_summary = Column(Text, nullable=True)
    run_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class RouteTrafficWeight(Base):
    __tablename__ = "route_traffic_weights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference_dataset_id = Column(UUID(as_uuid=True), ForeignKey("reference_datasets.id"), nullable=True, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False, index=True)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    passenger_count = Column(Integer, nullable=True)
    traffic_share = Column(Float, nullable=False)
    weight = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class BenchmarkFare(Base):
    __tablename__ = "benchmark_fares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference_dataset_id = Column(UUID(as_uuid=True), ForeignKey("reference_datasets.id"), nullable=True, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    benchmark_type = Column(String(50), nullable=False)  # dgca_route_avg, mospi_cpi_transport
    value = Column(Float, nullable=False)
    unit = Column(String(20), default="INR", nullable=False)
    benchmark_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=True)


class FareFeature(Base):
    __tablename__ = "fare_features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fare_id = Column(UUID(as_uuid=True), ForeignKey("validated_fares.id"), nullable=False, index=True)
    distance_km = Column(Float, nullable=False)
    booking_window_days = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    is_weekend = Column(Boolean, nullable=False)
    month = Column(Integer, nullable=False)
    season = Column(String(20), nullable=False)
    is_festival = Column(Boolean, default=False, nullable=False)
    festival_name = Column(String(100), nullable=True)
    fuel_price = Column(Float, nullable=True)
    synthetic_route_demand_score = Column(Float, nullable=True)
    route_recent_median = Column(Float, nullable=True)
    route_recent_std = Column(Float, nullable=True)
    route_recent_volatility = Column(Float, nullable=True)
    source_reliability_score = Column(Float, default=1.0, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class FarePrediction(Base):
    __tablename__ = "fare_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fare_id = Column(UUID(as_uuid=True), ForeignKey("validated_fares.id"), nullable=False, index=True)
    model_version = Column(String(50), nullable=False, index=True)
    predicted_fare = Column(Float, nullable=False)
    actual_fare = Column(Float, nullable=False)
    residual = Column(Float, nullable=False)
    residual_pct = Column(Float, nullable=False)
    prediction_lower_bound = Column(Float, nullable=True)
    prediction_upper_bound = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fare_id = Column(UUID(as_uuid=True), ForeignKey("validated_fares.id"), nullable=False, index=True)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("fare_predictions.id"), nullable=True, index=True)
    detector_version = Column(String(50), nullable=False)
    isolation_score = Column(Float, nullable=False)
    anomaly_percentile = Column(Float, nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    anomaly_type = Column(String(30), nullable=False, index=True)
    is_anomaly = Column(Boolean, default=False, nullable=False, index=True)
    status = Column(String(20), default="open", nullable=False, index=True)
    explanation = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class ShapExplanation(Base):
    __tablename__ = "shap_explanations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fare_id = Column(UUID(as_uuid=True), ForeignKey("validated_fares.id"), nullable=False, index=True)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("fare_predictions.id"), nullable=False, index=True)
    model_version = Column(String(50), nullable=False)
    base_value = Column(Float, nullable=False)
    predicted_value = Column(Float, nullable=False)
    feature_contributions = Column(JSONB, nullable=False)
    top_positive_features = Column(JSONB, nullable=False)
    top_negative_features = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class IndexBasket(Base):
    __tablename__ = "index_baskets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    version = Column(String(50), unique=True, nullable=False, index=True)
    base_period = Column(String(20), nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    weighting_method = Column(String(50), default="passenger_traffic", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class IndexBasketRoute(Base):
    __tablename__ = "index_basket_routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    basket_id = Column(UUID(as_uuid=True), ForeignKey("index_baskets.id"), nullable=False, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False, index=True)
    weight = Column(Float, nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)


class AirfareIndex(Base):
    __tablename__ = "airfare_index"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    index_date = Column(Date, nullable=False, index=True)
    frequency = Column(String(20), nullable=False, index=True)
    scope = Column(String(20), nullable=False, index=True)
    scope_id = Column(String(50), nullable=True, index=True)
    index_value = Column(Float, nullable=False)
    base_period = Column(String(20), nullable=False)
    base_value = Column(Float, default=100.0, nullable=False)
    weighted_average_fare = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False)
    route_count = Column(Integer, nullable=False)
    source_count = Column(Integer, nullable=False)
    coverage_quality_score = Column(Float, nullable=True)
    methodology_version = Column(String(50), nullable=False)
    basket_version = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class IndexComponent(Base):
    __tablename__ = "index_components"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airfare_index_id = Column(UUID(as_uuid=True), ForeignKey("airfare_index.id"), nullable=False, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False, index=True)
    route_weight = Column(Float, nullable=False)
    reference_fare = Column(Float, nullable=False)
    current_fare = Column(Float, nullable=False)
    price_relative = Column(Float, nullable=False)
    contribution = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type = Column(String(30), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True, index=True)
    alert_metadata = Column(JSONB, nullable=True)
    status = Column(String(20), default="open", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class AnomalyReview(Base):
    __tablename__ = "anomaly_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anomaly_id = Column(UUID(as_uuid=True), ForeignKey("anomalies.id"), nullable=False, index=True)
    reviewer_id = Column(String(100), nullable=True)
    decision = Column(String(30), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(100), nullable=False, index=True)
    request_id = Column(String(100), nullable=True)
    before_state = Column(JSONB, nullable=True)
    after_state = Column(JSONB, nullable=True)
    event_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)
    version = Column(String(50), unique=True, nullable=False, index=True)
    artifact_path = Column(String(500), nullable=False)
    feature_schema = Column(JSONB, nullable=False)
    training_start_date = Column(Date, nullable=False)
    training_end_date = Column(Date, nullable=False)
    training_rows = Column(Integer, nullable=False)
    metrics = Column(JSONB, nullable=False)
    active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_by = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Text, default="running", nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    benchmark_dataset_id = Column(UUID(as_uuid=True), nullable=True)
    methodology_version = Column(Text, nullable=True)
    basket_version = Column(Text, nullable=True)
    fareguard_version = Column(Text, nullable=True)
    priceguard_version = Column(Text, nullable=True)
    metrics = Column(JSONB, nullable=True)
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class SourceHealthLog(Base):
    __tablename__ = "source_health_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False, index=True)
    checked_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    success = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    records_collected = Column(Integer, default=0, nullable=False)
    error_type = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)


class FuelPriceSeries(Base):
    __tablename__ = "fuel_price_series"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, unique=True, nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(20), default="INR/kL", nullable=False)
    source = Column(String(100), default="IOCL_OFFICIAL", nullable=False)
    version = Column(String(50), default="v1.0", nullable=False)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)
    event_name = Column(String(100), nullable=False)
    event_type = Column(String(50), nullable=False)
    region = Column(String(50), default="NATIONAL", nullable=False)
    impact_level = Column(String(20), default="medium", nullable=False)
    source = Column(String(100), default="GOV_CALENDAR_2026", nullable=False)
    version = Column(String(50), default="v1.0", nullable=False)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_by = Column(String(100), nullable=True, index=True)
    export_type = Column(String(50), nullable=False, index=True)
    export_format = Column(String(20), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    status = Column(String(30), default="QUEUED", nullable=False, index=True)  # QUEUED, GENERATING, UPLOADING, READY, FAILED, EXPIRED, CANCELLED
    progress_percent = Column(Float, nullable=True)
    current_stage = Column(String(100), nullable=True)
    filters = Column(JSONB, nullable=True)
    parameters = Column(JSONB, nullable=True)
    storage_bucket = Column(String(100), nullable=True)
    storage_path = Column(String(500), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    checksum_sha256 = Column(String(64), nullable=True)
    data_origin = Column(String(50), default="LIVE", nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    job_metadata = Column(JSONB, nullable=True)
