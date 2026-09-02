import hashlib
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseGovernmentAdapter(ABC):
    """Abstract connector for official statistical and regulatory data (MoSPI eSankhyiki, DGCA).
    Adheres strictly to the rule:
    1. Prefer official API first
    2. Then official CSV/Excel download
    3. Webpage extraction only if authorized and required.
    Treats datasets as reference, metadata, benchmark, and route weighting feeds, not live market scraping."""

    def __init__(self, source_id: str, source_name: str, base_url: str):
        self.source_id = source_id
        self.source_name = source_name
        self.base_url = base_url

    @abstractmethod
    async def discover_datasets(self) -> List[Dict[str, Any]]:
        """Queries available dataset releases, versions, and reference periods."""
        pass

    @abstractmethod
    async def fetch_metadata(self, dataset_code: str) -> Dict[str, Any]:
        """Fetches dataset metadata, schema description, and update frequency."""
        pass

    @abstractmethod
    async def fetch_dataset(self, dataset_code: str, period: Optional[str] = None) -> Dict[str, Any]:
        """Downloads/fetches the raw dataset payload (JSON, CSV, or structured tables)."""
        pass

    def verify_checksum(self, raw_content: bytes, expected_checksum: Optional[str] = None) -> str:
        """Computes SHA-256 checksum and compares against expected checksum if provided."""
        actual_checksum = hashlib.sha256(raw_content).hexdigest()
        if expected_checksum and actual_checksum.lower() != expected_checksum.lower():
            raise ValueError(f"Checksum mismatch for {self.source_name}! Expected {expected_checksum}, got {actual_checksum}")
        return actual_checksum

    @abstractmethod
    def validate_dataset(self, data: Any) -> bool:
        """Ensures the downloaded dataset conforms to required statistical schemas."""
        pass
