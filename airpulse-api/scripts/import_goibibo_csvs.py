"""Import the manually-scraped Goibibo CSVs as real IMPORTED fare observations.

Usage: python -m scripts.import_goibibo_csvs
Edit FILES below to add more scraped CSVs (route + departure date come from context).
"""
from __future__ import annotations

import asyncio
import json
from datetime import date

from app.db.session import AsyncSessionLocal
from app.services.goibibo_csv_importer import GoibiboCsvImporter

BASE = r"d:\New projects\SIH56"
SCRAPE_DATE = date(2026, 9, 3)  # from filename goibibo-2026-09-03

# (path, origin, destination, departure_date)
FILES = [
    (rf"{BASE}\goibibo-2026-09-03 bom-bengcsv.csv", "BOM", "BLR", date(2026, 9, 10)),
    (rf"{BASE}\goibibo-2026-09-03 new delhi -- ccu.csv", "DEL", "CCU", date(2026, 9, 10)),
    # generic "21)" file: DEL-BOM morning/evening listing
    (rf"{BASE}\goibibo-2026-09-03 21).csv", "DEL", "BOM", date(2026, 9, 10)),
]


async def main():
    results = []
    async with AsyncSessionLocal() as db:
        importer = GoibiboCsvImporter(db)
        for path, o, d, dep in FILES:
            try:
                with open(path, "rb") as f:
                    raw = f.read()
                res = await importer.import_csv(raw, o, d, dep, scrape_date=SCRAPE_DATE)
            except FileNotFoundError:
                res = {"status": "MISSING", "path": path}
            except Exception as exc:  # noqa: BLE001
                res = {"status": "ERROR", "path": path, "error": str(exc)[:200]}
            results.append({"file": path.split("\\")[-1], **res})
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
