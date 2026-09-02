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

    @staticmethod
    def _coerce_actor(actor_id: Optional[str]) -> Optional[UUID]:
        """actor_id is a uuid column; anonymous/system actors are recorded as NULL."""
        if not actor_id:
            return None
        try:
            return UUID(str(actor_id))
        except (ValueError, TypeError):
            return None

    async def log_event(
        self,
        actor_id: Optional[str],
        action: str,
        entity_type: str,
        entity_id: str,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        event_metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditEvent:
        event = AuditEvent(
            id=uuid4(),
            actor_id=self._coerce_actor(actor_id),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            request_id=request_id,
            event_metadata=event_metadata,
            created_at=utc_now(),
        )
        self.session.add(event)
        await self.session.flush()
        return event
