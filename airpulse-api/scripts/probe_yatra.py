"""One controlled monetary-fare probe. Never writes canonical analytical data.

Run from airpulse-api with YATRA_PROTOTYPE_ENABLED and YATRA_REVIEW_NOTES
explicitly configured after review. Output contains no response headers/cookies.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone

from app.services.live_scraper import LiveScraper


async def main():
    result = await LiveScraper().run(
        source_name="Yatra", source_type="ota", origin="DEL", destination="BOM",
        departure=datetime.now(timezone.utc).date() + timedelta(days=7),
        booking_window_days=7, engine="AUTO", max_results=10,
    )
    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
