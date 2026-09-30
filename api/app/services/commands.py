"""Command queue service (P2.6+). Commands expire after 24 h (File 01 §E5)."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..models import Command

COMMAND_TTL_S = 24 * 3600


def enqueue_command(
    db: Session, child_id: uuid.UUID, kind: str, payload: dict, device_id: uuid.UUID | None = None
) -> Command:
    command = Command(
        child_id=child_id,
        device_id=device_id,
        kind=kind,
        payload=payload,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=COMMAND_TTL_S),
    )
    db.add(command)
    db.flush()
    return command
