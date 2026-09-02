import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from app.collectors.base import BaseCollector
from app.schemas.runs import SearchRequest


class SyntheticCollector(BaseCollector):
    """High-fidelity synthetic airfare generator.
    Does NOT use simple uniform random numbers. Generates prices based on:
    fare = route_base * booking_window_mult * weekend_mult * season_mult * festival_mult * demand_mult * airline_mult * noise
    Also injects rare multi-source shocks, dirty data artifacts, and source variance.
    STRICT RULE: Synthetic payloads enter raw_fares and pass through the identical ingestion pipeline."""

    CARRIERS = {
        "6E": {"name": "IndiGo", "mult": 1.00},
        "AI": {"name": "Air India", "mult": 1.08},
        "IX": {"name": "Air India Express", "mult": 0.94},
        "QP": {"name": "Akasa Air", "mult": 0.95},
        "SG": {"name": "SpiceJet", "mult": 0.96},
    }

    DISTANCE_CACHE = {
        ("DEL", "BOM"): 1148.0, ("BOM", "DEL"): 1148.0,
        ("BLR", "DEL"): 1740.0, ("DEL", "BLR"): 1740.0,
        ("BOM", "BLR"): 842.0,  ("BLR", "BOM"): 842.0,
        ("DEL", "CCU"): 1305.0, ("CCU", "DEL"): 1305.0,
        ("DEL", "HYD"): 1253.0, ("HYD", "DEL"): 1253.0,
        ("BOM", "MAA"): 1033.0, ("MAA", "BOM"): 1033.0,
        ("DEL", "AMD"): 775.0,  ("AMD", "DEL"): 775.0,
        ("BOM", "GOI"): 435.0,  ("GOI", "BOM"): 435.0,
    }

    def __init__(self, source_id: str = "synthetic-source-id", source_name: str = "AirPulse Synthetic Generator"):
        super().__init__(source_id=source_id, source_name=source_name, collector_version="1.0.0-synthetic")

    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        quotes = []
        origin = search_request.origin.upper()
        dest = search_request.destination.upper()
        dep_date = search_request.departure_date
        window = search_request.booking_window_days

        # Route base fare derived from distance
        dist = self.DISTANCE_CACHE.get((origin, dest), 1000.0)
        route_base = (dist * 3.4) + 1400.0

        # Booking window multiplier
        if window <= 1:
            bw_mult = 1.70
        elif window <= 7:
            bw_mult = 1.25
        elif window <= 15:
            bw_mult = 1.00
        elif window <= 30:
            bw_mult = 0.88
        else:
            bw_mult = 0.80

        # Day of week / weekend multiplier
        dow = dep_date.weekday()
        weekend_mult = 1.12 if dow in [4, 5, 6] else 1.00

        # Seasonality & Festival multiplier
        month = dep_date.month
        season_mult = 1.15 if month in [10, 11, 12, 5, 6] else 0.95
        festival_mult = 1.30 if (month == 10 and dep_date.day in [18, 19, 20]) else 1.00

        # Demand proxy
        demand_mult = 1.05 if (origin, dest) in [("DEL", "BOM"), ("BOM", "DEL")] else 1.00

        # Random multi-source shock injection (1.5% probability)
        shock_mult = 1.55 if random.random() < 0.015 else 1.00

        for carrier_code, carrier_meta in self.CARRIERS.items():
            airline_mult = carrier_meta["mult"]
            noise = random.uniform(-150.0, 180.0)

            raw_base = round(
                (route_base * bw_mult * weekend_mult * season_mult * festival_mult * demand_mult * airline_mult * shock_mult)
                + noise,
                2,
            )
            raw_taxes = round(raw_base * 0.12, 2)
            raw_fees = 450.0
            raw_total = round(raw_base + raw_taxes + raw_fees, 2)

            dep_hour = random.randint(6, 21)
            dep_min = random.choice([0, 15, 30, 45])
            dep_dt = datetime(dep_date.year, dep_date.month, dep_date.day, dep_hour, dep_min, tzinfo=timezone.utc)
            arr_dt = dep_dt + timedelta(hours=2, minutes=random.randint(5, 25))

            flight_no = f"{carrier_code}-{random.randint(101, 999)}"

            # Rare data quality error injection (0.5% chance, e.g. zero tax or reversed route)
            if random.random() < 0.005:
                raw_taxes = 0.0

            quotes.append({
                "source": self.source_name,
                "carrier": carrier_code,
                "airline_name": carrier_meta["name"],
                "flight_no": flight_no,
                "src": origin,
                "dst": dest,
                "departure_iso": dep_dt.isoformat(),
                "arrival_iso": arr_dt.isoformat(),
                "booking_window": window,
                "cabin": search_request.cabin.value,
                "base_price": raw_base,
                "tax_amount": raw_taxes,
                "mandatory_fees": raw_fees,
                "gross_total": raw_total,
                "currency_code": "INR",
                "refundable_ticket": False,
                "free_baggage_kg": 15.0,
                "_synthetic_metadata": {
                    "is_shock": shock_mult > 1.0,
                    "is_festival": festival_mult > 1.0,
                    "lead_mult": bw_mult,
                },
            })

        return quotes

    def parse(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "carrier": raw_payload.get("carrier"),
            "flight_no": raw_payload.get("flight_no"),
            "src": raw_payload.get("src"),
            "dst": raw_payload.get("dst"),
            "departure_iso": raw_payload.get("departure_iso"),
            "arrival_iso": raw_payload.get("arrival_iso"),
            "base_price": raw_payload.get("base_price"),
            "tax_amount": raw_payload.get("tax_amount"),
            "mandatory_fees": raw_payload.get("mandatory_fees"),
            "gross_total": raw_payload.get("gross_total"),
            "currency_code": raw_payload.get("currency_code", "INR"),
            "free_baggage_kg": raw_payload.get("free_baggage_kg", 15.0),
        }

    async def health_check(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "status": "healthy",
            "latency_ms": 5,
            "error": None,
        }
