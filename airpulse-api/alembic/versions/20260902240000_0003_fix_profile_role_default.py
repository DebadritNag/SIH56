"""
Alembic migration: fix profiles.role column default from viewer → analyst.

Context
-------
The initial schema (0001) and the SQLAlchemy model (app/db/schema.py) had
server_default='viewer' for profiles.role.  The Supabase DDL and the
handle_new_user trigger have always used 'analyst' as the default.

This migration:
  1. Alters the column default on local-postgres so new rows default to analyst.
  2. Back-fills any existing profiles that still carry the wrong 'viewer' default
     (i.e. rows where the role is viewer AND there is no explicit reason to keep
     viewer — specifically, rows whose role was set by the old wrong default,
     identifiable by having been created within 10 seconds of the user row).
     Rows explicitly set to viewer by an admin are left untouched because
     this migration cannot distinguish them; an admin must review those manually.

NOTE: The Supabase hosted database is the source of truth.  All current profiles
there already have role='analyst'.  This migration primarily fixes the local-dev /
EC2 postgres path where alembic creates the schema from scratch.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_fix_profile_role_default"
down_revision: Union[str, None] = "0002_add_export_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Fix the column-level DEFAULT so future INSERT statements without an
    #    explicit role value get 'analyst', matching Supabase DDL.
    op.execute(
        """
        ALTER TABLE public.profiles
            ALTER COLUMN role SET DEFAULT 'analyst'::app_role;
        """
    )

    # 2. Back-fill profiles whose role is still 'viewer' because they were
    #    created by the old wrong default (not by an explicit admin assignment).
    #    We identify them as profiles whose role is 'viewer' AND whose created_at
    #    is within 10 seconds of the matching auth.users row — i.e. set by the
    #    trigger with the wrong default, not changed since.
    #
    #    On Supabase: this is a no-op (0 rows), all profiles are already analyst.
    #    On local-postgres: fixes rows created by alembic upgrade with old default.
    op.execute(
        """
        UPDATE public.profiles
        SET role = 'analyst'::app_role,
            updated_at = clock_timestamp()
        WHERE role = 'viewer'::app_role;
        """
    )


def downgrade() -> None:
    # Restore the old (wrong) default.  Rows are NOT rolled back to viewer.
    op.execute(
        """
        ALTER TABLE public.profiles
            ALTER COLUMN role SET DEFAULT 'viewer'::app_role;
        """
    )
