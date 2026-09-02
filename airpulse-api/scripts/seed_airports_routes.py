import asyncio
import sys
import os
from uuid import uuid4

# Ensure path is included
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.models import Airport, Base, Route
from app.db.session import AsyncSessionLocal, engine
from app.core.utils import haversine_distance_km

AIRPORTS_DATA = [
    {"iata": "DEL", "name": "Indira Gandhi International Airport", "city": "Delhi", "state": "Delhi", "lat": 28.5562, "lon": 77.1000},
    {"iata": "BOM", "name": "Chhatrapati Shivaji Maharaj International Airport", "city": "Mumbai", "state": "Maharashtra", "lat": 19.0896, "lon": 72.8656},
    {"iata": "BLR", "name": "Kempegowda International Airport", "city": "Bengaluru", "state": "Karnataka", "lat": 13.1986, "lon": 77.7066},
    {"iata": "HYD", "name": "Rajiv Gandhi International Airport", "city": "Hyderabad", "state": "Telangana", "lat": 17.2403, "lon": 78.4294},
    {"iata": "CCU", "name": "Netaji Subhash Chandra Bose International Airport", "city": "Kolkata", "state": "West Bengal", "lat": 22.6547, "lon": 88.4467},
    {"iata": "MAA", "name": "Chennai International Airport", "city": "Chennai", "state": "Tamil Nadu", "lat": 12.9941, "lon": 80.1709},
    {"iata": "AMD", "name": "Sardar Vallabhbhai Patel International Airport", "city": "Ahmedabad", "state": "Gujarat", "lat": 23.0734, "lon": 72.6347},
    {"iata": "GOI", "name": "Dabolim Airport", "city": "Goa", "state": "Goa", "lat": 15.3808, "lon": 73.8314},
    {"iata": "PNQ", "name": "Pune Airport", "city": "Pune", "state": "Maharashtra", "lat": 18.5822, "lon": 73.9197},
    {"iata": "JAI", "name": "Jaipur International Airport", "city": "Jaipur", "state": "Rajasthan", "lat": 26.8242, "lon": 75.8122},
    {"iata": "COK", "name": "Cochin International Airport", "city": "Kochi", "state": "Kerala", "lat": 10.1556, "lon": 76.4019},
    {"iata": "LKO", "name": "Chaudhary Charan Singh International Airport", "city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.7606, "lon": 80.8893},
    {"iata": "GAU", "name": "Lokpriya Gopinath Bordoloi International Airport", "city": "Guwahati", "state": "Assam", "lat": 26.1061, "lon": 91.5859},
    {"iata": "PAT", "name": "Jay Prakash Narayan Airport", "city": "Patna", "state": "Bihar", "lat": 25.5913, "lon": 85.0880},
    {"iata": "BBI", "name": "Biju Patnaik Airport", "city": "Bhubaneswar", "state": "Odisha", "lat": 20.2444, "lon": 85.8178},
]

ROUTE_CORRIDORS = [
    ("DEL", "BOM", 0.12),
    ("BOM", "DEL", 0.12),
    ("BLR", "DEL", 0.08),
    ("DEL", "BLR", 0.08),
    ("BOM", "BLR", 0.07),
    ("BLR", "BOM", 0.07),
    ("DEL", "CCU", 0.06),
    ("CCU", "DEL", 0.06),
    ("DEL", "HYD", 0.05),
    ("HYD", "DEL", 0.05),
    ("BOM", "MAA", 0.04),
    ("MAA", "BOM", 0.04),
    ("DEL", "AMD", 0.03),
    ("AMD", "DEL", 0.03),
    ("BOM", "GOI", 0.04),
    ("GOI", "BOM", 0.04),
    ("BLR", "HYD", 0.03),
    ("HYD", "BLR", 0.03),
    ("DEL", "PNQ", 0.03),
    ("PNQ", "DEL", 0.03),
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        airport_map = {}
        for a in AIRPORTS_DATA:
            airport = Airport(
                id=uuid4(),
                iata_code=a["iata"],
                name=a["name"],
                city=a["city"],
                state=a["state"],
                latitude=a["lat"],
                longitude=a["lon"],
                active=True,
            )
            session.add(airport)
            airport_map[a["iata"]] = a

        for orig, dest, wt in ROUTE_CORRIDORS:
            orig_data = airport_map[orig]
            dest_data = airport_map[dest]
            dist = haversine_distance_km(
                orig_data["lat"], orig_data["lon"], dest_data["lat"], dest_data["lon"]
            )
            # Market code: sorted endpoints
            market = "-".join(sorted([orig, dest]))
            route = Route(
                id=uuid4(),
                origin_code=orig,
                destination_code=dest,
                route_code=f"{orig}-{dest}",
                market_code=market,
                distance_km=dist,
                domestic=True,
                active=True,
                weight=wt,
            )
            session.add(route)

        await session.commit()
        print(f"Successfully seeded {len(AIRPORTS_DATA)} airports and {len(ROUTE_CORRIDORS)} directional routes.")


if __name__ == "__main__":
    asyncio.run(seed())
