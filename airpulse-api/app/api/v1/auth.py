"""
Auth-support endpoints.

AirPulse uses Supabase Auth for actual signup/login. This router provides supporting
endpoints that do NOT require an authenticated session — currently hCaptcha verification,
which the frontend can call before submitting an auth form (in addition to passing the
token to Supabase's native captcha option).
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings
from app.core.exceptions import ValidationFailedException
from app.schemas.common import APIResponse
from app.services.captcha_service import get_captcha_service

router = APIRouter(prefix="/auth", tags=["Auth"])


class CaptchaVerifyRequest(BaseModel):
    token: str


@router.get("/captcha-config", response_model=APIResponse)
async def get_captcha_config():
    """Public captcha config for the frontend (sitekey only — never the secret)."""
    return APIResponse(
        success=True,
        data={"enabled": settings.HCAPTCHA_ENABLED, "sitekey": settings.HCAPTCHA_SITEKEY},
    )


@router.post("/verify-captcha", response_model=APIResponse)
async def verify_captcha(payload: CaptchaVerifyRequest, request: Request):
    """
    Verify an hCaptcha response token via siteverify (secret stays server-side).
    Returns success or raises 422 with the hCaptcha error codes.
    """
    remote_ip = request.client.host if request.client else None
    result = await get_captcha_service().verify(payload.token, remote_ip=remote_ip)
    if not result.success:
        raise ValidationFailedException(
            "hCaptcha verification failed.",
            details=[{"code": code, "message": "captcha error"} for code in result.error_codes],
        )
    return APIResponse(
        success=True,
        data={"verified": True, "skipped": result.skipped, "hostname": result.hostname},
    )
