"""
Concrete Indian airline live collectors.

Each adapter is a thin ``PlaywrightCollector`` bound to its airline key in
``airline_selectors.json``. Selectors and enable/disable flags live in that JSON so the
adapters need no code changes when a portal's DOM shifts.

Airline keys (2026 fleet; Vistara has merged into Air India and is intentionally absent):
  indigo, air_india, air_india_express, akasa_air, spicejet
"""
from __future__ import annotations

from typing import Optional

from app.collectors.airline.playwright_collector import PlaywrightCollector


class IndiGoCollector(PlaywrightCollector):
    def __init__(self, source_id: str, source_name: Optional[str] = None, **kw):
        super().__init__(source_id=source_id, airline_key="indigo", source_name=source_name, **kw)


class AirIndiaCollector(PlaywrightCollector):
    def __init__(self, source_id: str, source_name: Optional[str] = None, **kw):
        super().__init__(source_id=source_id, airline_key="air_india", source_name=source_name, **kw)


class AirIndiaExpressCollector(PlaywrightCollector):
    def __init__(self, source_id: str, source_name: Optional[str] = None, **kw):
        super().__init__(source_id=source_id, airline_key="air_india_express", source_name=source_name, **kw)


class AkasaAirCollector(PlaywrightCollector):
    def __init__(self, source_id: str, source_name: Optional[str] = None, **kw):
        super().__init__(source_id=source_id, airline_key="akasa_air", source_name=source_name, **kw)


class SpiceJetCollector(PlaywrightCollector):
    def __init__(self, source_id: str, source_name: Optional[str] = None, **kw):
        super().__init__(source_id=source_id, airline_key="spicejet", source_name=source_name, **kw)


# Map the seeded source `name` (see scripts/seed_supabase.py) to its adapter class.
AIRLINE_COLLECTORS = {
    "indigo": IndiGoCollector,
    "air_india": AirIndiaCollector,
    "air_india_express": AirIndiaExpressCollector,
    "akasa_air": AkasaAirCollector,
    "spicejet": SpiceJetCollector,
}


def build_airline_collector(source_name: str, source_id: str, **kw) -> Optional[PlaywrightCollector]:
    """Return a live airline collector for a seeded source name, or None if unmapped."""
    cls = AIRLINE_COLLECTORS.get(source_name)
    if cls is None:
        return None
    return cls(source_id=source_id, source_name=source_name, **kw)
