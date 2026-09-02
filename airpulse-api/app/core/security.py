"""
Compatibility shim over the real Supabase auth layer (``app/auth/supabase_jwt.py``).

Existing routers import ``UserContext``, ``get_current_user``, ``RoleChecker`` and the
``require_viewer/analyst/admin`` dependencies from here. Authentication is delegated to
``app.auth.supabase_jwt`` so there is a single source of truth that:

  * validates the Supabase JWT properly (signature/exp/aud/issuer) using ``.env`` secrets,
  * resolves the application role from the ``profiles`` table (never from the token/payload),
  * rejects inactive users.

The previous DEMO_MODE bypass and token-derived roles have been removed. Local development
convenience (a ``demo-token`` bearer) is handled inside the auth layer and is only active
when ``AUTH_STRICT`` is false and the environment is not production.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.supabase_jwt import AuthenticatedUser
from app.auth.supabase_jwt import get_current_user as _resolve_current_user
from app.core.enums import UserRole
from app.core.exceptions import ForbiddenException
from app.db.enums import AppRole
from app.db.session import get_db

# Map the DB-native AppRole (viewer/analyst/admin) to the legacy UserRole enum used by routers.
_APP_ROLE_TO_USER_ROLE = {
    AppRole.VIEWER: UserRole.VIEWER,
    AppRole.ANALYST: UserRole.ANALYST,
    AppRole.ADMIN: UserRole.ADMIN,
}
_ROLE_RANK = {UserRole.VIEWER: 1, UserRole.ANALYST: 2, UserRole.ADMIN: 3}


class UserContext(BaseModel):
    """Authenticated principal (router-facing shape). Role is resolved from the DB."""

    user_id: str
    email: Optional[str] = None
    role: UserRole = UserRole.VIEWER
    is_authenticated: bool = True


def _to_context(user: AuthenticatedUser) -> UserContext:
    return UserContext(
        user_id=str(user.user_id),
        email=user.email,
        role=_APP_ROLE_TO_USER_ROLE.get(user.role, UserRole.VIEWER),
        is_authenticated=True,
    )


async def get_current_user(
    user: AuthenticatedUser = Depends(_resolve_current_user),
) -> UserContext:
    """Validate the Supabase JWT and return the router-facing user context."""
    return _to_context(user)


class RoleChecker:
    """Dependency enforcing a minimum role (admin > analyst > viewer)."""

    def __init__(self, allowed_roles: list[UserRole]):
        # Lowest allowed role defines the minimum privilege required.
        self._minimum_rank = min((_ROLE_RANK[r] for r in allowed_roles), default=_ROLE_RANK[UserRole.VIEWER])
        self.allowed_roles = allowed_roles

    async def __call__(self, user: UserContext = Depends(get_current_user)) -> UserContext:
        if _ROLE_RANK.get(user.role, 0) < self._minimum_rank:
            raise ForbiddenException(
                f"Role '{user.role.value}' lacks permission. "
                f"Requires at least '{min(self.allowed_roles, key=lambda r: _ROLE_RANK[r]).value}'."
            )
        return user


require_viewer = RoleChecker([UserRole.VIEWER, UserRole.ANALYST, UserRole.ADMIN])
require_analyst = RoleChecker([UserRole.ANALYST, UserRole.ADMIN])
require_admin = RoleChecker([UserRole.ADMIN])
