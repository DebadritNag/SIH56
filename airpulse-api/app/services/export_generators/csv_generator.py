import csv
import io
import json
from typing import Any, Dict, List, Tuple
from app.db.models import ValidatedFare


# 31 standard fare observation export columns
CSV_FARE_COLUMNS = [
    "fare_id",
    "collected_at",
    "origin",
    "destination",
    "departure_at",
    "arrival_at",
    "booking_window_days",
    "airline",
    "flight_number",
    "source",
    "source_type",
    "cabin",
    "fare_class",
    "refundable",
    "baggage_allowance",
    "base_fare",
    "taxes",
    "mandatory_fees",
    "convenience_fee",
    "total_fare",
    "normalized_total_fare",
    "currency",
    "validation_status",
    "is_duplicate",
    "index_eligible",
    "data_origin",
    "anomaly_status",
    "anomaly_percentile",
    "collection_run_id",
    "raw_fare_id",
    "quote_hash",
]


def generate_fare_observations_csv(records: List[ValidatedFare]) -> Tuple[bytes, int]:
    """Generates standard RFC-4180 CSV bytes for validated fare observations."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FARE_COLUMNS, extrasaction="ignore")
    writer.writeheader()

    count = 0
    for r in records:
        row = {
            "fare_id": str(r.id),
            "collected_at": r.collected_at.isoformat() if r.collected_at else "",
            "origin": r.origin,
            "destination": r.destination,
            "departure_at": r.departure_at.isoformat() if r.departure_at else "",
            "arrival_at": r.arrival_at.isoformat() if r.arrival_at else "",
            "booking_window_days": r.booking_window_days,
            "airline": r.airline,
            "flight_number": r.flight_number or "",
            "source": getattr(r, "source_name", "Airline/OTA Portal"),
            "source_type": "ONLINE",
            "cabin": r.cabin,
            "fare_class": r.fare_class or "",
            "refundable": "TRUE" if r.refundable else "FALSE",
            "baggage_allowance": r.baggage_allowance if r.baggage_allowance is not None else 15.0,
            "base_fare": float(r.base_fare),
            "taxes": float(r.taxes),
            "mandatory_fees": float(r.mandatory_fees),
            "convenience_fee": float(r.convenience_fee or 0.0),
            "total_fare": float(r.total_fare),
            "normalized_total_fare": float(r.normalized_total_fare),
            "currency": r.currency,
            "validation_status": r.validation_status,
            "is_duplicate": "TRUE" if r.is_duplicate else "FALSE",
            "index_eligible": "TRUE" if r.validation_status == "valid" and not r.is_duplicate else "FALSE",
            "data_origin": getattr(r, "data_origin", "LIVE"),
            "anomaly_status": "NORMAL",
            "anomaly_percentile": 0.05,
            "collection_run_id": str(r.collection_run_id) if r.collection_run_id else "",
            "raw_fare_id": str(r.raw_fare_id) if r.raw_fare_id else "",
            "quote_hash": r.quote_hash,
        }
        writer.writerow(row)
        count += 1

    content = output.getvalue().encode("utf-8")
    return content, count


def generate_anomalies_csv(records: List[Dict[str, Any]]) -> Tuple[bytes, int]:
    """Generates anomalies CSV export."""
    columns = [
        "anomaly_id",
        "detected_at",
        "route",
        "booking_window",
        "airline",
        "source",
        "actual_fare",
        "predicted_fare",
        "residual",
        "residual_pct",
        "anomaly_score",
        "anomaly_percentile",
        "severity",
        "status",
        "cross_source_confirmation",
        "market_shock_flag",
        "review_decision",
        "reviewer",
        "reviewed_at",
        "fare_id",
        "prediction_id",
        "model_version",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()

    count = 0
    for r in records:
        writer.writerow(r)
        count += 1

    return output.getvalue().encode("utf-8"), count


def generate_dict_csv(records: List[Dict[str, Any]], fieldnames: List[str]) -> Tuple[bytes, int]:
    """Generic dict-to-CSV generator."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    count = 0
    for r in records:
        writer.writerow(r)
        count += 1

    return output.getvalue().encode("utf-8"), count
