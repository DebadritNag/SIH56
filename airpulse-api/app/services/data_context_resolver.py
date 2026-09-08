"""DataContextResolver — canonical Live Mode eligibility and mode determination.

LIVE MODE = LIVE observations + IMPORTED observations (LIVE has priority).
NEVER includes: SYNTHETIC, REPLAY, MODELLED.

Mode determination:
  HYBRID          LIVE > 0 and IMPORTED > 0
  LIVE_DATA       LIVE > 0 and IMPORTED = 0
  IMPORTED_FALLBACK LIVE = 0 and IMPORTED > 0
  EMPTY           LIVE = 0 and IMPORTED = 0

This resolver is the single source of truth for:
  - which data_origin values are eligible
  - what mode label to surface
  - what WHERE clause to apply to any fare query in Live Mode

Do NOT modify data_origin values to force Live Mode — provenance is immutable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ValidatedFare

# Canonical eligible origins for Live Mode — never include SYNTHETIC/REPLAY/MODELLED.
LIVE_MODE_ORIGINS: tuple[str, ...] = ("LIVE", "IMPORTED")


@dataclass
class LiveModeContext:
    """Resolved Live Mode context. Returned by DataContextResolver.resolve()."""

    live_count: int = 0
    imported_count: int = 0
    total_eligible: int = 0

    # Resolved mode
    mode: str = "EMPTY"                 # HYBRID | LIVE_DATA | IMPORTED_FALLBACK | EMPTY
    mode_label: str = "No data"         # Human-readable label shown on badges
    health_badge: Optional[str] = None  # Optional secondary badge e.g. "LIVE SOURCE DEGRADED"

    # Observation metadata
    routes: List[str] = field(default_factory=list)
    booking_windows: List[int] = field(default_factory=list)
    booking_window_buckets: List[str] = field(default_factory=list)   # T+1, T+7 etc.
    historical_days: int = 0
    earliest_departure: Optional[date] = None
    latest_departure: Optional[date] = None
    earliest_collected: Optional[date] = None
    latest_collected: Optional[date] = None

    # Index metadata
    apix_available: bool = False
    apix_count: int = 0
    latest_apix_date: Optional[date] = None

    # Run metadata
    latest_live_collection_id: Optional[str] = None
    latest_live_collection_date: Optional[date] = None
    latest_dataset_import_id: Optional[str] = None
    latest_dataset_import_date: Optional[date] = None
    latest_ingestion_run_id: Optional[str] = None
    latest_pipeline_run_id: Optional[str] = None

    # Benchmark
    dgca_benchmark_available: bool = False
    mospi_cpi_available: bool = False

    def is_populated(self) -> bool:
        return self.total_eligible > 0

    def eligible_origins(self) -> tuple[str, ...]:
        return LIVE_MODE_ORIGINS

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "mode_label": self.mode_label,
            "health_badge": self.health_badge,
            "live_count": self.live_count,
            "imported_count": self.imported_count,
            "total_eligible": self.total_eligible,
            "routes": self.routes,
            "booking_windows": self.booking_windows,
            "booking_window_buckets": self.booking_window_buckets,
            "historical_days": self.historical_days,
            "earliest_departure": str(self.earliest_departure) if self.earliest_departure else None,
            "latest_departure": str(self.latest_departure) if self.latest_departure else None,
            "earliest_collected": str(self.earliest_collected) if self.earliest_collected else None,
            "latest_collected": str(self.latest_collected) if self.latest_collected else None,
            "apix_available": self.apix_available,
            "apix_count": self.apix_count,
            "latest_apix_date": str(self.latest_apix_date) if self.latest_apix_date else None,
            "latest_live_collection_id": self.latest_live_collection_id,
            "latest_live_collection_date": str(self.latest_live_collection_date) if self.latest_live_collection_date else None,
            "latest_dataset_import_id": self.latest_dataset_import_id,
            "latest_dataset_import_date": str(self.latest_dataset_import_date) if self.latest_dataset_import_date else None,
            "latest_ingestion_run_id": self.latest_ingestion_run_id,
            "latest_pipeline_run_id": self.latest_pipeline_run_id,
            "dgca_benchmark_available": self.dgca_benchmark_available,
            "mospi_cpi_available": self.mospi_cpi_available,
            "eligible_origins": list(self.eligible_origins()),
        }


def _bucket_label(days: int) -> str:
    if days <= 2:
        return "T+1"
    elif days <= 10:
        return "T+7"
    elif days <= 20:
        return "T+15"
    elif days <= 35:
        return "T+30"
    return "T+45"


class DataContextResolver:
    """Resolves Live Mode context from the DB.

    Usage:
        resolver = DataContextResolver(db)
        ctx = await resolver.resolve()
        # ctx.mode in ("HYBRID", "LIVE_DATA", "IMPORTED_FALLBACK", "EMPTY")
        # ctx.to_dict() → full status dict for /live-mode/status

    The resolver NEVER reads SYNTHETIC or REPLAY rows.
    """

    def __init__(self, session: AsyncSession):
        self._db = session

    async def resolve(self) -> LiveModeContext:
        ctx = LiveModeContext()

        # ── 1. Fare counts by origin ──────────────────────────────────────────
        counts_res = await self._db.execute(
            select(ValidatedFare.data_origin, func.count(ValidatedFare.id))
            .where(ValidatedFare.data_origin.in_(list(LIVE_MODE_ORIGINS)))
            .group_by(ValidatedFare.data_origin)
        )
        for origin, cnt in counts_res.all():
            if str(origin).upper() == "LIVE":
                ctx.live_count = int(cnt)
            elif str(origin).upper() == "IMPORTED":
                ctx.imported_count = int(cnt)
        ctx.total_eligible = ctx.live_count + ctx.imported_count

        # ── 2. Mode determination ─────────────────────────────────────────────
        if ctx.live_count > 0 and ctx.imported_count > 0:
            ctx.mode = "HYBRID"
            ctx.mode_label = "HYBRID LIVE + IMPORTED"
        elif ctx.live_count > 0:
            ctx.mode = "LIVE_DATA"
            ctx.mode_label = "LIVE DATA"
        elif ctx.imported_count > 0:
            ctx.mode = "IMPORTED_FALLBACK"
            ctx.mode_label = "IMPORTED FALLBACK"
            ctx.health_badge = "LIVE SOURCE DEGRADED"
        else:
            ctx.mode = "EMPTY"
            ctx.mode_label = "No data available"
            return ctx  # Nothing more to compute

        # ── 3. Observation metadata ───────────────────────────────────────────
        meta_res = await self._db.execute(
            select(
                func.min(ValidatedFare.departure_at),
                func.max(ValidatedFare.departure_at),
                func.min(ValidatedFare.collected_at),
                func.max(ValidatedFare.collected_at),
            ).where(ValidatedFare.data_origin.in_(list(LIVE_MODE_ORIGINS)))
        )
        mrow = meta_res.one()
        if mrow[0]:
            ctx.earliest_departure = mrow[0].date()
            ctx.latest_departure = mrow[1].date()
            ctx.earliest_collected = mrow[2].date()
            ctx.latest_collected = mrow[3].date()
            if ctx.earliest_departure and ctx.latest_departure:
                ctx.historical_days = (ctx.latest_departure - ctx.earliest_departure).days + 1

        # ── 4. Routes + booking windows ───────────────────────────────────────
        rw_res = await self._db.execute(
            select(
                ValidatedFare.origin,
                ValidatedFare.destination,
                ValidatedFare.booking_window_days,
                func.count(ValidatedFare.id),
            )
            .where(ValidatedFare.data_origin.in_(list(LIVE_MODE_ORIGINS)))
            .group_by(ValidatedFare.origin, ValidatedFare.destination, ValidatedFare.booking_window_days)
        )
        routes_set: set = set()
        windows_set: set = set()
        buckets_set: set = set()
        for orig, dest, bw, _ in rw_res.all():
            routes_set.add(f"{orig}-{dest}")
            if bw is not None:
                windows_set.add(int(bw))
                buckets_set.add(_bucket_label(int(bw)))
        ctx.routes = sorted(routes_set)
        ctx.booking_windows = sorted(windows_set)
        ctx.booking_window_buckets = sorted(buckets_set, key=lambda b: {"T+1":0,"T+7":1,"T+15":2,"T+30":3,"T+45":4}.get(b, 9))

        # ── 5. APIx metadata ──────────────────────────────────────────────────
        try:
            apix_res = (await self._db.execute(text(
                "SELECT count(*) AS n, max(index_date) AS latest FROM airfare_index WHERE index_type='national'"
            ))).one()
            ctx.apix_count = int(apix_res[0] or 0)
            ctx.apix_available = ctx.apix_count > 0
            ctx.latest_apix_date = apix_res[1]
        except Exception:
            pass

        # ── 6. Run metadata ───────────────────────────────────────────────────
        try:
            live_run = (await self._db.execute(text(
                "SELECT id, created_at::date FROM collection_runs "
                "WHERE run_type='LIVE_ACQUISITION' ORDER BY created_at DESC LIMIT 1"
            ))).first()
            if live_run:
                ctx.latest_live_collection_id = str(live_run[0])
                ctx.latest_live_collection_date = live_run[1]
        except Exception:
            pass

        try:
            import_run = (await self._db.execute(text(
                "SELECT id, created_at::date FROM collection_runs "
                "WHERE data_origin='IMPORTED' ORDER BY created_at DESC LIMIT 1"
            ))).first()
            if import_run:
                ctx.latest_dataset_import_id = str(import_run[0])
                ctx.latest_dataset_import_date = import_run[1]
        except Exception:
            pass

        try:
            pipe_run = (await self._db.execute(text(
                "SELECT id FROM pipeline_runs ORDER BY created_at DESC LIMIT 1"
            ))).first()
            if pipe_run:
                ctx.latest_pipeline_run_id = str(pipe_run[0])
        except Exception:
            pass

        # ── 7. Benchmark availability ─────────────────────────────────────────
        try:
            bench = (await self._db.execute(text(
                "SELECT benchmark_type, count(*) FROM benchmark_fares GROUP BY benchmark_type"
            ))).all()
            for btype, cnt in bench:
                if "dgca" in str(btype).lower():
                    ctx.dgca_benchmark_available = int(cnt) > 0
                elif "mospi" in str(btype).lower() or "cpi" in str(btype).lower():
                    ctx.mospi_cpi_available = int(cnt) > 0
        except Exception:
            pass

        return ctx
