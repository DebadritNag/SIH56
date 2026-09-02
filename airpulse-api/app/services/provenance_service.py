from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    AirfareIndex,
    Anomaly,
    BacktestRun,
    FareFeature,
    FareIndexEligibility,
    FarePrediction,
    RawFare,
    ReferenceDataset,
    ReferenceDatasetVersion,
    ShapExplanation,
    Source,
    ValidatedFare,
)
from app.services.storage_service import get_storage_service


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
            "airline_code": val_fare.airline,
            "route": f"{val_fare.origin}-{val_fare.destination}",
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

    async def get_dataset_provenance(self, dataset_id: UUID) -> Dict[str, Any]:
        """Full lineage for an official reference dataset:
        source -> dataset -> version(s) -> checksum -> storage -> normalized series
        -> backtest usage. Mirrors the official-source chain the UI renders.
        """
        ds = (await self.session.execute(
            select(ReferenceDataset).where(ReferenceDataset.id == dataset_id)
        )).scalars().first()
        if not ds:
            return {"error": "Reference dataset not found"}

        src = (await self.session.execute(
            select(Source).where(Source.id == ds.source_id)
        )).scalars().first() if ds.source_id else None

        versions = list((await self.session.execute(
            select(ReferenceDatasetVersion)
            .where(ReferenceDatasetVersion.reference_dataset_id == ds.id)
            .order_by(ReferenceDatasetVersion.version_sequence.desc())
        )).scalars().all())

        # Backtests that referenced this dataset (benchmark_dataset_id link).
        backtests = list((await self.session.execute(
            select(BacktestRun).where(BacktestRun.benchmark_dataset_id == ds.id)
        )).scalars().all())

        current = next((v for v in versions if v.id == ds.current_version_id), versions[0] if versions else None)

        return {
            "chain": "MoSPI eSankhyiki -> Official Dataset -> Version -> SHA-256 -> Original File -> Normalized Reference Series -> Backtest Usage",
            "official_source": {
                "id": str(src.id) if src else None,
                "name": src.name if src else None,
                "display_name": src.display_name if src else None,
                "organization": (src.source_metadata or {}).get("organization") if src and src.source_metadata else "Ministry of Statistics and Programme Implementation",
                "portal_url": src.base_url if src else "https://esankhyiki.mospi.gov.in",
                "source_type": str(src.source_type) if src else None,
            },
            "dataset": {
                "id": str(ds.id),
                "dataset_name": ds.dataset_name,
                "dataset_code": ds.dataset_code,
                "external_dataset_id": ds.external_dataset_id,
                "product_name": ds.product_name,
                "dataset_type": ds.dataset_type,
                "frequency": ds.frequency,
                "relevance": ds.relevance,
                "status": ds.status,
                "reference_period": f"{ds.reference_period_start} to {ds.reference_period_end}",
                "source_url": ds.source_url,
                "checksum_sha256": ds.checksum,
                "file_format": ds.file_format,
                "row_count": ds.row_count,
                "schema_fingerprint": ds.schema_fingerprint,
                "ingestion_method": (ds.dataset_metadata or {}).get("ingested_from"),
                "parser_version": (ds.dataset_metadata or {}).get("parser_version"),
            },
            "current_version": self._version_dict(current) if current else None,
            "versions": [self._version_dict(v) for v in versions],
            "backtest_usage": [
                {"backtest_id": str(b.id), "status": b.status,
                 "period": f"{b.period_start} to {b.period_end}",
                 "methodology_version": b.methodology_version}
                for b in backtests
            ],
        }

    @staticmethod
    def _version_dict(v: ReferenceDatasetVersion) -> Dict[str, Any]:
        return {
            "id": str(v.id),
            "version_label": v.version_label,
            "version_sequence": v.version_sequence,
            "reference_period": v.reference_period,
            "checksum_sha256": v.checksum_sha256,
            "file_size_bytes": v.file_size_bytes,
            "row_count": v.row_count,
            "column_count": v.column_count,
            "schema_fingerprint": v.schema_fingerprint,
            "file_format": v.file_format,
            "status": v.status,
            "retrieved_at": v.retrieved_at.isoformat() if v.retrieved_at else None,
            "has_stored_original": bool(v.storage_path),
        }

    async def get_version_download_url(self, version_id: UUID, expires_in: int = 900) -> Dict[str, Any]:
        """Short-lived signed URL to the immutable original official file."""
        v = (await self.session.execute(
            select(ReferenceDatasetVersion).where(ReferenceDatasetVersion.id == version_id)
        )).scalars().first()
        if not v:
            return {"error": "Version not found"}
        if not v.storage_path:
            return {"error": "No stored original file for this version"}
        storage = get_storage_service()
        signed = await storage.create_signed_url(
            v.storage_bucket or "reference-datasets", v.storage_path, expires_in=expires_in
        )
        return {
            "version_id": str(v.id),
            "version_label": v.version_label,
            "file_format": v.file_format,
            "checksum_sha256": v.checksum_sha256,
            "signed_url": signed,
            "expires_in_seconds": expires_in,
        }
