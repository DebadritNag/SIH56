from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
import pytest
from app.services.fare_parser import FareParser
from app.services.fare_normalizer import FareNormalizer
from app.services.fare_validator import FareValidator
from app.services.fare_deduplicator import FareDeduplicator
from app.core.enums import ValidationStatus


def test_fare_parser_extracts_canonical_fields():
    raw_id = uuid4()
    src_id = uuid4()
    raw_payload = {
        "carrier": "6E",
        "flight_no": "6E-204",
        "src": "del",
        "dst": "bom",
        "departure_iso": "2026-09-10T08:00:00Z",
        "base_price": "4500.00",
        "tax_amount": "540.00",
        "mandatory_fees": "400.00",
        "gross_total": "5440.00",
    }
    parsed = FareParser.parse_record(raw_id, src_id, raw_payload)
    assert parsed.airline_code == "6E"
    assert parsed.origin_code == "DEL"
    assert parsed.destination_code == "BOM"
    assert parsed.base_fare == Decimal("4500.00")
    assert parsed.total_fare == Decimal("5440.00")


def test_fare_normalizer_calculates_booking_window_and_totals():
    raw_id = uuid4()
    src_id = uuid4()
    raw_payload = {
        "carrier": "AI",
        "flight_no": "AI-101",
        "src": "BOM",
        "dst": "DEL",
        "departure_iso": "2026-09-12T10:00:00+00:00",
        "base_price": "5000.00",
        "tax_amount": "600.00",
        "mandatory_fees": "350.00",
        "gross_total": "5950.00",
    }
    parsed = FareParser.parse_record(raw_id, src_id, raw_payload)
    # Set fixed collected_at
    parsed.collected_at = datetime(2026, 9, 5, 10, 0, 0, tzinfo=timezone.utc)
    norm = FareNormalizer.normalize(parsed)

    assert norm.booking_window_days == 7
    assert norm.normalized_total_fare == Decimal("5950.00")
    assert norm.airline_code == "AI"


def test_fare_validator_rejects_negative_or_corrupt_fares():
    raw_id = uuid4()
    src_id = uuid4()
    # Invalid: origin == destination, negative base
    raw_payload = {
        "carrier": "6E",
        "src": "DEL",
        "dst": "DEL",
        "departure_iso": "2026-09-10T08:00:00Z",
        "base_price": "-100.00",
        "tax_amount": "50.00",
        "mandatory_fees": "0.00",
        "gross_total": "-50.00",
    }
    parsed = FareParser.parse_record(raw_id, src_id, raw_payload)
    norm = FareNormalizer.normalize(parsed)
    status, errors = FareValidator.validate(norm)

    assert status == ValidationStatus.REJECTED
    assert any(e["code"] == "ORIGIN_EQUALS_DESTINATION" for e in errors)
    assert any(e["code"] == "NEGATIVE_COMPONENTS" for e in errors)


def test_fare_deduplicator_quote_hash():
    raw_id = uuid4()
    src_id = uuid4()
    raw_payload = {
        "carrier": "QP",
        "flight_no": "QP-555",
        "src": "BLR",
        "dst": "DEL",
        "departure_iso": "2026-09-15T14:30:00Z",
        "base_price": "6000.00",
        "tax_amount": "720.00",
        "mandatory_fees": "400.00",
        "gross_total": "7120.00",
    }
    parsed = FareParser.parse_record(raw_id, src_id, raw_payload)
    norm = FareNormalizer.normalize(parsed)

    hash1 = FareDeduplicator.generate_quote_hash(norm)
    hash2 = FareDeduplicator.generate_quote_hash(norm)
    assert hash1 == hash2
    assert len(hash1) == 64

    # Duplicate evaluation
    hash_map = {}
    is_dup1, group_id1 = FareDeduplicator.evaluate_duplicate(hash1, hash_map)
    assert not is_dup1

    is_dup2, group_id2 = FareDeduplicator.evaluate_duplicate(hash1, hash_map)
    assert is_dup2
    assert group_id2 is not None
