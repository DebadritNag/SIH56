from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import SourceType


class SourceBase(BaseModel):
    name: str
    source_type: SourceType
    base_url: Optional[str] = None
    active: bool = True
    collection_method: str = "api"
    max_requests_per_minute: int = 60


class SourceCreate(SourceBase):
    pass


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
