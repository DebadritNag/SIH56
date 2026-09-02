from datetime import date, datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class BacktestRequest(BaseModel):
    name: str = "30-Day Airfare Inflation Backtest"
    start_date: date
    end_date: date
    benchmark_source: str = "DGCA_TRAFFIC_REFERENCE"
    methodology_version: Optional[str] = None


class BacktestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    start_date: date
    end_date: date
    benchmark_source: str
    methodology_version: str
    status: str
    metrics: Optional[Dict[str, Any]]
    created_at: datetime
    completed_at: Optional[datetime]
