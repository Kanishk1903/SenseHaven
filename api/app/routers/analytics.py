"""Parent reads: live state + analytics (P2.7)."""
import uuid
from datetime import date
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db
from ..models import Parent
from ..services.analytics import app_usage, emotion_timeline, live_state, overview, sessions_list
from ..services.children import get_child_or_404

router = APIRouter(prefix="/children", tags=["analytics"])


def _tz(parent: Parent) -> ZoneInfo:
    return ZoneInfo(parent.timezone)


@router.get("/{child_id}/live")
def live(child_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> dict:
    child = get_child_or_404(parent, child_id, db)
    return live_state(db, child)


@router.get("/{child_id}/analytics/overview")
def overview_route(
    child_id: uuid.UUID,
    range: str = Query(default="today", pattern="^(today|7d|30d)$"),
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    return overview(db, child, _tz(parent), range)


@router.get("/{child_id}/analytics/emotion-timeline")
def timeline_route(
    child_id: uuid.UUID,
    date: date = Query(...),
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    return emotion_timeline(db, child, _tz(parent), date)


@router.get("/{child_id}/analytics/app-usage")
def app_usage_route(
    child_id: uuid.UUID,
    range: str = Query(default="today", pattern="^(today|7d|30d)$"),
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    return app_usage(db, child, _tz(parent), range)


@router.get("/{child_id}/analytics/sessions")
def sessions_route(
    child_id: uuid.UUID,
    range: str = Query(default="7d", pattern="^(today|7d|30d)$"),
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> list[dict]:
    child = get_child_or_404(parent, child_id, db)
    return sessions_list(db, child, _tz(parent), range)
