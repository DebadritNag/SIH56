from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class APIResponse(BaseModel):
    success: bool = True
    data: Any
    meta: Optional[Dict[str, Any]] = None


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    code: str
    message: str
    severity: Optional[str] = "error"


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: List[ErrorDetail] = []


class APIErrorResponse(BaseModel):
    success: bool = False
    error: ErrorEnvelope
    request_id: str
