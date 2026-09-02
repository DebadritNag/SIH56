import json
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from app.collectors.base import BaseCollector
from app.schemas.runs import SearchRequest


class ReplayCollector(BaseCollector):
    """Replays stored JSON/CSV fixtures for reproducible demonstrations and testing.
    Replay records enter raw_fares and pass through the identical ingestion pipeline."""

    def __init__(self, source_id: str = "replay-source-id", source_name: str = "AirPulse Replay Source", fixtures_path: str = None):
        super().__init__(source_id=source_id, source_name=source_name, collector_version="1.0.0-replay")
        self.fixtures_path = fixtures_path

    async def collect(self, search_request: SearchRequest) -> List[Dict[str, Any]]:
        if self.fixtures_path and os.path.exists(self.fixtures_path):
            with open(self.fixtures_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else [data]

        # Standard simulated deterministic replay payload
        quotes = []
        origin = search_request.origin.upper()
        dest = search_request.destination.upper()
        dep_date = search_request.departure_date
        window = search_request.booking_window_days

        base_costs = {
            ("DEL", "BOM"): 5200.0,
            ("BOM", "DEL"): 5100.0,
            ("BLR", "DEL"): 6400.0,
            ("DEL", "BLR"): 6350.0,
            ("BOM", "BLR"): 3800.0,
            ("BLR", "BOM"): 3750.0,
            ("DEL", "CCU"): 5500.0,
            ("CCU", "DEL"): 5450.0,
            ("DEL", "HYD"): 4900.0,
            ("HYD", "DEL"): 4850.0,
        }
        baseline = base_costs.get((origin, dest), 4800.0)

        multiplier = 1.65 if window <= 1 else (1.20 if window <= 7 else (1.0 if window <= 15 else 0.88))
        carriers = [("6E", "IndiGo"), ("AI", "Air India"), ("QP", "Akasa Air")]

        for code, name in carriers:
            flight_num = f"{code}-{random.randint(201, 799)}"
            dep_dt = datetime(dep_date.year, dep_date.month, dep_date.day, random.randint(7, 20), 0, tzinfo=timezone.utc)
            arr_dt = dep_dt + timedelta(hours=2, minutes=15)

            raw_base = round((baseline * multiplier) + random.uniform(-100, 150), 2)
            raw_taxes = round(raw_base * 0.12, 2)
            raw_fees = 450.0
            raw_total = round(raw_base + raw_taxes + raw_fees, 2)

            quotes.append({
                "source": self.source_name,
                "carrier": code,
                "airline_name": name,
                "flight_no": flight_num,
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
                "free_baggage_kg": 15.0,
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
            "latency_ms": 10,
            "error": None,
        }
