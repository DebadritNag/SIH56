from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.utils import utc_now
from app.db.models import AuditEvent


class AuditService:
    """Enterprise Audit Service: Records government analyst decisions and administrative configuration changes."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def log_event(
        self,
        actor_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> AuditEvent:
        event = AuditEvent(
            id=uuid4(),
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            request_id=request_id,
            timestamp=utc_now(),
        )
        self.session.add(event)
        await self.session.flush()
        return event
