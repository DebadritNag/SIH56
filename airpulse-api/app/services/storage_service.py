"""
Supabase Storage service (backend-only, service-role).

All bucket access happens here on the trusted backend using the service-role key.
Buckets are PRIVATE; authorized downloads are handed to the browser as short-lived
signed URLs. The service-role key must never reach the browser or logs.

Buckets (all private):
  * raw-responses        raw HTML/API scraper payloads
  * imported-datasets    analyst CSV/XLSX uploads
  * reference-datasets   official MoSPI/DGCA files
  * backtest-reports     backtest report JSON
  * model-artifacts      trained model binaries

Suggested object paths:
  raw-responses/{source}/{yyyy}/{mm}/{dd}/{run_id}/{hash}.html|.json
  imported-datasets/{user_id}/{import_id}/{filename}
  reference-datasets/{source}/{dataset_id}/{filename}
  backtest-reports/{run_id}/report.json
  model-artifacts/{model_name}/{version}/model.bin
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import settings

RAW_RESPONSES = "raw-responses"
IMPORTED_DATASETS = "imported-datasets"
REFERENCE_DATASETS = "reference-datasets"
BACKTEST_REPORTS = "backtest-reports"
MODEL_ARTIFACTS = "model-artifacts"

ALL_BUCKETS = (
    RAW_RESPONSES,
    IMPORTED_DATASETS,
    REFERENCE_DATASETS,
    BACKTEST_REPORTS,
    MODEL_ARTIFACTS,
)


class StorageService:
    """Thin async wrapper over the Supabase Storage REST API using the service role."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self._base = (base_url or settings.SUPABASE_URL).rstrip("/")
        self._key = service_role_key or settings.SUPABASE_SERVICE_ROLE_KEY
        self._timeout = timeout

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._key}",
            "apikey": self._key,
        }

    # -- object paths -------------------------------------------------------
    @staticmethod
    def raw_response_path(source: str, run_id: str, response_hash: str, ext: str = "json") -> str:
        now = datetime.now(timezone.utc)
        return f"{source}/{now:%Y}/{now:%m}/{now:%d}/{run_id}/{response_hash}.{ext.lstrip('.')}"

    @staticmethod
    def imported_dataset_path(user_id: str, import_id: str, filename: str) -> str:
        return f"{user_id}/{import_id}/{filename}"

    @staticmethod
    def reference_dataset_path(source: str, dataset_id: str, filename: str) -> str:
        return f"{source}/{dataset_id}/{filename}"

    @staticmethod
    def backtest_report_path(run_id: str) -> str:
        return f"{run_id}/report.json"

    @staticmethod
    def model_artifact_path(model_name: str, version: str, filename: str = "model.bin") -> str:
        return f"{model_name}/{version}/{filename}"

    # -- operations ---------------------------------------------------------
    async def upload(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str = "application/octet-stream",
        upsert: bool = True,
    ) -> str:
        """Upload bytes to a private bucket. Returns the object path on success."""
        url = f"{self._base}/storage/v1/object/{bucket}/{path}"
        headers = {
            **self._headers,
            "Content-Type": content_type,
            "x-upsert": "true" if upsert else "false",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, headers=headers, content=content)
            resp.raise_for_status()
        return path

    async def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """
        Generate a short-lived signed URL for an authorized download.

        ``expires_in`` is seconds; default 1 hour. This is the only way the browser
        should ever access private objects.
        """
        url = f"{self._base}/storage/v1/object/sign/{bucket}/{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, headers=self._headers, json={"expiresIn": expires_in})
            resp.raise_for_status()
            signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
        return f"{self._base}/storage/v1{signed}" if signed and signed.startswith("/") else signed

    async def download(self, bucket: str, path: str) -> bytes:
        """Download object bytes on the backend (service role)."""
        url = f"{self._base}/storage/v1/object/{bucket}/{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.content

    async def list_buckets(self) -> list[dict]:
        """List buckets (diagnostics)."""
        url = f"{self._base}/storage/v1/bucket"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()


def get_storage_service() -> StorageService:
    return StorageService()
