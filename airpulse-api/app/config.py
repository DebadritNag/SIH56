from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Core Application
    APP_ENV: str = "development"
    APP_NAME: str = "AirPulse API"
    API_V1_PREFIX: str = "/api/v1"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Runtime environment (development | staging | production)
    ENVIRONMENT: str = "development"

    # Supabase PostgreSQL (asyncpg for async, psycopg2 for sync/migrations)
    # DATABASE_URL: direct connection (session mode) used by app + workers.
    # DATABASE_POOL_URL: transaction-pooler (pgBouncer, port 6543) connection used
    #   for high-concurrency serverless-style workloads. Falls back to DATABASE_URL.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    DATABASE_POOL_URL: str = ""
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/postgres"

    # Supabase Auth
    SUPABASE_URL: str = "https://example.supabase.co"
    SUPABASE_ANON_KEY: str = "anon-key-placeholder"
    SUPABASE_SERVICE_ROLE_KEY: str = "service-role-key-placeholder"
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-key-min-32-chars-long-placeholder"
    # Supabase project reference (subdomain). Used for realtime/storage helpers and diagnostics.
    SUPABASE_PROJECT_REF: str = ""
    # Expected JWT audience (Supabase uses "authenticated") and issuer (<url>/auth/v1).
    SUPABASE_JWT_AUD: str = "authenticated"
    SUPABASE_JWT_ISSUER: str = ""
    # When true, JWT signature/claims are strictly verified. When false (local dev only),
    # a demo bearer token is accepted. Never disable in production.
    AUTH_STRICT: bool = False

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Directories
    MODEL_DIR: str = "./models"
    FIXTURES_DIR: str = "./app/collectors/fixtures"

    # Security & CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    ALLOWED_HOSTS: Union[List[str], str] = ["*"]

    # Operational Modes & Intervals
    DEMO_MODE: bool = True
    COLLECTION_INTERVAL_HOURS: int = 3
    SOURCE_HEALTH_INTERVAL_MINUTES: int = 15

    # Statistical Index Engine
    INDEX_BASE_VALUE: float = 100.0
    INDEX_BASE_PERIOD: str = "2026-08"
    INDEX_METHODOLOGY_VERSION: str = "apix-v1.2"
    ACTIVE_BASKET_VERSION: str = "domestic-basket-2026Q3"

    # Machine Learning & Anomaly Detection
    MODEL_FAREGUARD_VERSION: str = "fareguard-xgb-v1"
    MODEL_PRICEGUARD_VERSION: str = "priceguard-if-v1"
    ANOMALY_CONTAMINATION: float = 0.04
    ANOMALY_SHAP_THRESHOLD: float = 0.75

    # Price Shock Parameters
    SHOCK_MIN_PRICE_CHANGE_PCT: float = 20.0
    SHOCK_MIN_ROBUST_ZSCORE: float = 3.0
    SHOCK_MIN_SOURCE_COUNT: int = 2
    SHOCK_MIN_QUOTE_COUNT: int = 10

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    @property
    def effective_pool_url(self) -> str:
        """Connection string for pooled access; falls back to the direct URL."""
        return self.DATABASE_POOL_URL or self.DATABASE_URL

    @property
    def jwt_issuer(self) -> str:
        """Expected Supabase JWT issuer, derived from SUPABASE_URL when not set explicitly."""
        if self.SUPABASE_JWT_ISSUER:
            return self.SUPABASE_JWT_ISSUER
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    @property
    def secrets_configured(self) -> bool:
        """True when Supabase secrets are real (loaded from .env), not shipped placeholders."""
        bad_markers = ("placeholder", "CHANGE_ME", "example.supabase.co")
        checks = (self.SUPABASE_URL, self.SUPABASE_SERVICE_ROLE_KEY, self.SUPABASE_JWT_SECRET, self.DATABASE_URL)
        return not any(marker in value for value in checks for marker in bad_markers)

    def model_post_init(self, __context) -> None:  # pydantic v2 hook
        # Fail fast in production if secrets were not provided via the environment/.env.
        if self.is_production and not self.secrets_configured:
            raise RuntimeError(
                "Supabase secrets are not configured for production. Set SUPABASE_URL, "
                "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, and DATABASE_URL in the "
                "environment (.env) with real values; placeholder/CHANGE_ME values are rejected."
            )
        # Enforce strict JWT verification in production regardless of the flag.
        if self.is_production and not self.AUTH_STRICT:
            object.__setattr__(self, "AUTH_STRICT", True)


settings = Settings()
