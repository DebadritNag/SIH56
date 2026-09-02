"""
Idempotent seed script for the Supabase-aligned AirPulse schema.

Seeds:
  * 15 domestic airports (DEL, BOM, BLR, CCU, HYD, MAA, GOI, AMD, COK, PNQ, LKO, JAI, GAU, PAT, BBI)
  * directional routes among the 8 busiest hubs (both directions kept separate)
  * 2026 sources (IndiGo, Air India, Air India Express, Akasa Air, SpiceJet) + generic OTAs
    + government (MoSPI eSankhyiki, DGCA) + replay + synthetic

Run:
    python scripts/seed_supabase.py

Uses the async SQLAlchemy engine (DATABASE_URL). Safe to run repeatedly — all inserts
use ON CONFLICT DO NOTHING semantics via unique keys.
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.utils import haversine_distance_km
from app.db.enums import CollectionMethod, SourceType
from app.db.schema import Airport, Route, Source
from app.db.session import AsyncSessionLocal

AIRPORTS = [
    ("DEL", "Indira Gandhi International Airport", "New Delhi", "Delhi", 28.5562, 77.1003),
    ("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "Maharashtra", 19.0887, 72.8679),
    ("BLR", "Kempegowda International Airport", "Bengaluru", "Karnataka", 13.1997, 77.7106),
    ("CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata", "West Bengal", 22.6547, 88.4467),
    ("HYD", "Rajiv Gandhi International Airport", "Hyderabad", "Telangana", 17.2404, 78.4294),
    ("MAA", "Chennai International Airport", "Chennai", "Tamil Nadu", 12.9941, 80.1807),
    ("GOI", "Dabolim Airport", "Goa", "Goa", 15.3808, 73.8314),
    ("AMD", "Sardar Vallabhbhai Patel International Airport", "Ahmedabad", "Gujarat", 23.0772, 72.6347),
    ("COK", "Cochin International Airport", "Kochi", "Kerala", 10.1520, 76.4019),
    ("PNQ", "Pune Airport", "Pune", "Maharashtra", 18.5821, 73.9197),
    ("LKO", "Chaudhary Charan Singh International Airport", "Lucknow", "Uttar Pradesh", 26.7606, 80.8893),
    ("JAI", "Jaipur International Airport", "Jaipur", "Rajasthan", 26.8242, 75.8122),
    ("GAU", "Lokpriya Gopinath Bordoloi International Airport", "Guwahati", "Assam", 26.1061, 91.5859),
    ("PAT", "Jay Prakash Narayan Airport", "Patna", "Bihar", 25.5913, 85.0880),
    ("BBI", "Biju Patnaik International Airport", "Bhubaneswar", "Odisha", 20.2444, 85.8177),
]

HUB_CODES = ["DEL", "BOM", "BLR", "CCU", "HYD", "MAA", "GOI", "AMD"]

SOURCES = [
    ("indigo", "IndiGo", SourceType.AIRLINE, CollectionMethod.PLAYWRIGHT, "https://www.goindigo.in", False, True, 10, 0.95),
    ("air_india", "Air India", SourceType.AIRLINE, CollectionMethod.PLAYWRIGHT, "https://www.airindia.com", False, True, 20, 0.92),
    ("air_india_express", "Air India Express", SourceType.AIRLINE, CollectionMethod.PLAYWRIGHT, "https://www.airindiaexpress.com", False, True, 30, 0.90),
    ("akasa_air", "Akasa Air", SourceType.AIRLINE, CollectionMethod.PLAYWRIGHT, "https://www.akasaair.com", False, True, 40, 0.90),
    ("spicejet", "SpiceJet", SourceType.AIRLINE, CollectionMethod.PLAYWRIGHT, "https://www.spicejet.com", False, True, 50, 0.88),
    ("ota_source_01", "OTA Source 01", SourceType.OTA, CollectionMethod.HTTP, None, False, False, 60, 0.93),
    ("ota_source_02", "OTA Source 02", SourceType.OTA, CollectionMethod.HTTP, None, False, False, 70, 0.91),
    ("ota_source_03", "OTA Source 03", SourceType.OTA, CollectionMethod.PLAYWRIGHT, None, False, True, 80, 0.89),
    ("mospi_esankhyiki", "MoSPI eSankhyiki", SourceType.GOVERNMENT_API, CollectionMethod.API, "https://esankhyiki.mospi.gov.in", True, False, 90, 0.99),
    ("dgca", "DGCA", SourceType.GOVERNMENT_FILE, CollectionMethod.FILE, "https://www.dgca.gov.in", True, False, 95, 0.99),
    ("replay", "Replay Fixtures", SourceType.REPLAY, CollectionMethod.REPLAY, None, True, False, 200, 1.0),
    ("synthetic", "Synthetic Generator", SourceType.SYNTHETIC, CollectionMethod.SYNTHETIC, None, True, False, 210, 1.0),
]


async def seed_airports(session) -> dict[str, Airport]:
    existing = {a.iata_code: a for a in (await session.execute(select(Airport))).scalars()}
    for code, name, city, state, lat, lon in AIRPORTS:
        if code in existing:
            continue
        airport = Airport(iata_code=code, name=name, city=city, state=state, latitude=lat, longitude=lon)
        session.add(airport)
        existing[code] = airport
    await session.flush()
    return existing


async def seed_routes(session, airports: dict[str, Airport]) -> int:
    existing_codes = set((await session.execute(select(Route.route_code))).scalars())
    created = 0
    for o in HUB_CODES:
        for d in HUB_CODES:
            if o == d:
                continue
            route_code = f"{o}-{d}"
            if route_code in existing_codes:
                continue
            oa, da = airports[o], airports[d]
            market = f"{min(o, d)}-{max(o, d)}"
            distance = haversine_distance_km(
                float(oa.latitude), float(oa.longitude), float(da.latitude), float(da.longitude)
            )
            session.add(
                Route(
                    origin_airport_id=oa.id,
                    destination_airport_id=da.id,
                    route_code=route_code,
                    market_code=market,
                    distance_km=distance,
                    active=True,
                )
            )
            created += 1
    await session.flush()
    return created


async def seed_sources(session) -> int:
    existing = set((await session.execute(select(Source.name))).scalars())
    created = 0
    for name, display, stype, method, url, live, needs_js, priority, reliability in SOURCES:
        if name in existing:
            continue
        session.add(
            Source(
                name=name,
                display_name=display,
                source_type=stype,
                collection_method=method,
                base_url=url,
                enabled=True,
                active=True,
                supports_live_collection=live,
                requires_javascript=needs_js,
                rate_limit_per_minute=60 if stype in (SourceType.AIRLINE, SourceType.OTA) else 30,
                priority=priority,
                reliability_score=reliability,
                collector_version="1.0.0",
                parser_version="1.0.0",
            )
        )
        created += 1
    await session.flush()
    return created


async def main() -> None:
    async with AsyncSessionLocal() as session:
        airports = await seed_airports(session)
        routes_created = await seed_routes(session, airports)
        sources_created = await seed_sources(session)
        await session.commit()
        print(f"Airports present: {len(airports)}")
        print(f"Routes created this run: {routes_created}")
        print(f"Sources created this run: {sources_created}")


if __name__ == "__main__":
    asyncio.run(main())
