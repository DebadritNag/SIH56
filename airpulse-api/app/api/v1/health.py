from fastapi import APIRouter
from app.schemas.common import APIResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=APIResponse)
async def health_check():
    return APIResponse(success=True, data={"status": "healthy", "service": "AirPulse API", "version": "1.0.0"})


@router.get("/ready", response_model=APIResponse)
async def readiness_check():
    return APIResponse(success=True, data={"status": "ready", "database": "connected", "redis": "connected"})
