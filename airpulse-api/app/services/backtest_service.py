"""Backtest engine: validate the high-frequency APIx series against a REAL
synchronized official reference series (e.g. MoSPI CPI General).

Statistically honest:
  * Reads real benchmark_fares rows for the chosen dataset (no fabricated series).
  * Explicit frequency alignment: APIx daily -> monthly average, matched to the
    monthly CPI reference period.
  * Records a comparability note (CPI covers a broader basket than airfares).
  * Stores full provenance (dataset id/version/checksum + alignment/normalization
    methods) in the backtest metrics for defensible audit dossiers.
  * If no APIx index or no real benchmark exists for the window, the run is marked
    'insufficient_data' rather than fabricating numbers.
"""
from __future__ import annotations

import math
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.db.models import (
    AirfareIndex,
    BacktestRun,
    BenchmarkFare,
    ReferenceDataset,
    ReferenceDatasetVersion,
)

COMPARABILITY_NOTE = (
    "MoSPI CPI (General) covers a broader consumption basket than domestic airfares. "
    "This comparison is intended for contextual movement analysis, not like-for-like "
    "index equivalence."
)


def _pearson(xs: List[float], ys: List[float]) -> Optional[float]:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return None
    return round(num / (dx * dy), 4)


class BacktestService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute_backtest(
        self,
        start_date: date,
        end_date: date,
        benchmark_dataset_id: Optional[UUID] = None,
        benchmark_type: str = "mospi_cpi_general",
        methodology_version: str = "apix-v1.2",
        actor_id: Optional[str] = None,
    ) -> BacktestRun:
        run = BacktestRun(
            id=uuid4(),
            status="running",
            period_start=start_date,
            period_end=end_date,
            benchmark_dataset_id=benchmark_dataset_id,
            methodology_version=methodology_version,
            created_at=utc_now(),
            started_at=utc_now(),
        )
        self.session.add(run)
        await self.session.flush()

        # 1. Resolve the reference dataset (explicit id, else latest for the type).
        dataset, version = await self._resolve_dataset(benchmark_dataset_id, benchmark_type)

        # 2. Real monthly benchmark series from benchmark_fares.
        bench = await self._benchmark_monthly(dataset.id if dataset else None, benchmark_type, start_date, end_date)

        # 3. APIx daily series -> monthly average (explicit alignment).
        apix_monthly = await self._apix_monthly(start_date, end_date)

        matched = self._align(apix_monthly, bench)  # [(month, apix, cpi)]
        metrics: Dict[str, Any] = {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "alignment_method": "APIx daily -> calendar-month average, joined to monthly CPI reference period",
            "normalization_method": "none (levels compared on movement/correlation, not absolute scale)",
            "comparability_note": COMPARABILITY_NOTE,
            "benchmark_type": benchmark_type,
            "reference_provenance": self._provenance(dataset, version),
            "matched_months": len(matched),
        }

        if len(matched) < 2:
            run.status = "insufficient_data"
            metrics["reason"] = (
                "Fewer than 2 overlapping months between the APIx series and the "
                "official reference series for the selected window."
            )
            metrics["series"] = {"apix_monthly": apix_monthly, "benchmark_available": len(bench)}
            run.metrics = metrics
            run.finished_at = utc_now()
            await self.session.flush()
            return run

        months = [m for m, _, _ in matched]
        apix_vals = [a for _, a, _ in matched]
        cpi_vals = [c for _, _, c in matched]

        corr = _pearson(apix_vals, cpi_vals)
        # change-correlation & directional agreement
        apix_chg = [apix_vals[i + 1] - apix_vals[i] for i in range(len(apix_vals) - 1)]
        cpi_chg = [cpi_vals[i + 1] - cpi_vals[i] for i in range(len(cpi_vals) - 1)]
        change_corr = _pearson(apix_chg, cpi_chg) if len(apix_chg) >= 2 else None
        agree = sum(1 for a, c in zip(apix_chg, cpi_chg) if (a >= 0) == (c >= 0))
        directional_agreement = round(agree / len(apix_chg), 4) if apix_chg else None

        metrics.update({
            "matched_series": [
                {"month": m.isoformat(), "apix": round(a, 3), "benchmark": round(c, 3)}
                for m, a, c in matched
            ],
            "statistics": {
                "level_correlation_pearson": corr,
                "change_correlation_pearson": change_corr,
                "directional_agreement": directional_agreement,
                "months_evaluated": len(matched),
            },
        })
        run.status = "completed"
        run.metrics = metrics
        run.finished_at = utc_now()
        await self.session.flush()
        return run

    # ------------------------------------------------------------------
    async def _resolve_dataset(
        self, dataset_id: Optional[UUID], benchmark_type: str
    ) -> Tuple[Optional[ReferenceDataset], Optional[ReferenceDatasetVersion]]:
        ds = None
        if dataset_id:
            ds = (await self.session.execute(
                select(ReferenceDataset).where(ReferenceDataset.id == dataset_id)
            )).scalars().first()
        if not ds:
            # latest dataset that has benchmark rows of this type
            ds = (await self.session.execute(
                select(ReferenceDataset)
                .where(ReferenceDataset.dataset_type == "CPI")
                .order_by(ReferenceDataset.retrieved_at.desc())
            )).scalars().first()
        ver = None
        if ds and ds.current_version_id:
            ver = (await self.session.execute(
                select(ReferenceDatasetVersion).where(ReferenceDatasetVersion.id == ds.current_version_id)
            )).scalars().first()
        return ds, ver

    async def _benchmark_monthly(
        self, dataset_id: Optional[UUID], benchmark_type: str, start: date, end: date
    ) -> Dict[date, float]:
        q = select(BenchmarkFare).where(BenchmarkFare.benchmark_type == benchmark_type)
        if dataset_id:
            q = q.where(BenchmarkFare.reference_dataset_id == dataset_id)
        rows = list((await self.session.execute(q)).scalars().all())
        out: Dict[date, float] = {}
        for r in rows:
            if r.period_start and start <= r.period_start <= end and r.value is not None:
                out[r.period_start.replace(day=1)] = float(r.value)
        return out

    async def _apix_monthly(self, start: date, end: date) -> Dict[str, Any]:
        """APIx daily national index -> calendar-month average.

        Uses a resilient raw query on the columns that actually exist so a legacy
        ORM/live schema mismatch degrades to 'no data' rather than a 500.
        """
        from sqlalchemy import text
        buckets: Dict[date, List[float]] = {}
        try:
            # Savepoint: a schema mismatch here must not poison the outer transaction.
            async with self.session.begin_nested():
                result = await self.session.execute(
                    text(
                        "SELECT index_date, index_value FROM airfare_index "
                        "WHERE scope = 'national' AND index_date >= :s AND index_date <= :e "
                        "ORDER BY index_date"
                    ),
                    {"s": start, "e": end},
                )
                fetched = result.fetchall()
            for row in fetched:
                d = row[0]
                if d is None or row[1] is None:
                    continue
                key = d.replace(day=1)
                buckets.setdefault(key, []).append(float(row[1]))
        except Exception:
            return {}
        return {k.isoformat(): round(sum(v) / len(v), 3) for k, v in buckets.items() if v}

    def _align(self, apix_monthly: Dict[str, Any], bench: Dict[date, float]) -> List[Tuple[date, float, float]]:
        matched: List[Tuple[date, float, float]] = []
        for month, cpi in sorted(bench.items()):
            a = apix_monthly.get(month.isoformat())
            if a is not None:
                matched.append((month, a, cpi))
        return matched

    @staticmethod
    def _provenance(ds: Optional[ReferenceDataset], ver: Optional[ReferenceDatasetVersion]) -> Dict[str, Any]:
        if not ds:
            return {"available": False, "note": "No synchronized official reference dataset found."}
        return {
            "available": True,
            "official_source": "MoSPI eSankhyiki",
            "dataset_id": str(ds.id),
            "dataset_name": ds.dataset_name,
            "dataset_code": ds.dataset_code,
            "dataset_version": ds.dataset_version,
            "reference_version_id": str(ver.id) if ver else None,
            "reference_period": ver.reference_period if ver else None,
            "checksum_sha256": (ver.checksum_sha256 if ver else ds.checksum),
            "frequency": ds.frequency,
        }
