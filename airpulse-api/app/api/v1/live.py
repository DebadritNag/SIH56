"""Durable live collection: acquisition and ingestion are separate actions."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.collectors.corridors import LIVE_CORRIDORS, validate_corridor
from app.core.security import UserContext, require_analyst, require_viewer
from app.db.session import get_db
from app.services.live_acquisition import enqueue_collection, enqueue_ingestion, get_live_run
from app.services.live_store import rows

router = APIRouter(prefix='/live', tags=['Live acquisition'])


class LiveRequest(BaseModel):
    source: Literal['yatra', 'happyfares'] = 'yatra'
    origin: str = Field(pattern=r'^[A-Z]{3}$')
    destination: str = Field(pattern=r'^[A-Z]{3}$')
    departure_date: date
    engine: Literal['AUTO', 'CRAWL4AI'] = 'AUTO'
    max_results: int = Field(default=10, ge=1, le=15)
    is_nonstop: bool | None = None

    @model_validator(mode='after')
    def valid_search(self):
        days = (self.departure_date - datetime.now(ZoneInfo('Asia/Kolkata')).date()).days
        if days < 0:
            raise ValueError('Departure date must not be in the past (Asia/Kolkata).')
        validate_corridor(self.origin, self.destination)
        if self.source == 'happyfares':
            self.engine = 'CRAWL4AI'
        elif self.engine == 'CRAWL4AI':
            raise ValueError('Crawl4AI is configured for HappyFares only')
        return self


def source_enabled(source):
    if source == 'happyfares':
        return bool(settings.CRAWL4AI_ENABLED and settings.HAPPYFARES_PROTOTYPE_ENABLED and settings.HAPPYFARES_REVIEW_NOTES.strip())
    return bool(settings.YATRA_PROTOTYPE_ENABLED and settings.YATRA_REVIEW_NOTES.strip())

@router.get('/config')
async def configuration(source: Literal['yatra', 'happyfares'] = 'yatra', user: UserContext = Depends(require_viewer), db: AsyncSession = Depends(get_db)):
    from app.core.utils import utc_now
    from app.services.live_acquisition import source_cooldown
    now = utc_now()
    source_rows = await rows(db, 'SELECT last_failure_at FROM sources WHERE name=:source LIMIT 1', source=source)
    cooldown_until = source_cooldown(source_rows[0], now) if source_rows else None
    from app.services.memory_budget import require_browser_memory
    browser_available, browser_message = None, 'Browser availability is checked on the Celery worker when collection starts.'
    if source != 'happyfares':
        browser_available, browser_message = True, None
        try:
            require_browser_memory()
        except MemoryError as exc:
            browser_available, browser_message = False, str(exc)
    return {'success': True, 'data': {
        'corridors': LIVE_CORRIDORS,
        'source': source, 'enabled': source_enabled(source),
        'server_now': now.isoformat(),
        'cooldown_until': cooldown_until.isoformat() if cooldown_until else None,
        'browser_available': browser_available, 'browser_message': browser_message,
        'worker_enabled': settings.CRAWL4AI_ENABLED if source == 'happyfares' else settings.LIVE_WORKER_ENABLED, 'max_results': 15,
        'engine': 'CRAWL4AI' if source == 'happyfares' else 'PLAYWRIGHT',
        'execution_host': 'celery' if source == 'happyfares' else 'embedded',
        'policy_status': 'REVIEW_CONFIGURED' if source_enabled(source) else 'MANUAL_REVIEW_REQUIRED',
        'message': 'Bounded public-page prototype. Access challenges stop collection without bypass.'}}


@router.post('/runs', status_code=202)
async def collect(payload: LiveRequest, db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_analyst)):
    if payload.source != 'happyfares' and not settings.LIVE_WORKER_ENABLED:
        raise HTTPException(503, 'Live worker is disabled')
    if not source_enabled(payload.source):
        extra = ' and CRAWL4AI_ENABLED=true' if payload.source == 'happyfares' else ''
        raise HTTPException(409, f'Set {payload.source.upper()}_PROTOTYPE_ENABLED=true and {payload.source.upper()}_REVIEW_NOTES after review{extra}')
    from app.services.memory_budget import require_browser_memory
    if payload.source != 'happyfares':
        try:
            require_browser_memory()
        except MemoryError as exc:
            raise HTTPException(503, str(exc)) from exc
    request = payload.model_dump(mode='json')
    request['booking_window_days'] = (payload.departure_date - datetime.now(ZoneInfo('Asia/Kolkata')).date()).days
    try:
        result = await enqueue_collection(db, request, UUID(user.user_id))
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {'success': True, 'data': result}


@router.get('/runs')
async def recent(db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_viewer)):
    return {'success': True, 'data': await rows(db, """SELECT id,status,created_at,started_at,finished_at,quotes_received,metadata
        FROM collection_runs WHERE run_type='LIVE_ACQUISITION' ORDER BY created_at DESC LIMIT 30""")}


@router.get('/runs/{run_id}')
async def detail(run_id: UUID, db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_viewer)):
    try:
        return {'success': True, 'data': await get_live_run(db, run_id)}
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post('/runs/{run_id}/ingest', status_code=202)
async def ingest(run_id: UUID, db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_analyst)):
    if not settings.LIVE_WORKER_ENABLED:
        raise HTTPException(503, 'Live worker is disabled')
    try:
        return {'success': True, 'data': await enqueue_ingestion(db, run_id, UUID(user.user_id))}
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
