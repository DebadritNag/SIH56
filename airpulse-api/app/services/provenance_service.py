from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    AirfareIndex,
    Anomaly,
    FareFeature,
    FareIndexEligibility,
    FarePrediction,
    RawFare,
    ShapExplanation,
    ValidatedFare,
)


class ProvenanceService:
    """Provides full, tamper-evident lineage tracing from raw HTTP/JSON source to final index and anomaly records."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_fare_provenance(self, fare_id: UUID) -> Dict[str, Any]:
        # 1. Validated fare record
        val_res = await self.session.execute(
            select(ValidatedFare).where(ValidatedFare.id == fare_id)
        )
        val_fare = val_res.scalars().first()
        if not val_fare:
            return {"error": "Validated fare not found"}

        # 2. Raw fare record
        raw_res = await self.session.execute(
            select(RawFare).where(RawFare.id == val_fare.raw_fare_id)
        )
        raw_fare = raw_res.scalars().first()

        # 3. Eligibility
        elig_res = await self.session.execute(
            select(FareIndexEligibility).where(FareIndexEligibility.fare_id == fare_id)
        )
        elig = elig_res.scalars().first()

        # 4. Features
        feat_res = await self.session.execute(
            select(FareFeature).where(FareFeature.fare_id == fare_id)
        )
        feat = feat_res.scalars().first()

        # 5. Prediction
        pred_res = await self.session.execute(
            select(FarePrediction).where(FarePrediction.fare_id == fare_id)
        )
        pred = pred_res.scalars().first()

        # 6. Anomaly
        anom_res = await self.session.execute(
            select(Anomaly).where(Anomaly.fare_id == fare_id)
        )
        anom = anom_res.scalars().first()

        # 7. SHAP
        shap_res = await self.session.execute(
            select(ShapExplanation).where(ShapExplanation.fare_id == fare_id)
        )
        shap = shap_res.scalars().first()

        return {
            "fare_id": str(val_fare.id),
            "airline_code": val_fare.airline_code,
            "route": f"{val_fare.origin_code}-{val_fare.destination_code}",
            "departure_at": val_fare.departure_at.isoformat(),
            "normalized_fare": float(val_fare.normalized_total_fare),
            "validation_status": val_fare.validation_status,
            "is_duplicate": val_fare.is_duplicate,
            "quote_hash": val_fare.quote_hash,
            "raw_source": {
                "raw_fare_id": str(raw_fare.id) if raw_fare else None,
                "request_id": str(raw_fare.request_id) if raw_fare else None,
                "response_hash": raw_fare.response_hash if raw_fare else None,
                "collector_version": raw_fare.collector_version if raw_fare else None,
                "collected_at": raw_fare.collected_at.isoformat() if raw_fare else None,
            },
            "index_eligibility": {
                "eligible": elig.eligible if elig else False,
                "reason_code": elig.reason_code if elig else "UNEVALUATED",
                "methodology_version": elig.methodology_version if elig else None,
            },
            "features_generated": feat is not None,
            "fareguard_prediction": {
                "predicted_fare": pred.predicted_fare if pred else None,
                "residual": pred.residual if pred else None,
                "residual_pct": pred.residual_pct if pred else None,
                "model_version": pred.model_version if pred else None,
            } if pred else None,
            "priceguard_anomaly": {
                "is_anomaly": anom.is_anomaly if anom else False,
                "severity": anom.severity if anom else "normal",
                "anomaly_percentile": anom.anomaly_percentile if anom else 0.0,
                "anomaly_type": anom.anomaly_type if anom else None,
                "status": anom.status if anom else None,
            } if anom else None,
            "shap_attribution": {
                "base_value": shap.base_value if shap else None,
                "predicted_value": shap.predicted_value if shap else None,
                "top_positive": shap.top_positive_features if shap else [],
                "top_negative": shap.top_negative_features if shap else [],
            } if shap else None,
        }
