from typing import Any, Dict, List


class QuoteTrustService:
    """Calculates a non-binding Quote Trust Score [0.0 - 1.0] for analyst context and QA inspection.
    NOTE: As per MoSPI / RBI audit rules, this trust score does NOT directly mutate or substitute the official index."""

    @staticmethod
    def calculate_score(
        source_reliability: float,
        validation_status: str,
        is_duplicate: bool,
        has_flight_number: bool,
        has_breakdown: bool,
    ) -> Dict[str, Any]:
        score = source_reliability * 0.40
        reasons: List[str] = []

        if validation_status == "valid":
            score += 0.25
            reasons.append("Passed all strict validation constraints")
        elif validation_status == "warning":
            score += 0.10
            reasons.append("Passed with warnings (e.g. boundary checks)")
        else:
            reasons.append("Rejected by schema validator")

        if not is_duplicate:
            score += 0.15
            reasons.append("Unique primary quote observation")
        else:
            reasons.append("Duplicate quote within current collection bucket")

        if has_flight_number:
            score += 0.10
            reasons.append("Authoritative flight identifier present")
        else:
            reasons.append("Aggregated or generic flight identifier")

        if has_breakdown:
            score += 0.10
            reasons.append("Granular base fare and tax breakdown verified")

        score = round(max(0.0, min(1.0, score)), 2)

        if score >= 0.85:
            grade = "high"
        elif score >= 0.65:
            grade = "medium"
        else:
            grade = "low"

        return {
            "score": score,
            "grade": grade,
            "reasons": reasons,
        }
