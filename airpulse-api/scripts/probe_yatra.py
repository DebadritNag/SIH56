"""One controlled monetary-fare probe. Never writes canonical analytical data.

Run from airpulse-api with YATRA_PROTOTYPE_ENABLED and YATRA_REVIEW_NOTES
explicitly configured after review. Output contains no response headers/cookies.
"""
import asyncio
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from app.services.live_scraper import LiveScraper
from app.config import settings


async def main(args):
    departure = args.departure or datetime.now(timezone.utc).date() + timedelta(days=7)
    if departure < datetime.now(timezone.utc).date():
        raise ValueError('Departure must not be in the past')
    if args.evidence:
        settings.YATRA_SAVE_DIAGNOSTICS = True
    result = await LiveScraper().run(
        source_name="Yatra", source_type="ota", origin=args.origin, destination=args.destination,
        departure=departure,
        booking_window_days=(departure-datetime.now(timezone.utc).date()).days,
        engine="AUTO", max_results=args.limit,
    )
    output = json.dumps(result, default=str, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding='utf-8')
        print(json.dumps({k: result.get(k) for k in (
            'status', 'failure_stage', 'failure_reason', 'quotes_found', 'duration_ms', 'metadata'
        )}, default=str, indent=2))
        print(f'Evidence saved: {args.output.resolve()}')
    else:
        print(output)
    return 0 if result.get('quotes') else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run one real Yatra search; no retry or fallback.')
    parser.add_argument('--origin', default='DEL')
    parser.add_argument('--destination', default='BOM')
    parser.add_argument('--departure', type=date.fromisoformat)
    parser.add_argument('--limit', type=int, choices=[5, 10, 15], default=5)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--evidence', action='store_true', help='Save failed page HTML and screenshot locally')
    raise SystemExit(asyncio.run(main(parser.parse_args())))
