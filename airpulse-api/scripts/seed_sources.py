import asyncio
import sys
import os
from uuid import uuid4

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.models import Source
from app.db.session import AsyncSessionLocal

SOURCES_DATA = [
    {"name": "IndiGo Direct", "type": "airline", "method": "api", "url": "https://api.goindigo.in", "score": 0.98},
    {"name": "Air India Direct", "type": "airline", "method": "api", "url": "https://api.airindia.com", "score": 0.95},
    {"name": "MakeMyTrip OTA", "type": "ota", "method": "api", "url": "https://api.makemytrip.com", "score": 0.94},
    {"name": "EaseMyTrip OTA", "type": "ota", "method": "api", "url": "https://api.easemytrip.com", "score": 0.92},
]


async def seed_sources():
    async with AsyncSessionLocal() as session:
        for s in SOURCES_DATA:
            src = Source(
                id=uuid4(),
                name=s["name"],
                source_type=s["type"],
                base_url=s["url"],
                active=True,
                collection_method=s["method"],
                max_requests_per_minute=120,
                reliability_score=s["score"],
            )
            session.add(src)
        await session.commit()
        print(f"Successfully seeded {len(SOURCES_DATA)} sources.")


if __name__ == "__main__":
    asyncio.run(seed_sources())
