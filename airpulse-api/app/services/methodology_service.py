from typing import Any, Dict
from app.config import settings


class MethodologyService:
    """Official Documentation & Transparency Service for MoSPI / RBI analysts.
    Exposes full mathematical formulas, basket composition, and outlier policies."""

    @staticmethod
    def get_current_methodology() -> Dict[str, Any]:
        return {
            "methodology_version": settings.INDEX_METHODOLOGY_VERSION,
            "active_basket_version": settings.ACTIVE_BASKET_VERSION,
            "base_period": settings.INDEX_BASE_PERIOD,
            "base_value": settings.INDEX_BASE_VALUE,
            "index_family": "AirPulse Price Index (APIx)",
            "primary_formula": "APIx_t = 100 * sum(w_{r,b} * (P_{r,b,t} / P_{r,b,0})) / sum(w_{r,b})",
            "representative_fare_metric": "median_validated_normalized_fare",
            "rationale_for_median": (
                "Arithmetic mean is sensitive to extreme holiday peaks and last-minute emergency fares. "
                "The sample median represents the price paid by the typical consumer without distorting inflation trends."
            ),
            "coverage_quality_score_formula": "Q = 0.40 * Cr + 0.25 * Cs + 0.20 * F + 0.15 * V",
            "weights_source": "DGCA Domestic City-Pair Passenger Volume Statistics",
            "product_definition": {
                "cabin": "economy",
                "fare_components": "base_fare + mandatory_taxes + mandatory_fees",
                "excluded_ancillaries": "optional_meals, seat_selection, excess_baggage, travel_insurance",
                "standard_baggage_kg": 15.0,
            },
            "ml_firewall_policy": (
                "The statistical Airfare Price Index (APIx) is computed strictly from verified, observed quotes. "
                "XGBoost (FareGuard) and Isolation Forest (PriceGuard) are isolated to QA, expected fare benchmarking, "
                "and anomaly alerting, and do NOT alter the official index value."
            ),
            "missing_route_strategy": "Matched-route sample exclusion with carry-forward fallback if missing exceeds 48 hours",
        }
