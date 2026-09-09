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
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ValidatedFare

# Canonical eligible origins for Live Mode — never include SYNTHETIC/REPLAY/MODELLED.
LIVE_MODE_ORIGINS: tuple[str, ...] = ("LIVE", "IMPORTED")
LIVE_FARE_SQL = "data_origin IN ('LIVE','IMPORTED') AND validation_status='VALID' AND NOT is_duplicate"

def live_fare_predicate():
    return (ValidatedFare.data_origin.in_(LIVE_MODE_ORIGINS) &
            (ValidatedFare.validation_status == 'VALID') & ~ValidatedFare.is_duplicate)

def resolve_mode(live, imported):
    if live and imported:
        return 'HYBRID', 'HYBRID LIVE + IMPORTED'
    if live:
        return 'LIVE_DATA', 'LIVE DATA'
    if imported:
        return 'IMPORTED_FALLBACK', 'IMPORTED FALLBACK'
    return 'EMPTY', 'No data available'



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
    latest_observed_at: Optional[datetime] = None
    latest_ingested_at: Optional[datetime] = None
    latest_apix_computed_at: Optional[datetime] = None
    latest_live_collection_status: Optional[str] = None
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
            "latest_observed_at": str(self.latest_observed_at) if self.latest_observed_at else None,
            "latest_ingested_at": str(self.latest_ingested_at) if self.latest_ingested_at else None,
            "latest_apix_computed_at": str(self.latest_apix_computed_at) if self.latest_apix_computed_at else None,
            "latest_live_collection_status": self.latest_live_collection_status,
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
        from app.services.live_store import rows
        ctx = LiveModeContext()
        counts = await rows(self._db, f"SELECT data_origin,count(*) AS n FROM validated_fares WHERE {LIVE_FARE_SQL} GROUP BY data_origin")
        for row in counts:
            if row['data_origin'] == 'LIVE': ctx.live_count = row['n']
            if row['data_origin'] == 'IMPORTED': ctx.imported_count = row['n']
        ctx.total_eligible = ctx.live_count + ctx.imported_count
        ctx.mode, ctx.mode_label = resolve_mode(ctx.live_count, ctx.imported_count)
        if ctx.mode == 'IMPORTED_FALLBACK': ctx.health_badge = 'LIVE SOURCE DEGRADED'
        meta = (await rows(self._db, f"""SELECT min(departure_at) AS dep_min,max(departure_at) AS dep_max,
            min(collected_at) AS obs_min,max(collected_at) AS obs_max,max(created_at) AS ingested,
            count(DISTINCT (collected_at AT TIME ZONE 'UTC')::date) AS days
            FROM validated_fares WHERE {LIVE_FARE_SQL}"""))[0]
        ctx.historical_days = meta['days']
        ctx.earliest_departure = meta['dep_min'].date() if meta['dep_min'] else None
        ctx.latest_departure = meta['dep_max'].date() if meta['dep_max'] else None
        ctx.earliest_collected = meta['obs_min'].date() if meta['obs_min'] else None
        ctx.latest_collected = meta['obs_max'].date() if meta['obs_max'] else None
        ctx.latest_observed_at, ctx.latest_ingested_at = meta['obs_max'], meta['ingested']
        coverage = await rows(self._db, f"SELECT DISTINCT origin,destination,booking_window_days FROM validated_fares WHERE {LIVE_FARE_SQL}")
        ctx.routes = sorted({f"{r['origin']}-{r['destination']}" for r in coverage})
        ctx.booking_windows = sorted({r['booking_window_days'] for r in coverage if r['booking_window_days'] is not None})
        ctx.booking_window_buckets = sorted({_bucket_label(d) for d in ctx.booking_windows}, key=lambda b:int(b[2:]))
        indices = (await rows(self._db, """SELECT count(*) AS n,max(index_date) AS latest,max(calculated_at) AS computed
            FROM airfare_index WHERE index_type='national' AND methodology_version='apix-live-matched-v1'"""))[0]
        ctx.apix_count, ctx.latest_apix_date = indices['n'], indices['latest']
        ctx.apix_available = bool(ctx.apix_count)
        ctx.latest_apix_computed_at = indices['computed']
        live = await rows(self._db, "SELECT id,created_at,status FROM collection_runs WHERE data_origin='LIVE' AND run_type='LIVE_ACQUISITION' ORDER BY created_at DESC LIMIT 1")
        if live:
            ctx.latest_live_collection_id, ctx.latest_live_collection_date = str(live[0]['id']), live[0]['created_at'].date()
            ctx.latest_live_collection_status = live[0]['status']
        imported = await rows(self._db, """SELECT id,created_at FROM collection_runs WHERE data_origin='IMPORTED'
            AND COALESCE(metadata->>'original_filename','') != 'existing-observations'
            AND run_type != 'REPLAY' ORDER BY created_at DESC LIMIT 1""")
        if imported:
            ctx.latest_dataset_import_id, ctx.latest_dataset_import_date = str(imported[0]['id']), imported[0]['created_at'].date()
        ingestion = await rows(self._db, """SELECT id FROM collection_runs WHERE data_origin IN ('LIVE','IMPORTED')
            AND run_type='INGESTION' ORDER BY created_at DESC LIMIT 1""")
        if ingestion: ctx.latest_ingestion_run_id = str(ingestion[0]['id'])
        pipeline = await rows(self._db, """SELECT p.id FROM pipeline_runs p JOIN collection_runs c ON c.id=p.collection_run_id
            WHERE c.data_origin IN ('LIVE','IMPORTED') AND c.run_type != 'REPLAY' ORDER BY p.created_at DESC LIMIT 1""")
        if pipeline: ctx.latest_pipeline_run_id = str(pipeline[0]['id'])
        # A dataset must be verified before its benchmark can be advertised.
        benchmarks = await rows(self._db, """SELECT DISTINCT b.benchmark_type FROM benchmark_fares b
            JOIN reference_datasets d ON d.id=b.reference_dataset_id
            WHERE d.metadata->>'verified'='true' AND d.status IN ('SYNCED','VERIFIED')""")
        ctx.dgca_benchmark_available = any('dgca' in r['benchmark_type'].lower() for r in benchmarks)
        ctx.mospi_cpi_available = any('cpi' in r['benchmark_type'].lower() for r in benchmarks)
        return ctx
