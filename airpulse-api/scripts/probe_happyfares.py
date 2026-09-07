"""One bounded source test; writes local evidence only, never database records."""
import asyncio
import argparse
import json
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from app.config import settings
from app.scraping.happyfares_browser import collect

async def main(args):
    settings.HAPPYFARES_PROTOTYPE_ENABLED = True
    settings.HAPPYFARES_REVIEW_NOTES = 'User-requested single public-page PoC; robots checked; no recurring permission established.'
    result = await collect(args.origin,args.destination,args.departure,limit=args.limit)
    target = Path('scratch/happyfares-probe.json')
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='quotes'}))
    print('Validated quotes:', len(result['quotes']))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin',default='DEL')
    parser.add_argument('--destination',default='BOM')
    parser.add_argument('--departure',type=date.fromisoformat,default=datetime.now(timezone.utc).date()+timedelta(days=7))
    parser.add_argument('--limit',type=int,choices=[5,10,15],default=5)
    asyncio.run(main(parser.parse_args()))
