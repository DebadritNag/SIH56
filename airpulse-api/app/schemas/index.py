from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.core.enums import IndexFrequency, IndexScope


class IndexComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: UUID
    route_code: Optional[str] = None
    route_weight: float
    reference_fare: float
    current_fare: float
    price_relative: float
    contribution: float
    sample_count: int


class AirfareIndexResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    index_date: date
    frequency: IndexFrequency
    scope: IndexScope
    scope_id: Optional[str] = None
    index_value: float
    base_period: str
    base_value: float
    weighted_average_fare: float
    sample_count: int
    route_count: int
    source_count: int
    coverage_quality_score: Optional[float] = None
    methodology_version: str
    basket_version: str
    created_at: datetime


class IndexDetailResponse(AirfareIndexResponse):
    components: Optional[List[IndexComponentResponse]] = None


class IndexCalculationRequest(BaseModel):
    index_date: date
    frequency: IndexFrequency = IndexFrequency.DAILY
    scope: IndexScope = IndexScope.NATIONAL
    scope_id: Optional[str] = None
    basket_version: Optional[str] = None
    methodology_version: Optional[str] = None
