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
import time

import httpx
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

# --- JWKS cache for asymmetric (ES256/RS256) Supabase signing keys -----------
# Newer Supabase projects sign access tokens with rotating asymmetric keys
# (JWT Signing Keys) instead of the legacy shared HS256 secret. We fetch the
# project's public JWKS and cache it, so both signing schemes work.
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
_JWKS_TTL = 3600  # seconds


def _jwks_url() -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _get_jwks(force: bool = False) -> list:
    now = time.time()
    if not force and _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"] < _JWKS_TTL):
        return _jwks_cache["keys"]
    try:
        resp = httpx.get(_jwks_url(), timeout=10.0)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        if keys:
            _jwks_cache["keys"] = keys
            _jwks_cache["fetched_at"] = now
    except Exception:
        # Keep any previously cached keys on transient failure.
        pass
    return _jwks_cache["keys"]


def _jwk_for_kid(kid: Optional[str], force: bool = False) -> Optional[dict]:
    keys = _get_jwks(force=force)
    if not kid:
        return keys[0] if keys else None
    for k in keys:
        if k.get("kid") == kid:
            return k
    return None


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
    common_kwargs = {"options": options}
    if verify_aud:
        common_kwargs["audience"] = settings.SUPABASE_JWT_AUD
    if verify_iss:
        common_kwargs["issuer"] = settings.jwt_issuer

    # Determine the signing algorithm from the token header (Supabase issues either
    # legacy HS256 shared-secret tokens or newer ES256/RS256 asymmetric tokens).
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise UnauthorizedException(f"Malformed token header: {exc}") from exc
    alg = (header or {}).get("alg", "HS256")

    try:
        if alg == "HS256":
            payload = jwt.decode(
                token, key=settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], **common_kwargs
            )
        else:
            # Asymmetric: verify against the project's published JWKS public key.
            kid = (header or {}).get("kid")
            jwk = _jwk_for_kid(kid) or _jwk_for_kid(kid, force=True)
            if not jwk:
                raise UnauthorizedException("No matching JWKS key for token.")
            payload = jwt.decode(token, key=jwk, algorithms=[alg], **common_kwargs)
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


def _anonymous_viewer() -> AuthenticatedUser:
    """Read-only anonymous principal for public dashboards when PUBLIC_READ is enabled.
    Has viewer rank only — analyst/admin guards still reject it."""
    return AuthenticatedUser(
        user_id=uuid.UUID("00000000-0000-0000-0000-0000000000ff"),
        email=None,
        role=AppRole.VIEWER,
        full_name="Anonymous Viewer",
        active=True,
    )


def _anonymous_viewer() -> AuthenticatedUser:
    """Read-only anonymous principal (viewer rank) for public dashboards when PUBLIC_READ
    is enabled. Analyst/admin guards still reject it."""
    return AuthenticatedUser(
        user_id=uuid.UUID("00000000-0000-0000-0000-0000000000ff"),
        email=None,
        role=AppRole.VIEWER,
        full_name="Anonymous Viewer",
        active=True,
    )


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

    try:
        token = _extract_bearer(authorization)
        claims = verify_supabase_jwt(token)
        try:
            user_id = uuid.UUID(claims.sub)
        except (ValueError, TypeError) as exc:
            raise UnauthorizedException("Token 'sub' is not a valid UUID.") from exc

        profile = await _load_profile(db, user_id)
        if profile is None:
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
    except (UnauthorizedException, ForbiddenException):
        # Public read mode: allow anonymous read-only access to viewer endpoints.
        # Analyst/admin dependencies still reject the anonymous viewer.
        if settings.PUBLIC_READ:
            return _anonymous_viewer()
        raise


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
