import os
from typing import Optional
from app.config import settings
from app.ml.explainability import ExplainabilityService
from app.ml.fareguard import FareGuardModel
from app.ml.priceguard import PriceGuardDetector


class ModelRegistryService:
    """Manages versioned model artifacts and handles lazy loading in API runtime."""

    _fareguard: Optional[FareGuardModel] = None
    _priceguard: Optional[PriceGuardDetector] = None
    _explainer: Optional[ExplainabilityService] = None

    @classmethod
    def get_fareguard(cls) -> FareGuardModel:
        if cls._fareguard is None:
            cls._fareguard = FareGuardModel(version=settings.MODEL_FAREGUARD_VERSION)
            model_path = os.path.join(settings.MODEL_DIR, f"{settings.MODEL_FAREGUARD_VERSION}.joblib")
            if os.path.exists(model_path):
                cls._fareguard.load(model_path)
        return cls._fareguard

    @classmethod
    def get_priceguard(cls) -> PriceGuardDetector:
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
    def get_explainer(cls) -> ExplainabilityService:
        if cls._explainer is None:
            fareguard = cls.get_fareguard()
            cls._explainer = ExplainabilityService(fareguard)
        return cls._explainer
