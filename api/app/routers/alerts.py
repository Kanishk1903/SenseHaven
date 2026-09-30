"""Alerts inbox (P2.7)."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Alert, Parent
from ..problems import ApiError

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _alert_out(alert: Alert) -> dict:
    return {
        "id": str(alert.id),
        "child_id": str(alert.child_id),
        "kind": alert.kind,
        "severity": alert.severity,
        "title": alert.title,
        "body": alert.body,
        "payload": alert.payload,
        "created_at": alert.created_at.isoformat(),
        "read_at": alert.read_at.isoformat() if alert.read_at else None,
    }


@router.get("")
def list_alerts(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> list[dict]:
    alerts = db.scalars(
        select(Alert).where(Alert.parent_id == parent.id).order_by(Alert.created_at.desc()).limit(200)
    ).all()
    return [_alert_out(alert) for alert in alerts]


@router.post("/{alert_id}/read", status_code=204, dependencies=[Depends(require_requested_with)])
def mark_read(alert_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> None:
    alert = db.get(Alert, alert_id)
    if alert is None or alert.parent_id != parent.id:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    alert.read_at = alert.read_at or datetime.now(UTC)
    db.commit()


@router.post("/read-all", status_code=204, dependencies=[Depends(require_requested_with)])
def mark_all_read(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> None:
    now = datetime.now(UTC)
    for alert in db.scalars(
        select(Alert).where(Alert.parent_id == parent.id, Alert.read_at.is_(None))
    ):
        alert.read_at = now
    db.commit()
