from datetime import date, datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class BacktestRequest(BaseModel):
    name: str = "APIx vs MoSPI CPI Backtest"
    start_date: date
    end_date: date
    # Reference dataset to benchmark against (real synchronized official dataset).
    benchmark_dataset_id: Optional[UUID] = None
    benchmark_type: str = "mospi_cpi_general"
    methodology_version: Optional[str] = None


class BacktestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    benchmark_dataset_id: Optional[UUID] = None
    methodology_version: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
