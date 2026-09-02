"""
Unit tests for the Supabase JWT verification + RBAC layer.

These do not require a database — they exercise token validation and the role hierarchy
in isolation using a locally-signed HS256 token with the configured JWT secret.
"""
from __future__ import annotations

import time
import uuid

import pytest
from jose import jwt

from app.config import settings
from app.core.exceptions import UnauthorizedException
from app.auth.supabase_jwt import (
    AuthenticatedUser,
    RequireRole,
    verify_supabase_jwt,
)
from app.db.enums import AppRole


def _make_token(**overrides) -> str:
    now = int(time.time())
    claims = {
        "sub": str(uuid.uuid4()),
        "email": "user@airpulse.gov.in",
        "aud": settings.SUPABASE_JWT_AUD,
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + 3600,
        "app_metadata": {"role": "admin"},  # deliberately claims admin; must be ignored
    }
    claims.update(overrides)
    return jwt.encode(claims, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def test_valid_token_decodes():
    token = _make_token()
    claims = verify_supabase_jwt(token)
    assert claims.sub
    assert claims.email == "user@airpulse.gov.in"
    # role_claim is captured but is NOT authoritative for authorization.
    assert claims.role_claim == "admin"


def test_expired_token_rejected():
    token = _make_token(exp=int(time.time()) - 10)
    with pytest.raises(UnauthorizedException):
        verify_supabase_jwt(token)


def test_tampered_signature_rejected():
    token = _make_token()
    tampered = token[:-3] + ("abc" if not token.endswith("abc") else "xyz")
    with pytest.raises(UnauthorizedException):
        verify_supabase_jwt(tampered)


def test_wrong_secret_rejected():
    bad = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": settings.SUPABASE_JWT_AUD, "exp": int(time.time()) + 60},
        "a-different-secret-that-is-definitely-not-right-000000",
        algorithm="HS256",
    )
    with pytest.raises(UnauthorizedException):
        verify_supabase_jwt(bad)


def test_missing_sub_rejected():
    now = int(time.time())
    token = jwt.encode(
        {"aud": settings.SUPABASE_JWT_AUD, "iss": settings.jwt_issuer, "iat": now, "exp": now + 60},
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(UnauthorizedException):
        verify_supabase_jwt(token)


# --------------------------------------------------------------------------- RBAC hierarchy
def _user(role: AppRole) -> AuthenticatedUser:
    return AuthenticatedUser(user_id=uuid.uuid4(), email="x@y.z", role=role)


def test_role_hierarchy_admin_satisfies_all():
    admin = _user(AppRole.ADMIN)
    assert admin.has_at_least(AppRole.VIEWER)
    assert admin.has_at_least(AppRole.ANALYST)
    assert admin.has_at_least(AppRole.ADMIN)


def test_role_hierarchy_viewer_is_lowest():
    viewer = _user(AppRole.VIEWER)
    assert viewer.has_at_least(AppRole.VIEWER)
    assert not viewer.has_at_least(AppRole.ANALYST)
    assert not viewer.has_at_least(AppRole.ADMIN)


def test_analyst_between():
    analyst = _user(AppRole.ANALYST)
    assert analyst.has_at_least(AppRole.VIEWER)
    assert analyst.has_at_least(AppRole.ANALYST)
    assert not analyst.has_at_least(AppRole.ADMIN)


@pytest.mark.asyncio
async def test_require_role_forbids_insufficient():
    from app.core.exceptions import ForbiddenException

    guard = RequireRole(AppRole.ADMIN)
    with pytest.raises(ForbiddenException):
        await guard(user=_user(AppRole.VIEWER))


@pytest.mark.asyncio
async def test_require_role_allows_sufficient():
    guard = RequireRole(AppRole.ANALYST)
    result = await guard(user=_user(AppRole.ADMIN))
    assert result.role == AppRole.ADMIN
