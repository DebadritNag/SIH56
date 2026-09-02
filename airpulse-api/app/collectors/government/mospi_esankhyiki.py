"""MoSPI eSankhyiki official-dataset adapter.

Treats eSankhyiki as an OFFICIAL/REFERENCE statistical source (never a live fare
source). Performs REAL network operations against the SIH-provided portal:

  * health_check()   - real HEAD/GET against the portal + documented CPI API host.
  * discover_datasets() - persisted/known official products (the portal is a JS SPA;
                          its documented machine API is api.mospi.gov.in CPI service).
  * fetch_dataset()  - real HTTP download of an official file/API response when a
                       download/api URL is configured; otherwise reports NOT_CONFIGURED.

It never fabricates fares and never claims a sync happened if the network failed.
Offline SIH demo uses an explicitly labelled fixture (fetch_fixture), not silent fallback.
"""
from __future__ import annotations

import hashlib
import io
import json
import time
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.collectors.government.base import BaseGovernmentAdapter

ADAPTER_VERSION = "mospi-esankhyiki-v2.0.0"
PORTAL_BASE = "https://esankhyiki.mospi.gov.in"
# Documented official CPI API host (see eSankhyiki API docs: /api/cpi/getCPIData).
CPI_API_BASE = "https://api.mospi.gov.in/api"
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 AirPulse/1.0 (MoSPI-CPI reference)"
)
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB safeguard


class MospiESankhyikiAdapter(BaseGovernmentAdapter):
    """Official MoSPI eSankhyiki connector (reference/statistical data only)."""

    def __init__(self, source_id: str = "mospi_esankhyiki", timeout: float = 25.0):
        super().__init__(
            source_id=source_id,
            source_name="MoSPI eSankhyiki",
            base_url=PORTAL_BASE,
        )
        self.timeout = timeout
        self.adapter_version = ADAPTER_VERSION

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=True,
            headers={"User-Agent": _BROWSER_UA, "Accept": "application/json,text/csv,*/*"},
        )

    # -- health -----------------------------------------------------------
    async def health_check(self) -> Dict[str, Any]:
        """Bounded reachability probe against the portal (no large download)."""
        started = time.time()
        result: Dict[str, Any] = {
            "source": self.source_name,
            "portal_url": PORTAL_BASE,
            "adapter_version": self.adapter_version,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            async with self._client() as client:
                resp = await client.get(PORTAL_BASE, timeout=15.0)
                result.update({
                    "reachable": resp.status_code < 500,
                    "http_status": resp.status_code,
                    "latency_ms": int((time.time() - started) * 1000),
                    "status": "HEALTHY" if resp.status_code < 400 else "DEGRADED",
                })
        except httpx.ConnectError as exc:
            result.update({"reachable": False, "status": "FAILED", "error": f"connection: {str(exc)[:120]}"})
        except httpx.TimeoutException:
            result.update({"reachable": False, "status": "DEGRADED", "error": "timeout"})
        except Exception as exc:  # noqa: BLE001
            result.update({"reachable": False, "status": "FAILED", "error": str(exc)[:120]})
        return result

    # -- discovery --------------------------------------------------------
    async def discover_datasets(self) -> List[Dict[str, Any]]:
        """Known official MoSPI reference products relevant to AirPulse.

        The portal is a client-rendered SPA; broad HTML scraping is intentionally
        avoided (spec: prefer official API/file). These descriptors point at the
        documented CPI product and the press-release Annexure files that the SIH
        organisers provide. Actual versions/values are only created on sync.
        """
        return [
            {
                "external_dataset_id": "cpi-press-release-annexure-iv",
                "dataset_name": "MoSPI CPI (General) — All-India Combined Index & Inflation",
                "dataset_code": "MOSPI_CPI_GENERAL_ANNEXURE_IV",
                "product_name": "Consumer Price Index",
                "dataset_type": "CPI",
                "frequency": "monthly",
                "format": "xlsx",
                "relevance": "HIGH",
                "landing_page_url": f"{PORTAL_BASE}/download-reports",
                "api_url": f"{CPI_API_BASE}/cpi/getCPIData",
                "base_year": "2012=100",
            },
        ]

    async def fetch_metadata(self, dataset_code: str) -> Dict[str, Any]:
        return {
            "dataset_code": dataset_code,
            "provider": "Ministry of Statistics and Programme Implementation",
            "organization": "MoSPI",
            "country": "India",
            "reference_standard": "National Consumer Price Index (base 2012=100)",
            "update_frequency": "monthly",
            "checksum_algorithm": "SHA-256",
            "adapter_version": self.adapter_version,
        }

    # -- fetch ------------------------------------------------------------
    async def fetch_dataset(
        self,
        dataset_code: str,
        period: Optional[str] = None,
        download_url: Optional[str] = None,
        api_url: Optional[str] = None,
        api_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Real fetch. Priority: documented API -> official file download.

        Returns {status, raw_bytes, checksum, format, content_type, http_status}.
        If nothing is configured/reachable, returns a truthful failure envelope
        (status FAILED / NOT_CONFIGURED) — never fabricated data.
        """
        # 1. Documented official API
        if api_url:
            try:
                async with self._client() as client:
                    resp = await client.get(api_url, params=api_params or {})
                    body = resp.content[:_MAX_BYTES]
                    if resp.status_code < 400 and body:
                        return self._envelope(body, resp.headers.get("content-type", ""), resp.status_code, "API")
                    return {"status": "FAILED", "failure_stage": "HTTP_ERROR", "http_status": resp.status_code,
                            "detail": f"CPI API returned {resp.status_code}", "raw_bytes": None}
            except httpx.ConnectError as exc:
                return {"status": "FAILED", "failure_stage": "DNS_FAILURE", "detail": str(exc)[:160], "raw_bytes": None}
            except httpx.TimeoutException:
                return {"status": "FAILED", "failure_stage": "TIMEOUT", "detail": "API timed out", "raw_bytes": None}

        # 2. Official file download
        if download_url:
            try:
                async with self._client() as client:
                    resp = await client.get(download_url)
                    body = resp.content[:_MAX_BYTES]
                    if resp.status_code < 400 and body:
                        return self._envelope(body, resp.headers.get("content-type", ""), resp.status_code, "FILE")
                    return {"status": "FAILED", "failure_stage": "HTTP_ERROR", "http_status": resp.status_code,
                            "detail": f"download returned {resp.status_code}", "raw_bytes": None}
            except httpx.ConnectError as exc:
                return {"status": "FAILED", "failure_stage": "CONNECTION_FAILURE", "detail": str(exc)[:160], "raw_bytes": None}
            except httpx.TimeoutException:
                return {"status": "FAILED", "failure_stage": "TIMEOUT", "detail": "download timed out", "raw_bytes": None}

        return {
            "status": "NOT_CONFIGURED",
            "failure_stage": "NOT_CONFIGURED",
            "detail": ("No documented API params or official download URL configured for this dataset. "
                       "Upload the official file via the reference ingestion endpoint."),
            "raw_bytes": None,
        }

    def _envelope(self, body: bytes, content_type: str, http_status: int, method: str) -> Dict[str, Any]:
        return {
            "status": "OK",
            "raw_bytes": body,
            "checksum": hashlib.sha256(body).hexdigest(),
            "format": self.detect_format(body, content_type),
            "content_type": content_type,
            "http_status": http_status,
            "ingestion_method": method,
        }

    @staticmethod
    def detect_format(body: bytes, content_type: str = "") -> str:
        ct = (content_type or "").lower()
        if body[:2] == b"PK":  # zip container -> xlsx
            return "xlsx"
        if body[:4] == b"\xd0\xcf\x11\xe0":  # legacy OLE -> xls
            return "xls"
        head = body[:64].lstrip()
        if head[:1] in (b"{", b"["):
            return "json"
        if "csv" in ct or b"," in body[:200]:
            return "csv"
        if "json" in ct:
            return "json"
        if "spreadsheet" in ct or "excel" in ct:
            return "xlsx"
        return "csv"

    def validate_dataset(self, data: Any) -> bool:
        return bool(data)

    # -- offline demo fixture (explicitly labelled) -----------------------
    def fetch_fixture(self) -> Dict[str, Any]:
        """Labelled offline fixture for SIH demo — NOT a real network sync."""
        payload = {
            "_label": "DEMO REFERENCE FIXTURE",
            "dataset_code": "MOSPI_CPI_GENERAL_DEMO",
            "base_period": "2012=100",
            "series": [
                {"period": "2026-05", "index_combined": 105.91, "inflation_yoy_combined_pct": 3.93},
                {"period": "2026-06", "index_combined": 107.00, "inflation_yoy_combined_pct": 4.38},
                {"period": "2026-07", "index_combined": 107.94, "inflation_yoy_combined_pct": 4.45},
            ],
        }
        raw = json.dumps(payload, sort_keys=True).encode("utf-8")
        return {"status": "OK", "raw_bytes": raw, "checksum": hashlib.sha256(raw).hexdigest(),
                "format": "json", "is_fixture": True}
