import pytest
from app.core.constants import (
    WEIGHT_FRESHNESS,
    WEIGHT_ROUTE_COVERAGE,
    WEIGHT_SOURCE_COVERAGE,
    WEIGHT_VALIDATION_RATE,
)


def test_coverage_quality_score_formula():
    cr = 0.95  # 95% routes covered
    cs = 1.00  # 100% sources covered
    f = 1.00   # 100% freshness
    v = 0.98   # 98% validation rate

    q = (
        (WEIGHT_ROUTE_COVERAGE * cr)
        + (WEIGHT_SOURCE_COVERAGE * cs)
        + (WEIGHT_FRESHNESS * f)
        + (WEIGHT_VALIDATION_RATE * v)
    )
    score = round(q, 2)
    # 0.40*0.95 + 0.25*1.0 + 0.20*1.0 + 0.15*0.98 = 0.38 + 0.25 + 0.20 + 0.147 = 0.977 -> 0.98
    assert score == 0.98
    assert 0.0 <= score <= 1.0


def test_price_shock_formula_conditions():
    current_median = 8500.0
    hist_median = 6000.0
    pct_change = ((current_median - hist_median) / hist_median) * 100.0

    # 41.67% jump
    assert pct_change > 20.0

    mad = 350.0
    robust_zscore = (current_median - hist_median) / (1.4826 * mad)
    # (2500) / (518.91) = 4.81
    assert robust_zscore > 3.0
