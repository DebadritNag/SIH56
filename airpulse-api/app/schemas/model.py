from datetime import date, datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ModelRegistryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    model_name: str
    model_type: str
    version: str
    artifact_path: str
    feature_schema: Dict[str, Any]
    training_start_date: date
    training_end_date: date
    training_rows: int
    metrics: Dict[str, Any]
    active: bool
    created_at: datetime
