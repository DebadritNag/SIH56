"""Import scraped fare CSVs as real IMPORTED fare observations.

Auto-detects format:
  * STANDARD (recommended): headers origin,destination,departure_date,scrape_date,
    airline,flight_number,stops,departure_time,arrival_time,total_fare
    -> route/date read per row; a single file may span many routes/dates.
  * RAW Goibibo export (CSS-class column names) -> uses the (origin,dest,dep) hints below.

Usage:
  python -m scripts.import_goibibo_csvs                 # imports FILES below
  python -m scripts.import_goibibo_csvs path\to\file.csv   # import one standard-format file
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import sys
from datetime import date

from app.db.session import AsyncSessionLocal
from app.services.goibibo_csv_importer import GoibiboCsvImporter

BASE = r"d:\New projects\SIH56"
SCRAPE_DATE = date(2026, 9, 3)

# RAW Goibibo exports (need route/date hints, not present in the rows).
RAW_FILES = [
    (rf"{BASE}\goibibo-2026-09-03 bom-bengcsv.csv", "BOM", "BLR", date(2026, 9, 10)),
    (rf"{BASE}\goibibo-2026-09-03 new delhi -- ccu.csv", "DEL", "CCU", date(2026, 9, 10)),
    (rf"{BASE}\goibibo-2026-09-03 21).csv", "DEL", "BOM", date(2026, 9, 10)),
]


def _is_standard(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(4096).decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(head))
        header = next(reader, [])
        return GoibiboCsvImporter.is_standard_format(header)
    except Exception:
        return False


async def _import_one(db, importer, path, o=None, d=None, dep=None):
    with open(path, "rb") as f:
        raw = f.read()
    if _is_standard(path):
        return await importer.import_standard_csv(raw, default_scrape_date=SCRAPE_DATE)
    return await importer.import_csv(raw, o or "DEL", d or "BOM", dep or date(2026, 9, 10), scrape_date=SCRAPE_DATE)


async def main(cli_paths):
    results = []
    async with AsyncSessionLocal() as db:
        importer = GoibiboCsvImporter(db)
        if cli_paths:
            for p in cli_paths:
                try:
                    res = await _import_one(db, importer, p)
                except FileNotFoundError:
                    res = {"status": "MISSING", "path": p}
                except Exception as exc:  # noqa: BLE001
                    res = {"status": "ERROR", "error": str(exc)[:200]}
                results.append({"file": p.split("\\")[-1], **res})
        else:
            for path, o, d, dep in RAW_FILES:
                try:
                    res = await _import_one(db, importer, path, o, d, dep)
                except FileNotFoundError:
                    res = {"status": "MISSING", "path": path}
                except Exception as exc:  # noqa: BLE001
                    res = {"status": "ERROR", "error": str(exc)[:200]}
                results.append({"file": path.split("\\")[-1], **res})
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
