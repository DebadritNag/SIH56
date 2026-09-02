import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import AsyncSessionLocal
from app.services.backtest_service import BacktestService


async def run_backtest_cli():
    print("Starting 30-Day Airfare Inflation Backtest...")
    async with AsyncSessionLocal() as session:
        service = BacktestService(session)
        today = date.today()
        start = today - timedelta(days=30)
        run = await service.execute_backtest(
            name="Official 30-Day SIH26056 Demonstration Backtest",
            start_date=start,
            end_date=today,
            benchmark_source="DGCA_DOMESTIC_PASSENGER_TRAFFIC_SERIES",
        )
        await session.commit()
        print(f"Backtest Completed! Status: {run.status}")
        print("Metrics Summary:")
        import json
        print(json.dumps(run.metrics, indent=2))


if __name__ == "__main__":
    asyncio.run(run_backtest_cli())
