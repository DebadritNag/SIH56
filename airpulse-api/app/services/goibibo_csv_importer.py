"""Importer for manually-scraped Goibibo flight-listing CSVs.

The scraper exports raw web CSS-class column names (boldFont=airline,
fliCode=flight code, fontSize18=total fare, appendBottom2=dep time,
appendBottom2 (2)=arr time, stop-info=duration, flightsLayoverInfo=stops).
Route + departure date are supplied by the caller (from the filename/context)
because they are not present in the rows.

Writes REAL observations as data_origin=IMPORTED into raw_fares + validated_fares
with a deterministic quote_hash for dedup. No fabrication: rows without a parseable
fare are skipped and reported.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.db.models import RawFare, Route, Source, ValidatedFare

IMPORTER_VERSION = "goibibo-csv-importer-v1.0.0"
_FARE_RE = re.compile(r"[\d,]+")
_TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")


def _clean_fare(cell: Any) -> Optional[float]:
    """'₹ 11,254' / '11,254' -> 11254.0. Ignores small 'lock price' amounts."""
    if cell is None:
        return None
    m = _FARE_RE.findall(str(cell).replace("\u20b9", " "))
    if not m:
        return None
    val = float(max(m, key=lambda s: len(s.replace(",", ""))).replace(",", ""))
    return val if val >= 500 else None  # ignore lock-price/discount noise


def _parse_hhmm(cell: Any) -> Optional[time]:
    s = str(cell or "").strip()
    if _TIME_RE.match(s):
        h, m = s.split(":")
        return time(int(h), int(m))
    return None


def _stops(cell: Any) -> int:
    s = str(cell or "").lower()
    if "non stop" in s or "nonstop" in s:
        return 0
    m = re.search(r"(\d+)\s*stop", s)
    return int(m.group(1)) if m else 0


class GoibiboCsvImporter:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _source_id(self) -> Optional[str]:
        # Goibibo is an OTA; map to an existing OTA source row.
        for name in ("goibibo", "ota_source_01", "ota_source_02"):
            s = (await self.session.execute(select(Source).where(Source.name == name))).scalars().first()
            if s:
                return str(s.id)
        return None

    async def _route_id(self, origin: str, destination: str) -> Optional[str]:
        code = f"{origin}-{destination}"
        r = (await self.session.execute(select(Route).where(Route.route_code == code))).scalars().first()
        return str(r.id) if r else None

    @staticmethod
    def _row_get(row: Dict[str, str], *keys: str) -> Optional[str]:
        for k in keys:
            if k in row and row[k] not in (None, ""):
                return row[k]
        return None

    async def import_csv(
        self,
        raw: bytes,
        origin: str,
        destination: str,
        departure_date: date,
        scrape_date: Optional[date] = None,
        cabin: str = "economy",
    ) -> Dict[str, Any]:
        origin = origin.upper().strip()
        destination = destination.upper().strip()
        scrape_date = scrape_date or date.today()
        booking_window = max(0, (departure_date - scrape_date).days)

        source_id = await self._source_id()
        route_id = await self._route_id(origin, destination)

        text = raw.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        response_hash = hashlib.sha256(raw).hexdigest()

        # One raw_fares envelope per import (the scraped page payload).
        raw_row = RawFare(
            id=uuid4(), source_id=source_id, data_origin="IMPORTED",
            origin_requested=origin, destination_requested=destination,
            departure_requested=departure_date, booking_window_requested=booking_window,
            collected_at=utc_now(), http_status=200,
            raw_payload={"importer": IMPORTER_VERSION, "rows": text[:20000]},
            response_hash=response_hash, collector_version="manual-scrape",
            parser_version=IMPORTER_VERSION,
        )
        self.session.add(raw_row)
        await self.session.flush()

        inserted, skipped, dupes = 0, 0, 0
        seen_hashes: set[str] = set()
        for row in reader:
            airline = self._row_get(row, "boldFont")
            fare = _clean_fare(self._row_get(row, "fontSize18"))
            if not airline or fare is None:
                skipped += 1
                continue
            flight_no = (self._row_get(row, "fliCode") or "").strip()
            dep_t = _parse_hhmm(self._row_get(row, "appendBottom2"))
            arr_t = _parse_hhmm(self._row_get(row, "appendBottom2 (2)"))
            stops = _stops(self._row_get(row, "flightsLayoverInfo", "flightsLayoverInfo (2)", "stop-info"))

            dep_dt = datetime.combine(departure_date, dep_t or time(6, 0), tzinfo=timezone.utc)
            arr_dt = None
            if arr_t:
                arr_day = departure_date + (timedelta(days=1) if dep_t and arr_t < dep_t else timedelta(0))
                arr_dt = datetime.combine(arr_day, arr_t, tzinfo=timezone.utc)

            quote_hash = hashlib.sha256(
                f"{origin}|{destination}|{departure_date}|{airline}|{flight_no}|{fare}|{dep_t}".encode()
            ).hexdigest()
            if quote_hash in seen_hashes:
                dupes += 1
                continue
            seen_hashes.add(quote_hash)

            self.session.add(ValidatedFare(
                id=uuid4(), raw_fare_id=raw_row.id, source_id=source_id, route_id=route_id,
                data_origin="IMPORTED", airline=airline.strip(), flight_number=flight_no or None,
                origin=origin, destination=destination, departure_at=dep_dt, arrival_at=arr_dt,
                booking_window_days=booking_window, cabin=cabin, fare_class="ECONOMY",
                # OTA displays an all-in fare; itemisation not provided by source.
                base_fare=fare, taxes=0, mandatory_fees=0, convenience_fee=0,
                total_fare=fare, normalized_total_fare=fare, currency="INR",
                validation_status="VALID",
                validation_errors={"note": "OTA all-in fare; base/tax breakdown not itemised by source"},
                is_duplicate=False, quote_hash=quote_hash, collected_at=utc_now(),
            ))
            inserted += 1

        await self.session.commit()
        return {
            "status": "OK", "origin": origin, "destination": destination,
            "departure_date": departure_date.isoformat(), "booking_window_days": booking_window,
            "route_matched": route_id is not None, "source_matched": source_id is not None,
            "fares_inserted": inserted, "rows_skipped": skipped, "duplicates": dupes,
            "raw_fare_id": str(raw_row.id), "response_hash": response_hash[:16],
        }


    # ------------------------------------------------------------------
    # Standard clean CSV format (recommended): one flight per row with headers
    #   origin,destination,departure_date,scrape_date,airline,flight_number,
    #   stops,departure_time,arrival_time,total_fare
    # Route + dates live in each row, so a single file may span many routes/dates.
    # ------------------------------------------------------------------
    STANDARD_HEADERS = {"origin", "destination", "departure_date", "airline", "total_fare"}

    @staticmethod
    def is_standard_format(header: List[str]) -> bool:
        cols = {h.strip().lower() for h in (header or [])}
        return GoibiboCsvImporter.STANDARD_HEADERS.issubset(cols)

    @staticmethod
    def _parse_date(s: Any) -> Optional[date]:
        if not s:
            return None
        s = str(s).strip()
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    async def import_standard_csv(
        self,
        raw: bytes,
        default_scrape_date: Optional[date] = None,
        cabin: str = "economy",
    ) -> Dict[str, Any]:
        """Import the recommended clean CSV. Route/date are read per row."""
        text = raw.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        norm_fields = {(f or "").strip().lower(): f for f in (reader.fieldnames or [])}
        if not self.is_standard_format(list(norm_fields.keys())):
            return {"status": "WRONG_FORMAT",
                    "detail": "Missing required headers: origin,destination,departure_date,airline,total_fare"}

        def g(row: Dict[str, str], key: str) -> Optional[str]:
            f = norm_fields.get(key)
            return row.get(f) if f else None

        response_hash = hashlib.sha256(raw).hexdigest()
        source_id = await self._source_id()
        default_scrape = default_scrape_date or date.today()

        raw_row = RawFare(
            id=uuid4(), source_id=source_id, data_origin="IMPORTED",
            collected_at=utc_now(), http_status=200,
            raw_payload={"importer": IMPORTER_VERSION, "format": "standard", "rows": text[:20000]},
            response_hash=response_hash, collector_version="manual-scrape",
            parser_version=IMPORTER_VERSION,
        )
        self.session.add(raw_row)
        await self.session.flush()

        route_cache: Dict[str, Optional[str]] = {}
        inserted, skipped, dupes = 0, 0, 0
        routes_seen: set[str] = set()
        seen_hashes: set[str] = set()

        for row in reader:
            origin = (g(row, "origin") or "").upper().strip()
            dest = (g(row, "destination") or "").upper().strip()
            dep_date = self._parse_date(g(row, "departure_date"))
            fare = _clean_fare(g(row, "total_fare"))
            if not origin or not dest or not dep_date or fare is None:
                skipped += 1
                continue

            scrape_date = self._parse_date(g(row, "scrape_date")) or default_scrape
            booking_window = max(0, (dep_date - scrape_date).days)
            airline = (g(row, "airline") or "UNKNOWN").strip()
            flight_no = (g(row, "flight_number") or "").strip()
            dep_t = _parse_hhmm(g(row, "departure_time"))
            arr_t = _parse_hhmm(g(row, "arrival_time"))

            dep_dt = datetime.combine(dep_date, dep_t or time(6, 0), tzinfo=timezone.utc)
            arr_dt = None
            if arr_t:
                arr_day = dep_date + (timedelta(days=1) if dep_t and arr_t < dep_t else timedelta(0))
                arr_dt = datetime.combine(arr_day, arr_t, tzinfo=timezone.utc)

            key = f"{origin}-{dest}"
            if key not in route_cache:
                route_cache[key] = await self._route_id(origin, dest)
            routes_seen.add(key)

            quote_hash = hashlib.sha256(
                f"{origin}|{dest}|{dep_date}|{airline}|{flight_no}|{fare}|{dep_t}".encode()
            ).hexdigest()
            if quote_hash in seen_hashes:
                dupes += 1
                continue
            seen_hashes.add(quote_hash)

            self.session.add(ValidatedFare(
                id=uuid4(), raw_fare_id=raw_row.id, source_id=source_id, route_id=route_cache[key],
                data_origin="IMPORTED", airline=airline, flight_number=flight_no or None,
                origin=origin, destination=dest, departure_at=dep_dt, arrival_at=arr_dt,
                booking_window_days=booking_window, cabin=cabin, fare_class="ECONOMY",
                base_fare=fare, taxes=0, mandatory_fees=0, convenience_fee=0,
                total_fare=fare, normalized_total_fare=fare, currency="INR",
                validation_status="VALID",
                validation_errors={"note": "OTA all-in fare; base/tax breakdown not itemised by source"},
                is_duplicate=False, quote_hash=quote_hash, collected_at=utc_now(),
            ))
            inserted += 1

        await self.session.commit()
        return {
            "status": "OK", "format": "standard",
            "routes": sorted(routes_seen),
            "routes_matched": [k for k in routes_seen if route_cache.get(k)],
            "fares_inserted": inserted, "rows_skipped": skipped, "duplicates": dupes,
            "raw_fare_id": str(raw_row.id), "response_hash": response_hash[:16],
        }
