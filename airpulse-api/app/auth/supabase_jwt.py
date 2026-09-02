"""
Supabase JWT validation and role-based access control for FastAPI.

Flow
----
1. The Next.js frontend authenticates with Supabase Auth (email/password, magic link,
   or OAuth later) and obtains an access token (JWT).
2. The frontend calls FastAPI with ``Authorization: Bearer <JWT>``.
3. FastAPI validates the JWT signature (HS256 using ``SUPABASE_JWT_SECRET``), issuer,
   expiration, and audience.
4. The application role (viewer/analyst/admin) is resolved authoritatively from the
   ``profiles`` table in the database — NEVER trusted from the token/request payload.

Security principles enforced here
---------------------------------
* Role is read from ``profiles`` (DB is the source of truth); token role claims are
  ignored for authorization decisions.
* Inactive profiles (``active = false``) are rejected.
* In non-production and when ``AUTH_STRICT`` is false, a ``demo-token`` bearer maps to a
  demo analyst so the local stack works without a live Supabase session. Strict
  verification is always used in production.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, Header
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.db.enums import AppRole
from app.db.schema import Profile
from app.db.session import get_db

# Role hierarchy for permission checks (higher number => more privilege).
_ROLE_RANK = {AppRole.VIEWER: 1, AppRole.ANALYST: 2, AppRole.ADMIN: 3}


class AuthenticatedUser(BaseModel):
    """Authenticated principal resolved from a Supabase JWT + profiles row."""

    user_id: uuid.UUID
    email: Optional[str] = None
    role: AppRole = AppRole.VIEWER
    full_name: Optional[str] = None
    organization: Optional[str] = None
    active: bool = True

    def has_at_least(self, required: AppRole) -> bool:
        return _ROLE_RANK[self.role] >= _ROLE_RANK[required]


class SupabaseTokenClaims(BaseModel):
    """Validated claims extracted from a Supabase access token."""

    sub: str
    email: Optional[str] = None
    aud: Optional[str] = None
    role_claim: Optional[str] = None


def _extract_bearer(authorization: Optional[str]) -> str:
    if not authorization:
        raise UnauthorizedException("Authorization Bearer header missing.")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise UnauthorizedException("Invalid Authorization header. Expected 'Bearer <token>'.")
    return parts[1].strip()


def verify_supabase_jwt(token: str) -> SupabaseTokenClaims:
    """
    Verify a Supabase access token's signature and standard claims.

    Validates:
      * signature (HS256 via SUPABASE_JWT_SECRET)
      * expiration (``exp``) and not-before (``nbf``/``iat``) — handled by jose
      * audience (``aud`` == SUPABASE_JWT_AUD) when configured
      * issuer (``iss``) when configured

    Raises ``UnauthorizedException`` on any failure. Does NOT resolve role — that is
    always done from the database.
    """
    verify_aud = bool(settings.SUPABASE_JWT_AUD)
    verify_iss = bool(settings.jwt_issuer)
    options = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_aud": verify_aud,
    }
    decode_kwargs = {
        "key": settings.SUPABASE_JWT_SECRET,
        "algorithms": ["HS256"],
        "options": options,
    }
    if verify_aud:
        decode_kwargs["audience"] = settings.SUPABASE_JWT_AUD
    if verify_iss:
        decode_kwargs["issuer"] = settings.jwt_issuer

    try:
        payload = jwt.decode(token, **decode_kwargs)
    except JWTError as exc:
        raise UnauthorizedException(f"Invalid or expired Supabase token: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedException("Token missing 'sub' (user id) claim.")

    # app_metadata.role is informational only; authorization uses the DB role.
    app_metadata = payload.get("app_metadata") or {}
    user_metadata = payload.get("user_metadata") or {}
    role_claim = app_metadata.get("role") or user_metadata.get("role")

    return SupabaseTokenClaims(
        sub=sub,
        email=payload.get("email"),
        aud=payload.get("aud"),
        role_claim=role_claim,
    )


async def _load_profile(db: AsyncSession, user_id: uuid.UUID) -> Optional[Profile]:
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


def _demo_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id=uuid.UUID("00000000-0000-0000-0000-0000000000aa"),
        email="analyst@airpulse.local",
        role=AppRole.ANALYST,
        full_name="Demo Analyst",
        active=True,
    )


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    """
    FastAPI dependency: require a valid Supabase JWT and return the authenticated user
    with its role resolved from the ``profiles`` table.
    """
    # Local-dev convenience: accept a demo token only when strict auth is disabled
    # and we are not in production.
    if not settings.AUTH_STRICT and not settings.is_production:
        if authorization and authorization.split(" ", 1)[-1].strip() == "demo-token":
            return _demo_user()

    token = _extract_bearer(authorization)
    claims = verify_supabase_jwt(token)

    try:
        user_id = uuid.UUID(claims.sub)
    except (ValueError, TypeError) as exc:
        raise UnauthorizedException("Token 'sub' is not a valid UUID.") from exc

    profile = await _load_profile(db, user_id)
    if profile is None:
        # The auth trigger creates a profile row on signup; a missing row means the
        # user is not provisioned in this system.
        raise UnauthorizedException("No profile found for authenticated user.")
    if not profile.active:
        raise ForbiddenException("User profile is inactive.")

    return AuthenticatedUser(
        user_id=profile.id,
        email=claims.email,
        role=profile.role,
        full_name=profile.full_name,
        organization=profile.organization,
        active=profile.active,
    )


async def get_optional_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthenticatedUser]:
    """Like ``get_current_user`` but returns ``None`` instead of raising when unauthenticated."""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization=authorization, db=db)
    except (UnauthorizedException, ForbiddenException):
        return None


class RequireRole:
    """
    FastAPI dependency factory enforcing a minimum role.

    Roles are hierarchical: admin > analyst > viewer. A dependency requiring
    ``analyst`` is satisfied by analysts and admins.
    """

    def __init__(self, minimum: AppRole):
        self.minimum = minimum

    async def __call__(
        self, user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if not user.has_at_least(self.minimum):
            raise ForbiddenException(
                f"Role '{user.role.value}' lacks permission. Requires at least '{self.minimum.value}'."
            )
        return user


require_viewer = RequireRole(AppRole.VIEWER)
require_analyst = RequireRole(AppRole.ANALYST)
require_admin = RequireRole(AppRole.ADMIN)
