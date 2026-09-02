# Domain Constants for AirPulse (SIH26056)

SUPPORTED_CURRENCIES = ["INR"]

# Price sanity bounds (in INR) - Broad sanity bounds, statistical anomalies are handled by ML
SANITY_MIN_FARE = 500.0
SANITY_MAX_FARE = 500000.0

# Booking window range (in days)
MIN_BOOKING_WINDOW_DAYS = 0
MAX_BOOKING_WINDOW_DAYS = 365

# Standardized Domestic Fare Product Spec for Index Matching
STANDARD_FARE_PRODUCT = {
    "cabin": "economy",
    "baggage_kg": 15.0,
    "refundable": False,
    "meal_included": False,
    "seat_included": False,
}

# Major Indian Airlines Fleet (2026 Reality: Vistara merged into Air India)
AIRLINE_CODES = {
    "6E": "IndiGo",
    "AI": "Air India",
    "IX": "Air India Express",
    "QP": "Akasa Air",
    "SG": "SpiceJet",
}

# Anomaly Percentile Bins for Calibration
ANOMALY_PERCENTILE_BINS = {
    "normal": (0.0, 0.60),
    "low": (0.60, 0.75),
    "medium": (0.75, 0.85),
    "high": (0.85, 0.95),
    "critical": (0.95, 1.00),
}

# Coverage Quality Score Weights: Q = 0.40*Cr + 0.25*Cs + 0.20*F + 0.15*V
WEIGHT_ROUTE_COVERAGE = 0.40
WEIGHT_SOURCE_COVERAGE = 0.25
WEIGHT_FRESHNESS = 0.20
WEIGHT_VALIDATION_RATE = 0.15
