from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RouteBase(BaseModel):
    origin_code: str = Field(..., min_length=3, max_length=3)
    destination_code: str = Field(..., min_length=3, max_length=3)
    route_code: str
    market_code: str
    distance_km: float
    domestic: bool = True
    active: bool = True
    weight: Optional[float] = None


class RouteCreate(RouteBase):
    pass


class RouteResponse(RouteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class RouteInsights(BaseModel):
    route_code: str
    origin_code: str
    destination_code: str
    distance_km: float
    current_median_fare: float
    previous_day_change_pct: float
    previous_week_change_pct: float
    trend_30d: str  # upward, stable, downward
    booking_window_breakdown: dict
    source_coverage_count: int
    open_anomalies_count: int
    route_apix_latest: float
