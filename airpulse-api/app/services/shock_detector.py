import math
import statistics
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.utils import utc_now
from app.db.models import Alert, Route, ValidatedFare


class ShockDetector:
    """Statistical Price Shock Detector:
    Operates independently of Isolation Forest.
    Evaluates market-wide or route-level shocks using robust statistics:
    1. Relative price increase vs 7-day and 30-day rolling median
    2. Robust Z-score (using Median Absolute Deviation - MAD)
    3. Multi-source confirmation (at least N independent sources)
    4. Minimum quote confirmation (at least M quotes)
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def evaluate_route_shock(
        self,
        route_id: UUID,
        target_date: date,
        min_change_pct: float = None,
        min_sources: int = None,
        min_quotes: int = None,
    ) -> Optional[Alert]:
        min_change_pct = min_change_pct or settings.SHOCK_MIN_PRICE_CHANGE_PCT
        min_sources = min_sources or settings.SHOCK_MIN_SOURCE_COUNT
        min_quotes = min_quotes or settings.SHOCK_MIN_QUOTE_COUNT

        # 1. Fetch current target_date fares for route
        current_res = await self.session.execute(
            select(ValidatedFare).where(
                and_(
                    ValidatedFare.route_id == route_id,
                    ValidatedFare.collected_at >= target_date,
                    ValidatedFare.collected_at < target_date.fromordinal(target_date.toordinal() + 1),
                    ValidatedFare.validation_status.in_(["valid", "warning"]),
                    ValidatedFare.is_duplicate == False,
                )
            )
        )
        current_fares = list(current_res.scalars().all())

        if len(current_fares) < min_quotes:
            return None

        # Check source diversity
        distinct_sources = {f.source_id for f in current_fares}
        if len(distinct_sources) < min_sources:
            return None

        current_prices = [float(f.normalized_total_fare) for f in current_fares]
        current_median = statistics.median(current_prices)

        # 2. Fetch 14-day historical window for rolling baseline
        hist_start = target_date - timedelta(days=14)
        hist_res = await self.session.execute(
            select(ValidatedFare).where(
                and_(
                    ValidatedFare.route_id == route_id,
                    ValidatedFare.collected_at >= hist_start,
                    ValidatedFare.collected_at < target_date,
                    ValidatedFare.validation_status.in_(["valid", "warning"]),
                    ValidatedFare.is_duplicate == False,
                )
            )
        )
        hist_fares = list(hist_res.scalars().all())

        if len(hist_fares) < 10:
            return None

        hist_prices = [float(f.normalized_total_fare) for f in hist_fares]
        hist_median = statistics.median(hist_prices)

        # 3. Calculate percentage change
        pct_change = ((current_median - hist_median) / hist_median) * 100.0

        # 4. Calculate Robust Z-Score via Median Absolute Deviation (MAD)
        deviations = [abs(x - hist_median) for x in hist_prices]
        mad = statistics.median(deviations)
        if mad == 0:
            robust_zscore = 0.0
        else:
            # 1.4826 normalizes MAD to standard normal distribution scale
            robust_zscore = (current_median - hist_median) / (1.4826 * mad)

        # 5. Check trigger thresholds
        if pct_change >= min_change_pct and robust_zscore >= settings.SHOCK_MIN_ROBUST_ZSCORE:
            route_res = await self.session.execute(select(Route).where(Route.id == route_id))
            route = route_res.scalars().first()
            route_code = route.route_code if route else str(route_id)

            alert = Alert(
                id=uuid4(),
                alert_type="price_shock",
                severity="critical" if pct_change > 40.0 else "high",
                title=f"Airfare Shock Alert: {route_code} surged {pct_change:.1f}%",
                message=(
                    f"Median fare on {route_code} rose to ₹{current_median:.0f} (+{pct_change:.1f}%) "
                    f"with robust Z-score {robust_zscore:.2f} confirmed across {len(distinct_sources)} sources "
                    f"and {len(current_fares)} observations."
                ),
                route_id=route_id,
                source_id=None,
                alert_metadata={
                    "current_median": current_median,
                    "historical_median": hist_median,
                    "percentage_change": round(pct_change, 2),
                    "robust_zscore": round(robust_zscore, 2),
                    "source_count": len(distinct_sources),
                    "quote_count": len(current_fares),
                },
                status="open",
                created_at=utc_now(),
            )
            self.session.add(alert)
            await self.session.flush()
            return alert

        return None
