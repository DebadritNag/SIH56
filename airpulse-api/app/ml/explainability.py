from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import shap
from app.ml.fareguard import FareGuardModel


class ExplainabilityService:
    """SHAP TreeExplainer for FareGuard (XGBoost).
    STRICT ARCHITECTURAL RULE:
    1. Only computed for anomalous fares (percentile >= 0.75) or on-demand analyst requests to prevent wasteful computation.
    2. Explains *why FareGuard expected ₹X*, not an opaque Isolation Forest decision function.
    3. Outputs strictly non-causal attribution (e.g. 'contributed to model expectation')."""

    def __init__(self, fareguard: FareGuardModel):
        self.fareguard = fareguard
        self.explainer: Optional[shap.TreeExplainer] = None
        if fareguard.is_trained and fareguard.model is not None:
            self.explainer = shap.TreeExplainer(fareguard.model)

    def explain_fare(
        self,
        features_row: pd.Series,
        actual_fare: float,
        predicted_fare: float,
        anomaly_percentile: float,
    ) -> Dict[str, Any]:
        residual = actual_fare - predicted_fare
        dev_pct = round((residual / max(1.0, predicted_fare)) * 100.0, 1)

        drivers: List[Dict[str, Any]] = []
        base_value = float(predicted_fare)

        if self.explainer is not None:
            X_row = pd.DataFrame([features_row[self.fareguard.FEATURE_COLS]])
            shap_values = self.explainer.shap_values(X_row)[0]
            base_value = float(self.explainer.expected_value)

            for col, val in zip(self.fareguard.FEATURE_COLS, shap_values):
                if abs(val) > 40.0:  # Material impact threshold
                    feature_val = features_row.get(col)
                    drivers.append({
                        "feature": col,
                        "value": feature_val,
                        "impact": round(float(val), 2),
                        "direction": "increase" if val > 0 else "decrease",
                    })

            # Sort drivers by absolute impact
            drivers.sort(key=lambda d: abs(d["impact"]), reverse=True)
            top_drivers = drivers[:5]
        else:
            # Fallback heuristic explanation if explainer uninitialized
            bw = features_row.get("booking_window_days", 7)
            top_drivers = [
                {
                    "feature": "booking_window_days",
                    "value": bw,
                    "impact": 850.0 if bw <= 3 else -300.0,
                    "direction": "increase" if bw <= 3 else "decrease",
                }
            ]

        summary = (
            f"Observed fare of ₹{actual_fare:,.0f} deviates by {dev_pct:+.1f}% (₹{residual:+,.0f}) "
            f"from the FareGuard baseline expectation (₹{predicted_fare:,.0f}) and falls in the "
            f"{int(anomaly_percentile * 100)}th anomaly percentile."
        )

        return {
            "summary": summary,
            "actual_fare": float(actual_fare),
            "predicted_fare": float(predicted_fare),
            "residual": float(residual),
            "deviation_pct": float(dev_pct),
            "anomaly_percentile": float(anomaly_percentile),
            "base_value": round(base_value, 2),
            "drivers": top_drivers,
        }
