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
    fare_id: UUID
    prediction_id: Optional[UUID]
    detector_version: str
    isolation_score: float
    anomaly_percentile: float
    severity: AnomalySeverity
    anomaly_type: AnomalyType
    is_anomaly: bool
    status: AnomalyStatus
    explanation: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class AnomalyReviewRequest(BaseModel):
    decision: ReviewDecision
    comment: Optional[str] = None
