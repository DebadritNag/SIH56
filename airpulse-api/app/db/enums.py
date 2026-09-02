"""
Database-native enum definitions for AirPulse.

These mirror the PostgreSQL ENUM types created in the Supabase migrations
(``airpulse_01_enums_and_profiles`` onward). Values are UPPERCASE to match the
labels stored in the database exactly. Use these when mapping SQLAlchemy columns
to native ``postgresql.ENUM`` types so Python <-> Postgres round-trips are exact.

NOTE: ``app/core/enums.py`` contains an older set of lowercase business enums used
by the discrete Python services. This module is the canonical mapping for the
Supabase-hosted schema and must stay in sync with the applied migrations.
"""
from __future__ import annotations

from enum import Enum


class AppRole(str, Enum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    ADMIN = "admin"


class DataOrigin(str, Enum):
    LIVE = "LIVE"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"
    IMPORTED = "IMPORTED"
    REFERENCE = "REFERENCE"


class SourceType(str, Enum):
    AIRLINE = "AIRLINE"
    OTA = "OTA"
    GOVERNMENT_API = "GOVERNMENT_API"
    GOVERNMENT_FILE = "GOVERNMENT_FILE"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"


class CollectionMethod(str, Enum):
    HTTP = "HTTP"
    PLAYWRIGHT = "PLAYWRIGHT"
    SCRAPY = "SCRAPY"
    API = "API"
    FILE = "FILE"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"


class CollectionRunStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CollectionTriggerType(str, Enum):
    SCHEDULED = "SCHEDULED"
    MANUAL = "MANUAL"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"
    REFERENCE_SYNC = "REFERENCE_SYNC"
    SCRAPING_TEST = "SCRAPING_TEST"


class PipelineStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ScrapingTestStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class DataMode(str, Enum):
    LIVE = "LIVE"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"


class ValidationStatus(str, Enum):
    VALID = "VALID"
    WARNING = "WARNING"
    REJECTED = "REJECTED"


class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnomalyStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"
    RESOLVED = "RESOLVED"


class AlertStatus(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


# Mapping of Python enum -> Postgres type name. Used by Alembic and model definitions
# so create_type is never duplicated across tables (native_enum with create_type=False).
PG_ENUM_NAMES = {
    AppRole: "app_role",
    DataOrigin: "data_origin",
    SourceType: "source_type",
    CollectionMethod: "collection_method",
    CollectionRunStatus: "collection_run_status",
    CollectionTriggerType: "collection_trigger_type",
    PipelineStatus: "pipeline_status",
    ScrapingTestStatus: "scraping_test_status",
    DataMode: "data_mode",
    ValidationStatus: "validation_status",
    AnomalySeverity: "anomaly_severity",
    AnomalyStatus: "anomaly_status",
    AlertStatus: "alert_status",
}
