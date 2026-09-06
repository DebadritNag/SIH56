"""Durable live collection: acquisition and ingestion are separate actions."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import UserContext, require_analyst, require_viewer
from app.db.session import get_db
from app.services.live_acquisition import enqueue_collection, enqueue_ingestion, get_live_run
from app.services.live_store import rows

router = APIRouter(prefix='/live', tags=['Live acquisition'])


class LiveRequest(BaseModel):
    source: Literal['yatra'] = 'yatra'
    origin: str = Field(pattern=r'^[A-Z]{3}$')
    destination: str = Field(pattern=r'^[A-Z]{3}$')
    departure_date: date
    engine: Literal['AUTO'] = 'AUTO'
    max_results: int = Field(default=10, ge=1, le=15)
    is_nonstop: bool | None = None

    @model_validator(mode='after')
    def valid_search(self):
        days = (self.departure_date - datetime.now(ZoneInfo('Asia/Kolkata')).date()).days
        if self.origin == self.destination or not 0 <= days <= 365:
            raise ValueError('Choose different airports and a departure within the next 365 days')
        return self


@router.get('/config')
async def configuration(user: UserContext = Depends(require_viewer)):
    return {'success': True, 'data': {
        'source': 'yatra', 'enabled': bool(settings.YATRA_PROTOTYPE_ENABLED and settings.YATRA_REVIEW_NOTES.strip()),
        'worker_enabled': settings.LIVE_WORKER_ENABLED, 'max_results': 15,
        'policy_status': 'MANUAL_REVIEW_REQUIRED',
        'message': 'Bounded Yatra prototype. Access challenges stop collection without bypass.'}}


@router.post('/runs', status_code=202)
async def collect(payload: LiveRequest, db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_analyst)):
    if not settings.LIVE_WORKER_ENABLED:
        raise HTTPException(503, 'Live worker is disabled')
    if not settings.YATRA_PROTOTYPE_ENABLED or not settings.YATRA_REVIEW_NOTES.strip():
        raise HTTPException(409, 'Set YATRA_PROTOTYPE_ENABLED=true and YATRA_REVIEW_NOTES on the backend')
    request = payload.model_dump(mode='json')
    request['booking_window_days'] = (payload.departure_date - datetime.now(ZoneInfo('Asia/Kolkata')).date()).days
    try:
        result = await enqueue_collection(db, request, UUID(user.user_id))
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {'success': True, 'data': result}


@router.get('/runs')
async def recent(db: AsyncSession = Depends(get_db), user: UserContext = Depends(require_viewer)):
    return {'success': True, 'data': await rows(db, """SELECT id,status,created_at,quotes_received,metadata
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
