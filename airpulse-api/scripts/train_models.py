import asyncio
import os
import sys
from datetime import date
from uuid import uuid4
import pandas as pd
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.db.models import (
    Anomaly,
    FareFeature,
    FarePrediction,
    ModelRegistry,
    ShapExplanation,
    ValidatedFare,
)
from app.db.session import AsyncSessionLocal
from app.ml.explainability import ExplainabilityService
from app.ml.fareguard import FareGuardModel
from app.ml.priceguard import PriceGuardDetector
from app.core.utils import utc_now


async def train_models():
    print("Loading features and validated fares from PostgreSQL/Supabase...")
    async with AsyncSessionLocal() as session:
        query = select(
            ValidatedFare.id.label("fare_id"),
            ValidatedFare.normalized_total_fare,
            FareFeature.distance_km,
            FareFeature.booking_window_days,
            FareFeature.day_of_week,
            FareFeature.is_weekend,
            FareFeature.month,
            FareFeature.is_festival,
            FareFeature.fuel_price,
            FareFeature.synthetic_route_demand_score,
            FareFeature.route_recent_median,
            FareFeature.route_recent_std,
            FareFeature.route_recent_volatility,
            FareFeature.source_reliability_score,
        ).join(FareFeature, ValidatedFare.id == FareFeature.fare_id)

        res = await session.execute(query)
        rows = res.all()
        if len(rows) < 50:
            print(f"Only {len(rows)} records found. Please run scripts/generate_demo_data.py first!")
            return

        data = []
        for r in rows:
            data.append({
                "fare_id": str(r.fare_id),
                "normalized_total_fare": float(r.normalized_total_fare),
                "distance_km": float(r.distance_km),
                "booking_window_days": int(r.booking_window_days),
                "day_of_week": int(r.day_of_week),
                "is_weekend": 1 if r.is_weekend else 0,
                "month": int(r.month),
                "is_festival": 1 if r.is_festival else 0,
                "fuel_price": float(r.fuel_price or 95.5),
                "synthetic_route_demand_score": float(r.synthetic_route_demand_score or 0.70),
                "route_recent_median": float(r.route_recent_median or 5000.0),
                "route_recent_std": float(r.route_recent_std or 450.0),
                "route_recent_volatility": float(r.route_recent_volatility or 0.09),
                "source_reliability_score": float(r.source_reliability_score or 1.0),
            })

        df = pd.DataFrame(data)
        print(f"Loaded {len(df)} samples for FareGuard training.")

        # 1. Train FareGuard XGBoost Model
        fareguard = FareGuardModel(version=settings.MODEL_FAREGUARD_VERSION)
        metrics = fareguard.train(df, target_col="normalized_total_fare")
        saved_fg_path = fareguard.save(settings.MODEL_DIR)
        print(f"FareGuard trained successfully! Out-of-time Test MAE: ₹{metrics['mae']}, RMSE: ₹{metrics['rmse']}, R2: {metrics['r2']:.4f}")

        # Register FareGuard in DB
        session.add(
            ModelRegistry(
                id=uuid4(),
                model_name="FareGuard Expected Fare Regressor",
                model_type="xgboost",
                version=settings.MODEL_FAREGUARD_VERSION,
                artifact_path=saved_fg_path,
                feature_schema={"features": fareguard.FEATURE_COLS},
                training_start_date=date.today(),
                training_end_date=date.today(),
                training_rows=len(df),
                metrics=metrics,
                active=True,
            )
        )

        # 2. Generate In-sample Predictions & Residuals for PriceGuard
        preds = fareguard.predict_batch(df)
        df["predicted_fare"] = preds
        df["actual_fare"] = df["normalized_total_fare"]
        df["residual"] = df["actual_fare"] - df["predicted_fare"]
        df["residual_pct"] = (df["residual"] / np.maximum(df["predicted_fare"], 1.0)) * 100.0

        # 3. Train PriceGuard Isolation Forest with empirical percentile ranking
        priceguard = PriceGuardDetector(
            version=settings.MODEL_PRICEGUARD_VERSION,
            contamination=settings.ANOMALY_CONTAMINATION,
        )
        pg_metrics = priceguard.train(df)
        saved_pg_path = priceguard.save(settings.MODEL_DIR)
        print(f"PriceGuard trained successfully! Calibrated training distribution min={pg_metrics['min_raw_score']:.2f}, max={pg_metrics['max_raw_score']:.2f}")

        # Register PriceGuard in DB
        session.add(
            ModelRegistry(
                id=uuid4(),
                model_name="PriceGuard Anomaly Detector",
                model_type="isolation_forest",
                version=settings.MODEL_PRICEGUARD_VERSION,
                artifact_path=saved_pg_path,
                feature_schema={"features": priceguard.ANOMALY_FEATURE_COLS},
                training_start_date=date.today(),
                training_end_date=date.today(),
                training_rows=len(df),
                metrics=pg_metrics,
                active=True,
            )
        )

        # 4. Score records, persist predictions, anomalies, and gated SHAP explanations
        anomaly_scores = priceguard.score_batch(df)
        explainer = ExplainabilityService(fareguard)

        print("Persisting predictions and evaluated anomalies...")
        anom_count = 0
        shap_count = 0

        for idx, row in df.iterrows():
            f_id = uuid4() if not row["fare_id"] else row["fare_id"]
            pred_id = uuid4()

            pred_rec = FarePrediction(
                id=pred_id,
                fare_id=f_id,
                model_version=fareguard.version,
                predicted_fare=float(row["predicted_fare"]),
                actual_fare=float(row["actual_fare"]),
                residual=float(row["residual"]),
                residual_pct=float(row["residual_pct"]),
            )
            session.add(pred_rec)

            anom_info = anomaly_scores[idx]
            anom_rec = Anomaly(
                id=uuid4(),
                fare_id=f_id,
                prediction_id=pred_id,
                detector_version=priceguard.version,
                isolation_score=anom_info["isolation_score"],
                anomaly_percentile=anom_info["anomaly_percentile"],
                severity=anom_info["severity"],
                anomaly_type=anom_info["anomaly_type"],
                is_anomaly=anom_info["is_anomaly"],
                status="open",
            )
            session.add(anom_rec)

            if anom_info["is_anomaly"]:
                anom_count += 1

            # GATED SHAP: Only compute SHAP for anomalous fares (percentile >= 0.75)
            if anom_info["anomaly_percentile"] >= settings.ANOMALY_SHAP_THRESHOLD:
                shap_data = explainer.explain_fare(
                    row,
                    actual_fare=row["actual_fare"],
                    predicted_fare=row["predicted_fare"],
                    anomaly_percentile=anom_info["anomaly_percentile"],
                )
                anom_rec.explanation = shap_data

                shap_rec = ShapExplanation(
                    id=uuid4(),
                    fare_id=f_id,
                    prediction_id=pred_id,
                    model_version=fareguard.version,
                    base_value=shap_data["base_value"],
                    predicted_value=float(row["predicted_fare"]),
                    feature_contributions=shap_data["drivers"],
                    top_positive_features=[d for d in shap_data["drivers"] if d["direction"] == "increase"],
                    top_negative_features=[d for d in shap_data["drivers"] if d["direction"] == "decrease"],
                )
                session.add(shap_rec)
                shap_count += 1

        await session.commit()
        print(f"Model deployment complete! Detected {anom_count} anomalies. Generated {shap_count} gated SHAP explanations.")


if __name__ == "__main__":
    import numpy as np
    asyncio.run(train_models())
