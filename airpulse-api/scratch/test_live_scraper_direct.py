import asyncio
import sys
import time
from datetime import date, timedelta

async def test():
    from app.services.live_scraper import get_live_scraper
    scraper = get_live_scraper()
    t0 = time.time()
    res = await scraper.run(
        source_name="IndiGo Direct",
        source_type="airline",
        origin="DEL",
        destination="BOM",
        engine="PLAYWRIGHT",
        max_results=15,
    )
    elapsed = time.time() - t0
    print(f"Elapsed: {elapsed:.2f}s")
    print(f"Status: {res.get('status')}")
    print(f"Quotes found: {res.get('quotes_found')}")
    print(f"Quotes validated: {res.get('quotes_validated')}")
    print(f"Stop reason: {res.get('stop_reason')}")
    print(f"Results seen: {res.get('results_seen')}")
    print(f"Results matching: {res.get('results_matching')}")
    print(f"Collector version: {res.get('collector_version')}")
    for s in res.get("stages", []):
        msg = f"  [{s.get('status')}] {s.get('stage')}: {s.get('detail')}"
        print(msg.encode("ascii", "replace").decode())
    if res.get("quotes"):
        print("Sample quotes:")
        for q in res.get("quotes")[:3]:
            line = f"  {q['carrier']} {q['flight_no']} | {q['departure_time']} -> {q['arrival_time']} | INR {q['gross_total']}"
            print(line.encode("ascii", "replace").decode())

if __name__ == "__main__":
    asyncio.run(test())
