from fastapi import APIRouter
from app.api.v1 import (
    alerts,
    anomalies,
    audit,
    auth,
    backtest,
    dashboard,
    fares,
    health,
    index,
    ingestion,
    methodology,
    routes,
    runs,
    sources,
    system,
    exports,
    scraping,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(system.router)
api_router.include_router(ingestion.router)
api_router.include_router(scraping.router)
api_router.include_router(dashboard.router)
api_router.include_router(fares.router)
api_router.include_router(routes.router)
api_router.include_router(sources.router)
api_router.include_router(index.router)
api_router.include_router(anomalies.router)
api_router.include_router(alerts.router)
api_router.include_router(backtest.router)
api_router.include_router(methodology.router)
api_router.include_router(runs.router)
api_router.include_router(audit.router)
api_router.include_router(exports.router)
