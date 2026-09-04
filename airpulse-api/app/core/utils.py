import hashlib
import json
import math
from datetime import datetime, timezone
from typing import Any, Dict


def utc_now() -> datetime:
    """Returns timezone-aware UTC current time."""
    return datetime.now(timezone.utc)


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
