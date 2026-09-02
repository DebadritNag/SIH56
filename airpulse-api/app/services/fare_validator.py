from decimal import Decimal
from typing import Any, Dict, List, Tuple
from app.core.constants import (
    MAX_BOOKING_WINDOW_DAYS,
    MIN_BOOKING_WINDOW_DAYS,
    SANITY_MAX_FARE,
    SANITY_MIN_FARE,
    SUPPORTED_CURRENCIES,
)
from app.core.enums import ValidationStatus
from app.schemas.fare import NormalizedFareRecord


class FareValidator:
    """Validates normalized fares against schema sanity bounds and domain rules.
    Outputs machine-readable validation error logs for auditability."""

    @staticmethod
    def validate(fare: NormalizedFareRecord) -> Tuple[ValidationStatus, List[Dict[str, Any]]]:
        errors: List[Dict[str, Any]] = []

        # 1. Airport code validity
        if len(fare.origin_code) != 3 or not fare.origin_code.isalpha():
            errors.append({
                "field": "origin_code",
                "code": "INVALID_ORIGIN_CODE",
                "severity": "error",
                "message": f"Origin code '{fare.origin_code}' is not a valid 3-character IATA format.",
            })

        if len(fare.destination_code) != 3 or not fare.destination_code.isalpha():
            errors.append({
                "field": "destination_code",
                "code": "INVALID_DESTINATION_CODE",
                "severity": "error",
                "message": f"Destination code '{fare.destination_code}' is not a valid 3-character IATA format.",
            })

        if fare.origin_code == fare.destination_code:
            errors.append({
                "field": "route",
                "code": "ORIGIN_EQUALS_DESTINATION",
                "severity": "error",
                "message": "Origin and destination airport codes cannot be identical.",
            })

        # 2. Currency check
        if fare.currency not in SUPPORTED_CURRENCIES:
            errors.append({
                "field": "currency",
                "code": "UNSUPPORTED_CURRENCY",
                "severity": "error",
                "message": f"Currency '{fare.currency}' is not supported.",
            })

        # 3. Numeric validity
        if fare.normalized_total_fare <= Decimal("0.0"):
            errors.append({
                "field": "normalized_total_fare",
                "code": "FARE_NON_POSITIVE",
                "severity": "error",
                "message": "Normalized total fare must be strictly positive.",
            })

        if fare.base_fare < Decimal("0.0") or fare.taxes < Decimal("0.0"):
            errors.append({
                "field": "fare_components",
                "code": "NEGATIVE_COMPONENTS",
                "severity": "error",
                "message": "Base fare and taxes must be non-negative.",
            })

        # 4. Booking window bounds
        if not (MIN_BOOKING_WINDOW_DAYS <= fare.booking_window_days <= MAX_BOOKING_WINDOW_DAYS):
            errors.append({
                "field": "booking_window_days",
                "code": "BOOKING_WINDOW_OUT_OF_BOUNDS",
                "severity": "error",
                "message": f"Booking window {fare.booking_window_days} days is outside allowed range ({MIN_BOOKING_WINDOW_DAYS}-{MAX_BOOKING_WINDOW_DAYS}).",
            })

        # 5. Sanity range check (broad domain boundaries; not statistical anomalies)
        fare_float = float(fare.normalized_total_fare)
        if fare_float < SANITY_MIN_FARE or fare_float > SANITY_MAX_FARE:
            errors.append({
                "field": "normalized_total_fare",
                "code": "FARE_OUT_OF_SANITY_RANGE",
                "severity": "warning",
                "message": f"Fare ₹{fare_float:.2f} falls outside physical sanity threshold [₹{SANITY_MIN_FARE}, ₹{SANITY_MAX_FARE}].",
            })

        # Determine overall status
        has_error = any(e["severity"] == "error" for e in errors)
        has_warning = any(e["severity"] == "warning" for e in errors)

        if has_error:
            return ValidationStatus.REJECTED, errors
        elif has_warning:
            return ValidationStatus.WARNING, errors
        return ValidationStatus.VALID, errors
