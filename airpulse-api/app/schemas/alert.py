from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.core.enums import AlertStatus, AlertType


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    alert_type: AlertType
    severity: str
    title: str
    message: str
    route_id: Optional[UUID]
    source_id: Optional[UUID]
    alert_metadata: Optional[Dict[str, Any]]
    status: AlertStatus
    created_at: datetime
    resolved_at: Optional[datetime]
