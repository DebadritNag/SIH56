from decimal import Decimal
from typing import Any, Dict
from uuid import UUID
from app.core.utils import utc_now
from app.schemas.fare import ParsedFareRecord


class FareParser:
    """Decoupled parser: Extracts disparate vendor structures into an intermediate ParsedFareRecord."""

    @staticmethod
    def parse_record(raw_fare_id: UUID, source_id: UUID, raw_dict: Dict[str, Any]) -> ParsedFareRecord:
        airline_code = (
            raw_dict.get("carrier")
            or raw_dict.get("airline_code")
            or raw_dict.get("airline")
            or "6E"
        )
        flight_num = (
            raw_dict.get("flight_no")
            or raw_dict.get("flight_number")
            or f"{airline_code}-101"
        )
        origin = (
            raw_dict.get("src")
            or raw_dict.get("origin")
            or raw_dict.get("origin_code")
            or "DEL"
        )
        destination = (
            raw_dict.get("dst")
            or raw_dict.get("destination")
            or raw_dict.get("destination_code")
            or "BOM"
        )
        dep_str = (
            raw_dict.get("departure_iso")
            or raw_dict.get("departure_at")
            or raw_dict.get("departure_time")
            or utc_now().isoformat()
        )
        arr_str = raw_dict.get("arrival_iso") or raw_dict.get("arrival_at")

        cabin = raw_dict.get("cabin") or raw_dict.get("cabin_class") or "economy"
        fare_class = raw_dict.get("fare_class")
        refundable = raw_dict.get("refundable_ticket", False)
        baggage = float(raw_dict.get("free_baggage_kg") or raw_dict.get("baggage_kg") or 15.0)

        base_fare = Decimal(str(raw_dict.get("base_price") or raw_dict.get("base_fare") or "0.0"))
        taxes = Decimal(str(raw_dict.get("tax_amount") or raw_dict.get("taxes") or "0.0"))
        fees = Decimal(str(raw_dict.get("mandatory_fees") or raw_dict.get("fees") or "0.0"))
        total_fare = Decimal(str(raw_dict.get("gross_total") or raw_dict.get("total_fare") or "0.0"))

        if total_fare == 0 and (base_fare > 0 or taxes > 0):
            total_fare = base_fare + taxes + fees

        return ParsedFareRecord(
            raw_fare_id=raw_fare_id,
            source_id=source_id,
            airline_code=airline_code.upper().strip(),
            flight_number=flight_num.strip() if flight_num else None,
            origin_code=origin.upper().strip(),
            destination_code=destination.upper().strip(),
            departure_time_str=dep_str,
            arrival_time_str=arr_str,
            cabin_class=cabin.lower().strip(),
            fare_class=fare_class,
            refundable=bool(refundable),
            baggage_kg=baggage,
            base_fare=base_fare,
            taxes=taxes,
            fees=fees,
            total_fare=total_fare,
            currency="INR",
            collected_at=utc_now(),
        )
