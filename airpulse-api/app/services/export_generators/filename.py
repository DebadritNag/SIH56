import re
from datetime import datetime, timezone
from typing import Optional


def sanitize_slug(text: str) -> str:
    """Lowercase, strip non-alphanumeric except hyphen, collapse multiple hyphens."""
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower())
    return re.sub(r"-+", "-", slug).strip("-")


def generate_export_filename(
    export_type: str,
    format_ext: str,
    route: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    quarter: Optional[str] = None,
) -> str:
    """
    Generate backend-safe institutional filenames.
    Rules: lowercase, hyphen-separated, no spaces, ISO dates, correct extension.
    Examples:
      airpulse-fares-del-bom-2026-08-01_2026-09-02.csv
      airpulse-apix-components-2026-09-02.xlsx
      airpulse-backtest-dossier-2026-q3.pdf
      airpulse-anomalies-2026-09-02.csv
      airpulse-route-del-bom-2026-09-02.pdf
    """
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    ext = format_ext.lower().lstrip(".")

    type_slug = sanitize_slug(export_type)

    if type_slug == "fare-observations":
        route_str = f"-{sanitize_slug(route)}" if route else ""
        period_str = f"-{date_from}_{date_to}" if date_from and date_to else f"-{today_str}"
        return f"airpulse-fares{route_str}{period_str}.{ext}"

    elif type_slug == "apix-components":
        return f"airpulse-apix-components-{today_str}.{ext}"

    elif type_slug == "apix-index":
        return f"airpulse-apix-index-{today_str}.{ext}"

    elif type_slug in ("backtest-audit-pdf", "backtest-audit"):
        q_str = f"-{sanitize_slug(quarter)}" if quarter else f"-{now.strftime('%Y-q%q' if hasattr(now, 'q') else '%Y')}"
        return f"airpulse-backtest-dossier{q_str}.{ext}"

    elif type_slug == "backtest-data":
        return f"airpulse-backtest-data-{today_str}.{ext}"

    elif type_slug == "anomalies":
        return f"airpulse-anomalies-{today_str}.{ext}"

    elif type_slug == "route-intelligence":
        route_str = f"-{sanitize_slug(route)}" if route else ""
        return f"airpulse-route{route_str}-{today_str}.{ext}"

    elif type_slug == "source-health":
        return f"airpulse-sources-health-{today_str}.{ext}"

    elif type_slug == "methodology-report":
        return f"airpulse-methodology-v1.2-{today_str}.{ext}"

    elif type_slug == "provenance-report":
        return f"airpulse-provenance-audit-{today_str}.{ext}"

    elif type_slug == "system-diagnostics-report":
        return f"airpulse-system-diagnostics-{today_str}.{ext}"

    elif type_slug == "basket-definition":
        return f"airpulse-basket-weights-{today_str}.{ext}"

    elif type_slug == "chart-image":
        return f"airpulse-chart-{today_str}.{ext}"

    else:
        return f"airpulse-{type_slug}-{today_str}.{ext}"
