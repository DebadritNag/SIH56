import os
import joblib
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple
from sklearn.ensemble import IsolationForest
from scipy.stats import percentileofscore
from app.core.constants import ANOMALY_PERCENTILE_BINS
from app.core.enums import AnomalySeverity, AnomalyType


class PriceGuardDetector:
    """PriceGuard: Anomaly Detection Engine (Isolation Forest + Empirical Percentile Calibration).
    Evaluates fare deviation using residual, residual %, booking window, recent route dispersion, and demand.

    CRITICAL STATISTICAL REFINEMENT:
    Does NOT use naive min-max scaling. Normalizes raw decision function scores using empirical percentile
    ranking against the fitted baseline training score distribution, yielding a reproducible [0.0 - 1.0] metric."""

    ANOMALY_FEATURE_COLS = [
        "actual_fare",
        "predicted_fare",
        "residual",
        "residual_pct",
        "booking_window_days",
        "route_recent_median",
        "route_recent_std",
        "route_recent_volatility",
        "synthetic_route_demand_score",
        "source_reliability_score",
    ]

    def __init__(self, version: str = "priceguard-if-v1", contamination: float = 0.04):
        self.version = version
        self.contamination = contamination
        self.model: Optional[IsolationForest] = None
        self.training_scores: Optional[np.ndarray] = None
        self.is_trained: bool = False

    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        X = df[self.ANOMALY_FEATURE_COLS].copy()

        self.model = IsolationForest(
            n_estimators=120,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X)
        self.is_trained = True

        # Invert score: lower decision_function = more anomalous.
        # We invert it so higher raw score = higher anomaly.
        raw_scores = -self.model.decision_function(X)
        self.training_scores = np.sort(raw_scores)

        return {
            "training_samples": len(X),
            "contamination": self.contamination,
            "min_raw_score": float(np.min(raw_scores)),
            "max_raw_score": float(np.max(raw_scores)),
            "median_raw_score": float(np.median(raw_scores)),
        }

    def score_batch(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        if not self.is_trained or self.model is None or self.training_scores is None:
            # Fallback heuristic if untrained
            results = []
            for _, row in df.iterrows():
                res_pct = abs(float(row.get("residual_pct", 0.0)))
                perc = min(0.99, res_pct / 100.0)
                results.append(self._classify_record(row, perc, 0.0))
            return results

        X = df[self.ANOMALY_FEATURE_COLS].copy()
        raw_scores = -self.model.decision_function(X)
        is_anom_preds = self.model.predict(X)  # -1 = anomaly, 1 = normal

        results = []
        for idx, (_, row) in enumerate(df.iterrows()):
            raw_s = raw_scores[idx]
            # Empirical percentile ranking against training distribution
            percentile = percentileofscore(self.training_scores, raw_s, kind="weak") / 100.0
            percentile = round(min(1.0, max(0.0, percentile)), 4)
            record_res = self._classify_record(row, percentile, raw_s)
            results.append(record_res)

        return results

    def _classify_record(self, row: pd.Series, percentile: float, raw_score: float) -> Dict[str, Any]:
        # Severity assignment based on calibrated percentile
        if percentile >= 0.95:
            severity = AnomalySeverity.CRITICAL
        elif percentile >= 0.85:
            severity = AnomalySeverity.HIGH
        elif percentile >= 0.75:
            severity = AnomalySeverity.MEDIUM
        elif percentile >= 0.60:
            severity = AnomalySeverity.LOW
        else:
            severity = AnomalySeverity.NORMAL

        is_anomaly = percentile >= 0.75
        residual = float(row.get("residual", 0.0))
        res_pct = float(row.get("residual_pct", 0.0))

        # Classification distinction
        if not is_anomaly:
            anom_type = AnomalyType.UNKNOWN
        elif residual > 0 and res_pct > 30.0:
            anom_type = AnomalyType.UNUSUALLY_HIGH
        elif residual < 0 and res_pct < -30.0:
            anom_type = AnomalyType.UNUSUALLY_LOW
        elif float(row.get("source_reliability_score", 1.0)) < 0.70:
            anom_type = AnomalyType.DATA_QUALITY
        else:
            anom_type = AnomalyType.UNUSUALLY_HIGH

        return {
            "isolation_score": float(raw_score),
            "anomaly_percentile": percentile,
            "severity": severity.value,
            "anomaly_type": anom_type.value,
            "is_anomaly": is_anomaly,
        }

    def save(self, directory: str) -> str:
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, f"{self.version}.joblib")
        joblib.dump(
            {
                "model": self.model,
                "version": self.version,
                "training_scores": self.training_scores,
                "features": self.ANOMALY_FEATURE_COLS,
            },
            path,
        )
        return path

    def load(self, path: str) -> None:
        if os.path.exists(path):
            data = joblib.load(path)
            self.model = data["model"]
            self.version = data["version"]
            self.training_scores = data.get("training_scores")
            self.is_trained = True
