"""
AirPulse Scraping Subsystem.
Modular dual-engine architecture supporting Scrapy (HTTP/server-rendered)
and Playwright (client-side JS rendering) via a deterministic Engine Resolver.
"""
from app.core.enums import CollectionEngine, EngineOutcome

__all__ = ["CollectionEngine", "EngineOutcome"]
