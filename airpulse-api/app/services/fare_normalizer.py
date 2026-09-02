from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from app.core.utils import utc_now
from app.schemas.fare import NormalizedFareRecord, ParsedFareRecord


class FareNormalizer:
    """Normalizes parsed fare records into the canonical schema.
    Calculates booking_window_days, enforces UTC timezone, and standardized fare product totals."""

    @staticmethod
    def normalize(parsed: ParsedFareRecord, route_id: Optional[UUID] = None) -> NormalizedFareRecord:
        # Standardize departure datetime to UTC
        try:
            dep_dt = datetime.fromisoformat(parsed.departure_time_str.replace("Z", "+00:00"))
            if dep_dt.tzinfo is None:
                dep_dt = dep_dt.replace(tzinfo=timezone.utc)
        except Exception:
            dep_dt = utc_now()

        arr_dt = None
        if parsed.arrival_time_str:
            try:
                arr_dt = datetime.fromisoformat(parsed.arrival_time_str.replace("Z", "+00:00"))
                if arr_dt.tzinfo is None:
                    arr_dt = arr_dt.replace(tzinfo=timezone.utc)
            except Exception:
                arr_dt = None

        # Calculate booking window in days: departure_date - collected_date
        collected_date = parsed.collected_at.date()
        dep_date = dep_dt.date()
        booking_window_days = max(0, (dep_date - collected_date).days)

        # Standardized normalized total fare: base_fare + mandatory taxes + mandatory fees
        # Excludes optional add-ons (seat, meal, priority baggage) to maintain strict inflation comparability
        normalized_total_fare = parsed.base_fare + parsed.taxes + parsed.fees
        if normalized_total_fare <= Decimal("0.0"):
            normalized_total_fare = parsed.total_fare

        return NormalizedFareRecord(
            raw_fare_id=parsed.raw_fare_id,
            source_id=parsed.source_id,
            route_id=route_id,
            airline_code=parsed.airline_code,
            flight_number=parsed.flight_number,
            origin_code=parsed.origin_code,
            destination_code=parsed.destination_code,
            departure_at=dep_dt,
            arrival_at=arr_dt,
            booking_window_days=booking_window_days,
            cabin_class=parsed.cabin_class,
            fare_class=parsed.fare_class,
            refundable=parsed.refundable,
            baggage_kg=parsed.baggage_kg,
            base_fare=parsed.base_fare,
            taxes=parsed.taxes,
            fees=parsed.fees,
            total_fare=parsed.total_fare,
            currency="INR",
            normalized_total_fare=normalized_total_fare,
            collected_at=parsed.collected_at,
        )
