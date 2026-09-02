from typing import Tuple
from app.core.enums import EligibilityReason, ValidationStatus
from app.schemas.fare import NormalizedFareRecord


class EligibilityService:
    """Evaluates whether a validated fare qualifies for the official statistical Airfare Price Index (APIx).
    Persists deterministic reason codes into fare_index_eligibility."""

    @staticmethod
    def evaluate_eligibility(
        fare: NormalizedFareRecord,
        validation_status: ValidationStatus,
        is_duplicate: bool,
    ) -> Tuple[bool, EligibilityReason]:
        # 1. Duplicates are retained for data collection audit but excluded from price index weighting
        if is_duplicate:
            return False, EligibilityReason.DUPLICATE

        # 2. Schema rejections
        if validation_status == ValidationStatus.REJECTED:
            return False, EligibilityReason.INVALID_COMPONENTS

        # 3. Currency support
        if fare.currency != "INR":
            return False, EligibilityReason.UNSUPPORTED_CURRENCY

        # 4. Standard booking window range (0 - 45 days standard index basket)
        if fare.booking_window_days > 45:
            return False, EligibilityReason.OUTSIDE_BOOKING_WINDOW

        # 5. Fare product matching (Economy cabin required for standard consumer price index)
        if fare.cabin_class != "economy":
            return False, EligibilityReason.INSUFFICIENT_PRODUCT_MATCH

        return True, EligibilityReason.VALID
