"""
Alembic migration: add export_jobs table and Supabase Realtime publication.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_add_export_jobs"
down_revision: Union[str, None] = "0001_airpulse_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.export_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            requested_by VARCHAR(100),
            export_type VARCHAR(50) NOT NULL,
            export_format VARCHAR(20) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            filename VARCHAR(255) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
            progress_percent DOUBLE PRECISION,
            current_stage VARCHAR(100),
            filters JSONB,
            parameters JSONB,
            storage_bucket VARCHAR(100),
            storage_path VARCHAR(500),
            mime_type VARCHAR(100),
            file_size_bytes INTEGER,
            row_count INTEGER,
            page_count INTEGER,
            checksum_sha256 VARCHAR(64),
            data_origin VARCHAR(50) NOT NULL DEFAULT 'LIVE',
            generated_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            failed_at TIMESTAMPTZ,
            error_code VARCHAR(50),
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            job_metadata JSONB
        );

        CREATE INDEX IF NOT EXISTS ix_export_jobs_requested_by ON public.export_jobs (requested_by);
        CREATE INDEX IF NOT EXISTS ix_export_jobs_export_type ON public.export_jobs (export_type);
        CREATE INDEX IF NOT EXISTS ix_export_jobs_status ON public.export_jobs (status);
        CREATE INDEX IF NOT EXISTS ix_export_jobs_created_at ON public.export_jobs (created_at DESC);

        -- Add export_jobs to Realtime publication if publication exists
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE public.export_jobs;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.export_jobs;
            END IF;
        END $$;

        DROP TABLE IF EXISTS public.export_jobs CASCADE;
        """
    )
