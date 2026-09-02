import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.schemas.export import CreateExportRequest, ExportDownloadResponse, ExportJobResponse
from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["Export & Download Subsystem"])


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_export(
    payload: CreateExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """
    Creates and initiates an institutional export.
    Generates authentic CSV, XLSX, PDF, PNG, or ZIP datasets from live database records.
    """
    service = ExportService(db)
    job = await service.create_export_job(payload, user_id=current_user.user_id)
    return APIResponse(
        success=True,
        data=ExportJobResponse.model_validate(job),
        meta={"export_job_id": str(job.id), "status": job.status},
    )


@router.get("", response_model=PaginatedResponse[ExportJobResponse])
async def list_exports(
    export_type: Optional[str] = Query(None, description="Filter by ExportType"),
    status: Optional[str] = Query(None, description="Filter by ExportStatus"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Lists export jobs visible to the current authenticated user."""
    service = ExportService(db)
    items, total = await service.list_jobs(
        user_id=current_user.user_id,
        export_type=export_type,
        status=status,
        limit=pagination.page_size,
        offset=pagination.offset,
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[ExportJobResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{job_id}", response_model=APIResponse)
async def get_export_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Retrieves metadata and generation status for a specific export."""
    service = ExportService(db)
    job = await service.get_job(job_id)
    return APIResponse(success=True, data=ExportJobResponse.model_validate(job))


@router.get("/{job_id}/download", response_model=APIResponse)
async def download_export(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """
    Returns short-lived signed URL or secure redirect for authorized download.
    Never exposes permanent public bucket URLs.
    """
    service = ExportService(db)
    job = await service.get_job(job_id)
    signed_url, expires_at = await service.get_download_url(job)

    return APIResponse(
        success=True,
        data=ExportDownloadResponse(
            download_url=signed_url,
            filename=job.filename,
            mime_type=job.mime_type or "application/octet-stream",
            file_size_bytes=job.file_size_bytes,
            checksum_sha256=job.checksum_sha256,
            expires_at=expires_at,
        ),
    )


@router.get("/{job_id}/stream")
async def stream_export_file(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Streams the local file directly if local fallback was used."""
    service = ExportService(db)
    job = await service.get_job(job_id)

    # Check local fallback scratch
    local_path = os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "exports", job.filename)
    if os.path.exists(local_path):
        return FileResponse(
            path=local_path,
            filename=job.filename,
            media_type=job.mime_type or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{job.filename}"'},
        )

    # Otherwise fetch from storage
    content = await service.storage.download(job.storage_bucket, job.storage_path)
    return Response(
        content=content,
        media_type=job.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{job.filename}"'},
    )


@router.post("/{job_id}/retry", response_model=APIResponse)
async def retry_export_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Retries a failed export."""
    service = ExportService(db)
    job = await service.get_job(job_id)
    job.status = "QUEUED"
    job.error_code = None
    job.error_message = None
    await service.process_export(job)
    return APIResponse(success=True, data=ExportJobResponse.model_validate(job))


@router.delete("/{job_id}", response_model=APIResponse)
async def delete_export_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Deletes the export metadata."""
    service = ExportService(db)
    job = await service.get_job(job_id)
    await service.delete_job(job)
    return APIResponse(success=True, data={"deleted": True, "job_id": str(job_id)})
