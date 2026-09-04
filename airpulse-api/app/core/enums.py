from enum import Enum


class CIEnum(str, Enum):
    """String enum that resolves values case-insensitively.

    The live database stores enum values in UPPERCASE (e.g. "AIRLINE", "OTA",
    "OPEN") while the Python members use lowercase values. This makes
    SourceType("AIRLINE") resolve to SourceType.AIRLINE instead of raising.
    """

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            lowered = value.lower()
            for member in cls:
                if member.value.lower() == lowered:
                    return member
        return None


class SourceType(CIEnum):
    AIRLINE = "airline"
    OTA = "ota"
    GOVERNMENT_API = "government_api"
    GOVERNMENT_FILE = "government_file"
    REPLAY = "replay"
    SYNTHETIC = "synthetic"


class CollectionMethod(CIEnum):
    HTTP = "http"
    PLAYWRIGHT = "playwright"
    SCRAPY = "scrapy"
    API = "api"
    FILE = "file"
    REPLAY = "replay"
    SYNTHETIC = "synthetic"


class CollectionRunStatus(CIEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TriggerType(CIEnum):
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    REPLAY = "replay"
    SYNTHETIC = "synthetic"
    REFERENCE_SYNC = "reference_sync"


class PipelineType(CIEnum):
    COLLECTION = "collection"
    NORMALIZATION = "normalization"
    VALIDATION = "validation"
    DEDUPLICATION = "deduplication"
    FEATURE_GENERATION = "feature_generation"
    ML_INFERENCE = "ml_inference"
    ANOMALY_DETECTION = "anomaly_detection"
    SHAP_GENERATION = "shap_generation"
    INDEX_GENERATION = "index_generation"
    REFERENCE_SYNC = "reference_sync"
    BACKTEST = "backtest"


class PipelineStatus(CIEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


class StepStatus(CIEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ValidationStatus(CIEnum):
    VALID = "valid"
    WARNING = "warning"
    REJECTED = "rejected"


class EligibilityReason(CIEnum):
    VALID = "VALID"
    DUPLICATE = "DUPLICATE"
    REJECTED_VALIDATION = "REJECTED_VALIDATION"
    OUTSIDE_BOOKING_WINDOW = "OUTSIDE_BOOKING_WINDOW"
    UNSUPPORTED_PRODUCT = "UNSUPPORTED_PRODUCT"
    SOURCE_EXCLUDED = "SOURCE_EXCLUDED"
    INSUFFICIENT_PRODUCT_MATCH = "INSUFFICIENT_PRODUCT_MATCH"
    MISSING_COMPONENTS = "MISSING_COMPONENTS"


class AnomalySeverity(CIEnum):
    NORMAL = "normal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyType(CIEnum):
    UNUSUALLY_HIGH = "unusually_high"
    UNUSUALLY_LOW = "unusually_low"
    DATA_QUALITY = "data_quality"
    POSSIBLE_PRICE_SHOCK = "possible_price_shock"
    UNKNOWN = "unknown"


class AnomalyStatus(CIEnum):
    OPEN = "open"
    REVIEWED = "reviewed"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


class ReviewDecision(CIEnum):
    CONFIRM = "confirm"
    DISMISS = "dismiss"
    DATA_ERROR = "data_error"
    GENUINE_PRICE_SHOCK = "genuine_price_shock"
    REQUIRES_FOLLOWUP = "requires_followup"


class AlertType(CIEnum):
    PRICE_SHOCK = "price_shock"
    SOURCE_FAILURE = "source_failure"
    DATA_QUALITY = "data_quality"
    ANOMALY_CLUSTER = "anomaly_cluster"
    INSUFFICIENT_COVERAGE = "insufficient_coverage"


class AlertStatus(CIEnum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class IndexFrequency(CIEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class IndexScope(CIEnum):
    NATIONAL = "national"
    ROUTE = "route"
    AIRLINE = "airline"


class UserRole(CIEnum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    ADMIN = "admin"


class CabinClass(CIEnum):
    ECONOMY = "economy"
    PREMIUM_ECONOMY = "premium_economy"
    BUSINESS = "business"
    FIRST = "first"


class ScrapeFailureStage(CIEnum):
    """Precise failure stages for live scraping, per BRAIN.md Live Scraping Test Protocol.
    A live scraper test must log the exact stage at which collection failed and never
    silently fall back to a replay/synthetic collector."""

    DNS_FAILURE = "DNS_FAILURE"
    CONNECTION_FAILURE = "CONNECTION_FAILURE"
    TIMEOUT = "TIMEOUT"
    HTTP_ERROR = "HTTP_ERROR"
    BLOCKED = "BLOCKED"
    CAPTCHA_DETECTED = "CAPTCHA_DETECTED"
    RATE_LIMITED = "RATE_LIMITED"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    CHALLENGE_DETECTED = "CHALLENGE_DETECTED"
    POLICY_RESTRICTED = "POLICY_RESTRICTED"
    EMPTY_RESPONSE = "EMPTY_RESPONSE"
    SELECTOR_NOT_FOUND = "SELECTOR_NOT_FOUND"
    PARSE_ERROR = "PARSE_ERROR"
    NO_AVAILABILITY = "NO_AVAILABILITY"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    BROWSER_LAUNCH_FAILURE = "BROWSER_LAUNCH_FAILURE"
    NOT_CONFIGURED = "NOT_CONFIGURED"


class SourceHealthStatus(CIEnum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    BLOCKED = "BLOCKED"
    CAPTCHA = "CAPTCHA"
    RATE_LIMITED = "RATE_LIMITED"
    UNAVAILABLE = "UNAVAILABLE"
    DISABLED = "DISABLED"


class PolicyStatus(CIEnum):
    ALLOWED = "ALLOWED"
    RESTRICTED = "RESTRICTED"
    UNKNOWN = "UNKNOWN"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"

