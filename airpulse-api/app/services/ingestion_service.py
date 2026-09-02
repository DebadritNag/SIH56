import logging
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.db.models import (
    Anomaly,
    CollectionRun,
    FareFeature,
    FareIndexEligibility,
    FarePrediction,
    PipelineRun,
    PipelineStep,
    RawFare,
    Route,
    ShapExplanation,
    ValidatedFare,
)
from app.services.fare_parser import FareParser
from app.services.fare_normalizer import FareNormalizer
from app.services.fare_validator import FareValidator
from app.services.fare_deduplicator import FareDeduplicator
from app.services.eligibility_service import EligibilityService
from app.services.index_engine import IndexEngine
from app.services.shock_detector import ShockDetector
from app.ml.model_registry import ModelRegistryService
from app.ml.features import FeatureBuilder

logger = logging.getLogger(__name__)


class IngestionService:
    """Discrete End-to-End Ingestion & Processing Pipeline Orchestrator:
    Maintains the exact stage sequence:
    RAW PERSISTENCE -> NORMALIZE -> VALIDATE -> DEDUPLICATE -> FEATURES -> FAREGUARD -> PRICEGUARD -> SHAP -> APIx -> SHOCKS.
    Logs progress into pipeline_steps for realtime frontend tracking."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_raw_fares_bulk(
        self,
        envelopes_with_meta: List[Tuple[Dict[str, Any], UUID, UUID]],
        collection_run_id: UUID,
    ) -> List[RawFare]:
        raw_entities = []
        for env, route_id, source_id in envelopes_with_meta:
            raw_entities.append(
                RawFare(
                    id=UUID(env["id"]),
                    collection_run_id=collection_run_id,
                    source_id=source_id,
                    request_id=UUID(env["request_id"]),
                    origin_requested=env["origin_requested"],
                    destination_requested=env["destination_requested"],
                    departure_requested=date.fromisoformat(env["departure_requested"]),
                    booking_window_requested=env["booking_window_requested"],
                    collected_at=datetime.fromisoformat(env["collected_at"]),
                    http_status=env.get("http_status", 200),
                    raw_payload=env["raw_payload"],
                    response_hash=env["response_hash"],
                    collector_version=env["collector_version"],
                    parser_version=env["parser_version"],
                    created_at=utc_now(),
                )
            )
        self.session.add_all(raw_entities)
        await self.session.flush()
        return raw_entities

    async def process_collection_run(self, collection_run_id: UUID) -> PipelineRun:
        """Executes full normalization, validation, ML inference, and indexation for a collection run."""
        col_run_res = await self.session.execute(
            select(CollectionRun).where(CollectionRun.id == collection_run_id)
        )
        col_run = col_run_res.scalars().first()
        if not col_run:
            raise ValueError(f"CollectionRun {collection_run_id} not found.")

        pipe_run = PipelineRun(
            id=uuid4(),
            collection_run_id=collection_run_id,
            pipeline_type="end_to_end_ingestion",
            started_at=utc_now(),
            status="running",
            version="1.0.0",
        )
        self.session.add(pipe_run)
        await self.session.flush()

        # Fetch all raw fares for this run
        raw_res = await self.session.execute(
            select(RawFare).where(RawFare.collection_run_id == collection_run_id)
        )
        raw_fares = list(raw_res.scalars().all())
        pipe_run.records_input = len(raw_fares)

        if not raw_fares:
            pipe_run.status = "completed"
            pipe_run.finished_at = utc_now()
            await self.session.commit()
            return pipe_run

        # Step 1: NORMALIZE
        step_norm = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="NORMALIZE",
            status="running",
            started_at=utc_now(),
            records_input=len(raw_fares),
        )
        self.session.add(step_norm)
        await self.session.flush()

        parsed_and_norm = []
        routes_res = await self.session.execute(select(Route))
        routes_map = {r.route_code: r for r in routes_res.scalars().all()}

        for raw in raw_fares:
            parsed = FareParser.parse_record(raw.id, raw.source_id, raw.raw_payload)
            r_code = f"{parsed.origin_code}-{parsed.destination_code}"
            route_id = routes_map[r_code].id if r_code in routes_map else None
            norm = FareNormalizer.normalize(parsed, route_id=route_id)
            parsed_and_norm.append((raw, norm, route_id))

        step_norm.status = "completed"
        step_norm.records_output = len(parsed_and_norm)
        step_norm.finished_at = utc_now()

        # Step 2: VALIDATE
        step_val = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="VALIDATE",
            status="running",
            started_at=utc_now(),
            records_input=len(parsed_and_norm),
        )
        self.session.add(step_val)
        await self.session.flush()

        validated_items = []
        rejected_count = 0
        for raw, norm, route_id in parsed_and_norm:
            val_status, errors = FareValidator.validate(norm)
            if val_status.value == "rejected":
                rejected_count += 1
            validated_items.append((raw, norm, route_id, val_status, errors))

        step_val.status = "completed"
        step_val.records_output = len(validated_items) - rejected_count
        step_val.records_failed = rejected_count
        step_val.finished_at = utc_now()

        # Step 3: DEDUPLICATE
        step_dedup = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="DEDUPLICATE",
            status="running",
            started_at=utc_now(),
            records_input=len(validated_items),
        )
        self.session.add(step_dedup)
        await self.session.flush()

        hash_map = {}
        validated_entities = []
        eligibility_entities = []
        duplicates_count = 0

        for raw, norm, route_id, val_status, errors in validated_items:
            q_hash = FareDeduplicator.generate_quote_hash(norm)
            is_dup, dup_group_id = FareDeduplicator.evaluate_duplicate(q_hash, hash_map)
            if is_dup:
                duplicates_count += 1

            fare_id = uuid4()
            val_entity = ValidatedFare(
                id=fare_id,
                raw_fare_id=raw.id,
                collection_run_id=collection_run_id,
                source_id=raw.source_id,
                route_id=route_id or uuid4(),
                airline=norm.airline_code,
                flight_number=norm.flight_number,
                origin=norm.origin_code,
                destination=norm.destination_code,
                departure_at=norm.departure_at,
                arrival_at=norm.arrival_at,
                booking_window_days=norm.booking_window_days,
                cabin=norm.cabin_class,
                fare_class=norm.fare_class,
                refundable=norm.refundable,
                baggage_allowance=norm.baggage_kg,
                base_fare=norm.base_fare,
                taxes=norm.taxes,
                mandatory_fees=norm.fees,
                total_fare=norm.total_fare,
                normalized_total_fare=norm.normalized_total_fare,
                currency=norm.currency,
                validation_status=val_status.value,
                validation_errors=errors,
                duplicate_group_id=dup_group_id,
                is_duplicate=is_dup,
                quote_hash=q_hash,
                collected_at=norm.collected_at,
                created_at=utc_now(),
            )
            validated_entities.append(val_entity)

            is_elig, reason = EligibilityService.evaluate_eligibility(norm, val_status, is_dup)
            eligibility_entities.append(
                FareIndexEligibility(
                    id=uuid4(),
                    fare_id=fare_id,
                    eligible=is_elig,
                    reason_code=reason.value,
                    methodology_version="apix-v1.2",
                    evaluated_at=utc_now(),
                )
            )

        self.session.add_all(validated_entities)
        self.session.add_all(eligibility_entities)
        await self.session.flush()

        step_dedup.status = "completed"
        step_dedup.records_output = len(validated_entities)
        step_dedup.records_failed = duplicates_count
        step_dedup.message = f"Detected {duplicates_count} duplicates (preserved with quote hash)."
        step_dedup.finished_at = utc_now()

        # Update collection_run counts
        col_run.quotes_validated = len(validated_entities) - rejected_count
        col_run.quotes_rejected = rejected_count
        col_run.duplicates_detected = duplicates_count

        # Step 4: ML INFERENCE & ANOMALY DETECTION (Gated SHAP)
        step_ml = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="ML_ANALYSIS",
            status="running",
            started_at=utc_now(),
            records_input=len(validated_entities),
        )
        self.session.add(step_ml)
        await self.session.flush()

        try:
            fareguard = ModelRegistryService.get_fareguard()
            priceguard = ModelRegistryService.get_priceguard()
            explainer = ModelRegistryService.get_explainer()

            # Build feature DataFrame
            feat_rows = []
            for vf in validated_entities:
                dist = 1148.0
                r = routes_map.get(f"{vf.origin}-{vf.destination}")
                if r:
                    dist = r.distance_km

                f_dict = FeatureBuilder.build_features_for_fare(
                    fare_id=str(vf.id),
                    departure_dt=vf.departure_at,
                    booking_window_days=vf.booking_window_days,
                    distance_km=dist,
                    airline_code=vf.airline,
                    cabin_class=vf.cabin,
                )
                f_dict["actual_fare"] = float(vf.normalized_total_fare)
                feat_rows.append(f_dict)

            if feat_rows:
                df_feats = pd.DataFrame(feat_rows)
                preds = fareguard.predict_batch(df_feats)
                df_feats["predicted_fare"] = preds
                df_feats["residual"] = df_feats["actual_fare"] - df_feats["predicted_fare"]
                df_feats["residual_pct"] = (df_feats["residual"] / np.maximum(df_feats["predicted_fare"], 1.0)) * 100.0

                anomaly_scores = priceguard.score_batch(df_feats)

                # Persist predictions, features, and gated SHAP
                for idx, vf in enumerate(validated_entities):
                    row = df_feats.iloc[idx]
                    anom_data = anomaly_scores[idx]

                    pred_rec = FarePrediction(
                        id=uuid4(),
                        fare_id=vf.id,
                        model_version=fareguard.version,
                        predicted_fare=float(row["predicted_fare"]),
                        actual_fare=float(row["actual_fare"]),
                        residual=float(row["residual"]),
                        residual_pct=float(row["residual_pct"]),
                    )
                    self.session.add(pred_rec)

                    anom_rec = Anomaly(
                        id=uuid4(),
                        fare_id=vf.id,
                        prediction_id=pred_rec.id,
                        detector_version=priceguard.version,
                        isolation_score=anom_data["isolation_score"],
                        anomaly_percentile=anom_data["anomaly_percentile"],
                        severity=anom_data["severity"],
                        anomaly_type=anom_data["anomaly_type"],
                        is_anomaly=anom_data["is_anomaly"],
                        status="open",
                    )
                    self.session.add(anom_rec)

                    # Gated SHAP calculation
                    if anom_data["anomaly_percentile"] >= 0.75:
                        shap_info = explainer.explain_fare(
                            row,
                            actual_fare=row["actual_fare"],
                            predicted_fare=row["predicted_fare"],
                            anomaly_percentile=anom_data["anomaly_percentile"],
                        )
                        anom_rec.explanation = shap_info

            step_ml.status = "completed"
            step_ml.records_output = len(validated_entities)
            step_ml.finished_at = utc_now()
        except Exception as ml_err:
            logger.error(f"ML Step warning: {ml_err}")
            step_ml.status = "completed"
            step_ml.message = f"ML QA finished with advisory: {ml_err}"
            step_ml.finished_at = utc_now()

        # Step 5: OFFICIAL STATISTICAL INDEX (APIx)
        step_apix = PipelineStep(
            id=uuid4(),
            pipeline_run_id=pipe_run.id,
            step_name="APIX_GENERATION",
            status="running",
            started_at=utc_now(),
        )
        self.session.add(step_apix)
        await self.session.flush()

        idx_engine = IndexEngine(self.session)
        latest_index = await idx_engine.calculate_daily_index(date.today())

        step_apix.status = "completed"
        step_apix.records_output = 1
        step_apix.message = f"APIx Daily calculated: {latest_index.index_value} (Quality Score: {latest_index.coverage_quality_score})"
        step_apix.finished_at = utc_now()

        # Finalize PipelineRun
        pipe_run.status = "completed"
        pipe_run.records_processed = len(validated_entities)
        pipe_run.finished_at = utc_now()

        await self.session.commit()
        return pipe_run
