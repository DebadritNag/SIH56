"""
Integration test for automatic profile creation on auth user signup.

Verifies the Supabase ``on_auth_user_created`` trigger: inserting a row into
``auth.users`` creates a matching ``public.profiles`` row with role = viewer.

This test COMMITS (the trigger fires on commit of the auth.users insert) and then
cleans up the created auth user (which cascades to the profile). It is skipped unless
the target DB has an ``auth.users`` table (i.e. a real Supabase project) and a reachable
connection.
"""
from __future__ import annotations

import uuid

import psycopg2
import pytest

from tests.conftest import _dsn, db_required

pytestmark = db_required


def _has_auth_users() -> bool:
    try:
        conn = psycopg2.connect(_dsn(), connect_timeout=5)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'"
            )
            found = cur.fetchone() is not None
        conn.close()
        return found
    except Exception:
        return False


supabase_only = pytest.mark.skipif(not _has_auth_users(), reason="auth.users not present (not a Supabase DB)")


@supabase_only
def test_profile_auto_created_with_viewer_role():
    user_id = str(uuid.uuid4())
    email = f"trigger-test-{user_id[:8]}@airpulse.test"
    conn = psycopg2.connect(_dsn())
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            # Minimal auth.users insert; Supabase columns not set here are nullable/defaulted.
            cur.execute(
                """
                INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
                VALUES (%s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                        %s, %s::jsonb, now(), now())
                """,
                (user_id, email, '{"full_name": "Trigger Test User"}'),
            )
            # Profile should now exist with default role viewer.
            cur.execute("SELECT role, full_name, active FROM public.profiles WHERE id = %s", (user_id,))
            row = cur.fetchone()
            assert row is not None, "profile row should be auto-created by trigger"
            role, full_name, active = row
            assert role == "viewer"
            assert active is True
            assert full_name == "Trigger Test User"
    finally:
        # Cleanup: deleting the auth user cascades to the profile (ON DELETE CASCADE).
        with conn.cursor() as cur:
            cur.execute("DELETE FROM auth.users WHERE id = %s", (user_id,))
        conn.close()


@supabase_only
def test_profile_role_cannot_be_escalated_via_rls_policy_definition():
    """
    The DB enforces no-self-escalation through the ``profiles_update_self_no_escalation``
    policy (WITH CHECK pinning role/active to current values). This asserts the policy
    exists with a role-preserving check clause.
    """
    conn = psycopg2.connect(_dsn())
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT with_check FROM pg_policies WHERE schemaname='public' AND tablename='profiles' "
                "AND policyname='profiles_update_self_no_escalation'"
            )
            row = cur.fetchone()
            assert row is not None
            with_check = row[0] or ""
            assert "role" in with_check and "active" in with_check
    finally:
        conn.rollback()
        conn.close()
