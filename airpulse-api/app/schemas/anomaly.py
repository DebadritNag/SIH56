from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.core.enums import AnomalySeverity, AnomalyStatus, AnomalyType, ReviewDecision


class ShapDriver(BaseModel):
    feature: str
    value: Any
    impact: float
    direction: str  # increase or decrease


class AnomalyExplanation(BaseModel):
    summary: str
    actual_fare: float
    predicted_fare: float
    residual: float
    deviation_pct: float
    anomaly_percentile: float
    drivers: List[ShapDriver] = []


class AnomalyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fare_id: Optional[UUID] = None
    prediction_id: Optional[UUID] = None
    route_id: Optional[UUID] = None
    source_id: Optional[UUID] = None
    isolation_score: Optional[float] = None
    anomaly_percentile: Optional[float] = None
    severity: AnomalySeverity
    anomaly_type: Optional[str] = None
    status: AnomalyStatus
    actual_fare: Optional[float] = None
    expected_fare: Optional[float] = None
    residual: Optional[float] = None
    residual_pct: Optional[float] = None
    explanation: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class AnomalyReviewRequest(BaseModel):
    decision: ReviewDecision
    comment: Optional[str] = None
