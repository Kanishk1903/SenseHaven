"""Parent session controls (P2.7): remote start, end, lock, adjust — each enqueues a command."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Parent, ScreenSession
from ..problems import ApiError
from ..services.analytics import active_device
from ..services.children import get_child_or_404
from ..services.commands import enqueue_command

router = APIRouter(tags=["sessions"])

MIN_DURATION_MIN = 5
MAX_DURATION_MIN = 480


class SessionStartIn(BaseModel):
    duration_min: int = Field(ge=MIN_DURATION_MIN, le=MAX_DURATION_MIN)


class AdjustIn(BaseModel):
    delta_seconds: int
    reason: str = Field(default="", max_length=200)


def get_session_or_404(parent: Parent, session_id: uuid.UUID, db: Session) -> ScreenSession:
    from ..models import Child

    session = db.get(ScreenSession, session_id)
    if session is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    child_row = db.get(Child, session.child_id)
    if child_row is None or child_row.parent_id != parent.id:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    return session


def _require_live(session: ScreenSession) -> None:
    if session.status not in ("pending", "active", "cooldown"):
        raise ApiError(409, "SESSION_NOT_ACTIVE", "There's no running session for that right now. Start one and try again.")


def _session_out(session: ScreenSession) -> dict:
    return {
        "id": str(session.id),
        "child_id": str(session.child_id),
        "status": session.status,
        "granted_s": session.granted_s,
        "bonus_s": session.bonus_s,
        "penalty_s": session.penalty_s,
        "used_s": session.used_s,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "end_reason": session.end_reason,
        "source": session.source,
    }


@router.post("/children/{child_id}/sessions", status_code=201, dependencies=[Depends(require_requested_with)])
def start_session(
    child_id: uuid.UUID,
    body: SessionStartIn,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    if active_device(db, child.id) is None:
        raise ApiError(
            409,
            "SESSION_NOT_ACTIVE",
            "Start needs a paired phone. Pair your child's phone first, then start a session.",
        )
    session = ScreenSession(
        child_id=child.id,
        device_id=active_device(db, child.id).id,
        status="pending",
        granted_s=body.duration_min * 60,
        source="parent_web",
    )
    db.add(session)
    db.flush()
    enqueue_command(db, child.id, "start_session", {"session_id": str(session.id), "duration_s": session.granted_s})
    db.commit()
    return _session_out(session)


def _session_command(
    session_id: uuid.UUID, parent: Parent, db: Session, kind: str
) -> dict:
    session = get_session_or_404(parent, session_id, db)
    _require_live(session)
    enqueue_command(db, session.child_id, kind, {"session_id": str(session.id)})
    db.commit()
    return {"queued": kind, "session_id": str(session.id)}


@router.post("/sessions/{session_id}/end", dependencies=[Depends(require_requested_with)])
def end_session(session_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> dict:
    return _session_command(session_id, parent, db, "end_session")


@router.post("/sessions/{session_id}/lock", dependencies=[Depends(require_requested_with)])
def lock_session(session_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> dict:
    return _session_command(session_id, parent, db, "lock_now")


@router.post("/sessions/{session_id}/adjust", dependencies=[Depends(require_requested_with)])
def adjust_session(
    session_id: uuid.UUID,
    body: AdjustIn,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    if body.delta_seconds == 0:
        raise ApiError(422, "VALIDATION_ERROR", "delta_seconds must be a positive or negative number of seconds.")
    session = get_session_or_404(parent, session_id, db)
    _require_live(session)
    kind = "add_time" if body.delta_seconds > 0 else "remove_time"
    enqueue_command(
        db,
        session.child_id,
        kind,
        {"session_id": str(session.id), "delta_s": abs(body.delta_seconds), "reason": body.reason},
    )
    db.commit()
    return {"queued": kind, "session_id": str(session.id), "delta_seconds": body.delta_seconds}
