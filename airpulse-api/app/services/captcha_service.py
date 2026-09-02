"""
hCaptcha verification (bot protection for auth forms).

The frontend renders the hCaptcha widget and obtains a response token. That token is sent
to this backend, which calls the hCaptcha ``siteverify`` endpoint with the BACKEND-ONLY
secret. The secret must never reach the browser.

When ``HCAPTCHA_ENABLED`` is false (or no secret configured in non-production), verification
is skipped so local development is frictionless.
"""
from __future__ import annotations

from typing import Optional

import httpx

from app.config import settings


class CaptchaResult:
    def __init__(self, success: bool, skipped: bool = False, error_codes: Optional[list] = None,
                 hostname: Optional[str] = None):
        self.success = success
        self.skipped = skipped
        self.error_codes = error_codes or []
        self.hostname = hostname


def _enforcement_on() -> bool:
    """Captcha is enforced when explicitly enabled and a secret is configured, or always
    in production when a secret is set."""
    has_secret = bool(settings.HCAPTCHA_SECRET) and "your-hcaptcha" not in settings.HCAPTCHA_SECRET
    if settings.is_production and has_secret:
        return True
    return settings.HCAPTCHA_ENABLED and has_secret


class CaptchaService:
    def __init__(self, timeout: float = 10.0):
        self._timeout = timeout

    async def verify(self, token: Optional[str], remote_ip: Optional[str] = None) -> CaptchaResult:
        """
        Verify an hCaptcha response token via siteverify.

        Returns a CaptchaResult. When enforcement is off, returns success/skipped without a
        network call. When on, a missing token fails immediately.
        """
        if not _enforcement_on():
            return CaptchaResult(success=True, skipped=True)

        if not token:
            return CaptchaResult(success=False, error_codes=["missing-input-response"])

        form = {
            "secret": settings.HCAPTCHA_SECRET,
            "response": token,
            "sitekey": settings.HCAPTCHA_SITEKEY,
        }
        if remote_ip:
            form["remoteip"] = remote_ip

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(settings.HCAPTCHA_VERIFY_URL, data=form)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # network / parse failure
            return CaptchaResult(success=False, error_codes=[f"verify-request-failed:{exc}"])

        return CaptchaResult(
            success=bool(data.get("success")),
            error_codes=data.get("error-codes", []),
            hostname=data.get("hostname"),
        )


def get_captcha_service() -> CaptchaService:
    return CaptchaService()
