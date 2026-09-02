import os
import joblib
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


class FareGuardModel:
    """FareGuard: Expected Fare Estimation Model (XGBoost Regressor).
    Predicts expected baseline fare conditional on route distance, booking window, day of week, seasonality,
    fuel index, and historical rolling medians.
    Uses time-based train/test splitting to prevent lookahead data leakage."""

    FEATURE_COLS = [
        "distance_km",
        "booking_window_days",
        "day_of_week",
        "is_weekend",
        "month",
        "is_festival",
        "fuel_price",
        "synthetic_route_demand_score",
        "route_recent_median",
        "route_recent_std",
        "route_recent_volatility",
        "source_reliability_score",
    ]

    def __init__(self, version: str = "fareguard-xgb-v1"):
        self.version = version
        self.model: Optional[XGBRegressor] = None
        self.is_trained: bool = False

    def train(
        self, df: pd.DataFrame, target_col: str = "normalized_total_fare"
    ) -> Dict[str, float]:
        X = df[self.FEATURE_COLS].copy()
        y = df[target_col].values

        # Time-based split: 70% train, 15% validation, 15% test
        n = len(df)
        train_idx = int(n * 0.70)
        val_idx = int(n * 0.85)

        X_train, y_train = X.iloc[:train_idx], y[:train_idx]
        X_val, y_val = X.iloc[train_idx:val_idx], y[train_idx:val_idx]
        X_test, y_test = X.iloc[val_idx:], y[val_idx:]

        self.model = XGBRegressor(
            n_estimators=150,
            learning_rate=0.08,
            max_depth=5,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42,
            n_jobs=-1,
        )

        self.model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        self.is_trained = True

        # Evaluate on out-of-time test set
        preds = self.model.predict(X_test)
        mae = float(mean_absolute_error(y_test, preds))
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        r2 = float(r2_score(y_test, preds))
        mape = float(np.mean(np.abs((y_test - preds) / np.maximum(y_test, 1.0))) * 100.0)

        metrics = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 4),
            "mape": round(mape, 2),
            "training_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
        }
        return metrics

    def predict_batch(self, df: pd.DataFrame) -> np.ndarray:
        if not self.is_trained or self.model is None:
            # Fallback simple baseline estimation if untrained
            return df["route_recent_median"].values * (1.0 + 0.3 * (1.0 / np.maximum(1, df["booking_window_days"])))
        X = df[self.FEATURE_COLS].copy()
        return self.model.predict(X)

    def save(self, directory: str) -> str:
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, f"{self.version}.joblib")
        joblib.dump({"model": self.model, "version": self.version, "features": self.FEATURE_COLS}, path)
        return path

    def load(self, path: str) -> None:
        if os.path.exists(path):
            data = joblib.load(path)
            self.model = data["model"]
            self.version = data["version"]
            self.is_trained = True
