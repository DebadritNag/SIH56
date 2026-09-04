from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import SourceType


class SourceBase(BaseModel):
    name: str
    display_name: Optional[str] = None
    source_type: SourceType
    base_url: Optional[str] = None
    active: bool = True
    collection_method: str = "api"
    max_requests_per_minute: int = 60
    preferred_engine: str = "AUTO"
    supported_engines: List[str] = Field(default_factory=lambda: ["SCRAPY", "PLAYWRIGHT"])
    requires_javascript: bool = False
    scrapy_enabled: bool = True
    playwright_enabled: bool = True
    last_successful_engine: Optional[str] = None
    last_attempted_engine: Optional[str] = None


class SourceCreate(SourceBase):
    pass


class SourceEngineUpdate(BaseModel):
    preferred_engine: Optional[str] = None  # AUTO, SCRAPY, PLAYWRIGHT
    requires_javascript: Optional[bool] = None
    scrapy_enabled: Optional[bool] = None
    playwright_enabled: Optional[bool] = None


class SourceResponse(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    consecutive_failures: int = 0
    reliability_score: float = 1.0
    created_at: datetime
    updated_at: datetime


class SourceHealthSummary(BaseModel):
    source_id: UUID
    source_name: str
    status: str  # healthy, degraded, failed
    reliability_score: float
    success_rate_24h: float
    avg_latency_ms: Optional[int]
    records_24h: int
    consecutive_failures: int
    last_checked_at: Optional[datetime]
