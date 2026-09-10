from __future__ import annotations
import os
from typing import Optional
from app.config import settings


class ModelRegistryService:
    """Manages versioned model artifacts and handles lazy loading in API runtime."""

    _fareguard: Optional[FareGuardModel] = None
    _priceguard: Optional[PriceGuardDetector] = None
    _explainer: Optional[ExplainabilityService] = None

    @classmethod
    def get_fareguard(cls) -> FareGuardModel:
        from app.ml.fareguard import FareGuardModel
        if cls._fareguard is None:
            cls._fareguard = FareGuardModel(version=settings.MODEL_FAREGUARD_VERSION)
            model_path = os.path.join(settings.MODEL_DIR, f"{settings.MODEL_FAREGUARD_VERSION}.joblib")
            if os.path.exists(model_path):
                cls._fareguard.load(model_path)
        return cls._fareguard

    @classmethod
    def get_priceguard(cls) -> PriceGuardDetector:
        from app.ml.priceguard import PriceGuardDetector
        if cls._priceguard is None:
            cls._priceguard = PriceGuardDetector(
                version=settings.MODEL_PRICEGUARD_VERSION,
                contamination=settings.ANOMALY_CONTAMINATION,
            )
            model_path = os.path.join(settings.MODEL_DIR, f"{settings.MODEL_PRICEGUARD_VERSION}.joblib")
            if os.path.exists(model_path):
                cls._priceguard.load(model_path)
        return cls._priceguard

    @classmethod
    async def get_active(cls, db, kind):
        from app.ml.live_inference import get_active_model
        return await get_active_model(db, kind)

    @classmethod
    def get_explainer(cls, fareguard=None):
        from app.ml.explainability import ExplainabilityService
        fareguard = fareguard or cls.get_fareguard()
        if cls._explainer is None or cls._explainer.fareguard is not fareguard:
            cls._explainer = ExplainabilityService(fareguard)
        return cls._explainer
