"""Enable the operator-requested bounded prototype without printing credentials."""
from pathlib import Path


def enable(path):
    settings = {
        'CRAWL4AI_ENABLED': 'true',
        'HAPPYFARES_PROTOTYPE_ENABLED': 'true',
        'HAPPYFARES_REVIEW_NOTES': 'Operator-authorized bounded HappyFares public-page prototype; robots.txt checked during local testing; stop on access challenges; no bypass; maximum 15 fares; staging only until explicit ingestion.',
        'CRAWL4AI_BROWSER_CONCURRENCY': '1',
        'CRAWL4AI_DEFAULT_MAX_RESULTS': '5',
    }
    original = path.read_text(encoding='utf-8') if path.exists() else ''
    lines, seen = [], set()
    for line in original.splitlines():
        key = line.split('=', 1)[0].strip()
        if key in settings:
            if key not in seen:
                lines.append(f'{key}={settings[key]}')
                seen.add(key)
        else:
            lines.append(line)
    lines.extend(f'{key}={value}' for key, value in settings.items() if key not in seen)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('HappyFares enabled in .env. Other settings preserved. Recreate API and worker to apply.')


if __name__ == '__main__':
    enable(Path(__file__).resolve().parents[1] / '.env')
