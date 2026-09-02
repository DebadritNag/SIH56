from datetime import datetime
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID, uuid4
from app.core.utils import compute_sha256
from app.schemas.fare import NormalizedFareRecord


class FareDeduplicator:
    """Deduplication Engine: Generates deterministic quote hash based on:
    [source_id, airline_code, flight_number, origin, destination, departure_time_hour, cabin, normalized_fare, collection_bucket_hour].
    Preserves duplicates for auditability using duplicate_group_id without deletion."""

    @staticmethod
    def generate_quote_hash(fare: NormalizedFareRecord) -> str:
        # Time bucketed to 3-hour collection windows
        col_bucket = fare.collected_at.strftime("%Y-%m-%d-%H")
        dep_bucket = fare.departure_at.strftime("%Y-%m-%d-%H")
        flight_num = fare.flight_number or "GENERIC"

        raw_identifier = (
            f"{fare.source_id}|{fare.airline_code}|{flight_num}|"
            f"{fare.origin_code}|{fare.destination_code}|{dep_bucket}|"
            f"{fare.cabin_class}|{str(fare.normalized_total_fare)}|{col_bucket}"
        )
        return compute_sha256(raw_identifier)

    @staticmethod
    def evaluate_duplicate(
        quote_hash: str, existing_hash_map: dict[str, UUID]
    ) -> Tuple[bool, Optional[UUID]]:
        """Checks if quote_hash is already registered in existing_hash_map.
        Returns (is_duplicate, duplicate_group_id)."""
        if quote_hash in existing_hash_map:
            return True, existing_hash_map[quote_hash]
        # New unique quote - generates its own potential group ID
        new_group_id = uuid4()
        existing_hash_map[quote_hash] = new_group_id
        return False, None
