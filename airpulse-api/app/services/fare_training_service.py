"""Train FareGuard on REAL validated fares (IMPORTED + collected).

Honest by design: builds features from actual observations, computes real
per-route rolling medians, and refuses to emit fake metrics when there is
not enough real data to train a meaningful model. As more scraped CSVs are
imported, explicit candidate evaluation can measure whether a replacement improves.
"""
from __future__ import annotations

from typing import Any, Dict
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from app.ml.features import FeatureBuilder

MIN_ROWS_TO_TRAIN = 40  # below this a time-split XGBoost model is not meaningful


class FareTrainingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def build_training_frame(self) -> pd.DataFrame:
        from app.services.live_store import rows
        fares = await rows(self.session, """SELECT v.*,r.distance_km FROM validated_fares v
            JOIN routes r ON r.id=v.route_id WHERE v.validation_status='VALID'
            AND NOT v.is_duplicate AND v.data_origin IN ('LIVE','IMPORTED')
            ORDER BY v.collected_at,v.id""")
        return FeatureBuilder.observed_training_frame(fares)

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

        # Do not overwrite an ACTIVE v1 artifact from a training endpoint.
        return {"status": "candidate_evaluation_required", "rows": total,
                "message": "Use python -m app.scripts.evaluate_fareguard_candidate with a genuine-data snapshot. Active artifacts are never overwritten by this endpoint."}
