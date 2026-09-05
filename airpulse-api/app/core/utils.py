import hashlib
import json
import math
from datetime import date, datetime, timezone
from typing import Any, Dict, Tuple, Union


def utc_now() -> datetime:
    """Returns timezone-aware UTC current time."""
    return datetime.now(timezone.utc)


def bucket_from_lead_days(lead_days: int) -> str:
    """Canonical mapping from lead days to supported booking window bucket."""
    if lead_days <= 2:
        return "T+1"
    elif lead_days <= 10:
        return "T+7"
    elif lead_days <= 20:
        return "T+15"
    elif lead_days <= 37:
        return "T+30"
    else:
        return "T+45"


def calculate_booking_window(
    departure_date: Union[date, datetime, str],
    observed_at: Union[date, datetime, str],
) -> Tuple[int, str]:
    """Deterministically derives (actual_lead_days, booking_window_bucket).
    departure_date minus observed_at.
    Returns:
        (actual_lead_days: int, booking_window_bucket: str) e.g. (1, 'T+1').
    """
    if isinstance(departure_date, str):
        # Support both 'YYYY-MM-DD' and full ISO timestamp strings
        if "T" in departure_date or " " in departure_date:
            departure_date = datetime.fromisoformat(departure_date.replace("Z", "+00:00")).date()
        else:
            departure_date = date.fromisoformat(departure_date)
    elif isinstance(departure_date, datetime):
        departure_date = departure_date.date()

    if isinstance(observed_at, str):
        if "T" in observed_at or " " in observed_at:
            observed_at = datetime.fromisoformat(observed_at.replace("Z", "+00:00")).date()
        else:
            observed_at = date.fromisoformat(observed_at)
    elif isinstance(observed_at, datetime):
        observed_at = observed_at.date()

    lead_days = max(0, (departure_date - observed_at).days)
    bucket = bucket_from_lead_days(lead_days)
    return lead_days, bucket


def compute_sha256(content: str) -> str:
    """Computes SHA-256 hash string of utf-8 text."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def compute_payload_hash(payload: Dict[str, Any]) -> str:
    """Computes deterministic SHA-256 hash of a JSON payload dictionary."""
    normalized_json = json.dumps(payload, sort_keys=True, default=str)
    return compute_sha256(normalized_json)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great circle distance in km between two lat/lon coordinates."""
    r = 6371.0  # Earth's radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def is_memory_constrained() -> bool:
    """Returns True if running in a memory-constrained container (e.g. Render 512MB tier)
    where spawning a full headless Chromium browser process would trigger an OOM-killer (exit 137)."""
    import os

    # 1. Explicit override to force browser execution if desired
    if os.environ.get("ALLOW_HEAVY_BROWSER", "").lower() in ("true", "1", "yes"):
        return False

    # 2. Check explicit environment flags (Render sets RENDER=true automatically)
    if os.environ.get("RENDER") or os.environ.get("MEMORY_CONSTRAINED", "").lower() in ("true", "1", "yes"):
        return True

    # 3. Check cgroups v1 / v2 memory limit on Linux
    for cgroup_file in (
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
    ):
        if os.path.exists(cgroup_file):
            try:
                with open(cgroup_file, "r") as f:
                    val = f.read().strip()
                    if val and val != "max":
                        limit_bytes = int(val)
                        if limit_bytes <= 805306368:  # <= 768MB
                            return True
            except Exception:
                pass

    # 4. Check /proc/meminfo total RAM
    if os.path.exists("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            kb = int(parts[1])
                            if kb <= 786432:  # <= 768MB
                                return True
        except Exception:
            pass

    return False
