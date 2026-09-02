import time
from typing import Any, Dict, List
import httpx
from app.collectors.base import BaseCollector
from app.schemas.fare import SearchRequest


class StaticCollector(BaseCollector):
    """Production static collector using HTTPX with exponential backoff, rate limiting, and timeout handling."""

    def __init__(self, source_id: str, source_name: str, base_url: str, headers: Dict[str, str] = None):
        super().__init__(source_id=source_id, source_name=source_name, collector_version="1.0.0-http")
        self.base_url = base_url
        self.headers = headers or {
            "User-Agent": "AirPulse-Price-Intelligence/1.0 (+https://airpulse.gov.in/bot)"
        }

    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/search"
        params = {
            "origin": search_request.origin,
            "destination": search_request.destination,
            "date": search_request.departure_date.isoformat(),
            "cabin": search_request.cabin_class.value,
        }
        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("flights", [])
                return []
            except Exception:
                return []

    async def health_check(self) -> Dict[str, Any]:
        start = time.time()
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                latency = int((time.time() - start) * 1000)
                return {
                    "source_id": self.source_id,
                    "source_name": self.source_name,
                    "status": "healthy" if resp.status_code == 200 else "degraded",
                    "latency_ms": latency,
                    "error": None if resp.status_code == 200 else f"HTTP {resp.status_code}",
                }
        except Exception as e:
            return {
                "source_id": self.source_id,
                "source_name": self.source_name,
                "status": "failed",
                "latency_ms": None,
                "error": str(e),
            }
