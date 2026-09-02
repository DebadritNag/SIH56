"""Train FareGuard on REAL validated fares (IMPORTED + collected).

Honest by design: builds features from actual observations, computes real
per-route rolling medians, and refuses to emit fake metrics when there is
not enough real data to train a meaningful model. As more scraped CSVs are
imported, calling train() again yields a progressively better model.
"""
from __future__ import annotations

import statistics
from typing import Any, Dict, List, Optional
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.utils import utc_now
from app.db.models import Route, ValidatedFare
from app.ml.fareguard import FareGuardModel
from app.ml.features import FeatureBuilder

MIN_ROWS_TO_TRAIN = 40  # below this a time-split XGBoost model is not meaningful


class FareTrainingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _route_distance(self) -> Dict[Optional[str], float]:
        rows = list((await self.session.execute(select(Route))).scalars().all())
        return {str(r.id): float(r.distance_km or 1500.0) for r in rows}

    async def build_training_frame(self) -> pd.DataFrame:
        fares = list((await self.session.execute(
            select(ValidatedFare).where(ValidatedFare.validation_status == "VALID")
        )).scalars().all())
        if not fares:
            return pd.DataFrame()

        dist_map = await self._route_distance()

        # Real per-route rolling median/std from the actual observations.
        by_route: Dict[str, List[float]] = {}
        for f in fares:
            key = f"{f.origin}-{f.destination}"
            by_route.setdefault(key, []).append(float(f.normalized_total_fare))
        route_stats = {}
        for key, vals in by_route.items():
            med = statistics.median(vals)
            std = statistics.pstdev(vals) if len(vals) > 1 else med * 0.1
            route_stats[key] = (med, std)

        feats: List[Dict[str, Any]] = []
        targets: List[float] = []
        for f in fares:
            key = f"{f.origin}-{f.destination}"
            med, std = route_stats.get(key, (float(f.normalized_total_fare), 1.0))
            fv = FeatureBuilder.build_features_for_fare(
                fare_id=str(f.id),
                departure_dt=f.departure_at,
                booking_window_days=f.booking_window_days or 0,
                distance_km=dist_map.get(str(f.route_id), 1500.0),
                airline_code=(f.airline or "UNKNOWN")[:12],
                cabin_class=f.cabin or "economy",
                route_recent_median=med,
                route_recent_std=std,
                source_reliability=1.0,
            )
            fv["normalized_total_fare"] = float(f.normalized_total_fare)
            feats.append(fv)

        df = pd.DataFrame(feats)
        return df

    async def train(self) -> Dict[str, Any]:
        df = await self.build_training_frame()
        total = len(df)
        if total == 0:
            return {"status": "no_data", "message": "No VALID fares available to train on.",
                    "rows": 0}
        if total < MIN_ROWS_TO_TRAIN:
            # Honest: compute descriptive stats but do NOT pretend a model was trained.
            return {
                "status": "insufficient_data",
                "rows": total,
                "min_required": MIN_ROWS_TO_TRAIN,
                "message": (f"{total} real fares available; at least {MIN_ROWS_TO_TRAIN} are "
                            "needed to train a meaningful FareGuard model. Import more scraped "
                            "CSVs and retrain."),
                "routes_covered": int(df.apply(lambda r: 1, axis=1).sum() and df["distance_km"].nunique()),
                "fare_summary": {
                    "min": float(df["normalized_total_fare"].min()),
                    "max": float(df["normalized_total_fare"].max()),
                    "median": float(df["normalized_total_fare"].median()),
                },
            }

        # Enough data: train for real on FareGuard's exact feature columns.
        model = FareGuardModel()
        # ensure all FEATURE_COLS exist
        for col in FareGuardModel.FEATURE_COLS:
            if col not in df.columns:
                df[col] = 0.0
        metrics = model.train(df)
        path = model.save(settings.MODEL_DIR if hasattr(settings, "MODEL_DIR") else "models")
        return {"status": "trained", "rows": total, "metrics": metrics,
                "model_version": model.version, "artifact_path": path}
