"""Analytics + live-state services (P2.7). All range boundaries use the parent's IANA zone."""
import uuid
from datetime import UTC, datetime, time, timedelta
from datetime import date as date_type
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    AppUsageDaily,
    Child,
    Device,
    EmotionEvent,
    LedgerEvent,
    ScreenSession,
)
from ..problems import ApiError

CURRENT_STATUSES = ("pending", "active", "cooldown")
STALE_AFTER_S = 90


def range_bounds(range_name: str, tz: ZoneInfo, now: datetime) -> tuple[datetime, datetime]:
    """[start, end) UTC datetimes covering the parent-local range window."""
    today = now.astimezone(tz).date()
    if range_name == "today":
        start_date = today
    elif range_name == "7d":
        start_date = today - timedelta(days=6)
    elif range_name == "30d":
        start_date = today - timedelta(days=29)
    else:
        raise ApiError(422, "VALIDATION_ERROR", "range must be one of: today, 7d, 30d")
    start_local = datetime.combine(start_date, time.min, tzinfo=tz)
    end_local = datetime.combine(today + timedelta(days=1), time.min, tzinfo=tz)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def active_device(db: Session, child_id: uuid.UUID) -> Device | None:
    return db.scalar(
        select(Device).where(Device.child_id == child_id, Device.revoked_at.is_(None))
    )


def current_session(db: Session, child_id: uuid.UUID) -> ScreenSession | None:
    return db.scalar(
        select(ScreenSession)
        .where(ScreenSession.child_id == child_id, ScreenSession.status.in_(CURRENT_STATUSES))
        .order_by(ScreenSession.created_at.desc())
        .limit(1)
    )


def remaining_s(session: ScreenSession) -> int:
    return session.granted_s + session.bonus_s - session.penalty_s - session.used_s


def last_calm_index(db: Session, child_id: uuid.UUID) -> EmotionEvent | None:
    return db.scalar(
        select(EmotionEvent)
        .where(EmotionEvent.child_id == child_id, EmotionEvent.face_present.is_(True))
        .order_by(EmotionEvent.ts.desc())
        .limit(1)
    )


def live_state(db: Session, child: Child, now: datetime | None = None) -> dict:
    """The binding live shape: state, device, session, calm_index, remaining_s."""
    now = now or datetime.now(UTC)
    device = active_device(db, child.id)
    session = current_session(db, child.id)

    state = "unpaired"
    device_payload = None
    if device is not None:
        stale = device.last_seen_at is None or (now - device.last_seen_at).total_seconds() > STALE_AFTER_S
        state = "offline" if stale else ("locked" if session is None else session.status)
        device_payload = {
            "id": str(device.id),
            "name": device.name,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
            "stale": stale,
            "battery_pct": device.battery_pct,
            "camera_ok": bool((device.permissions or {}).get("camera_ok", False)),
            "permissions": device.permissions or {},
        }

    session_payload = None
    remaining = None
    if session is not None:
        session_payload = {
            "id": str(session.id),
            "status": session.status,
            "granted_s": session.granted_s,
            "bonus_s": session.bonus_s,
            "penalty_s": session.penalty_s,
            "used_s": session.used_s,
        }
        remaining = remaining_s(session)

    calm = last_calm_index(db, child.id)
    calm_payload = (
        None
        if calm is None
        else {"value": calm.calm_index, "label": calm.label, "ts": calm.ts.isoformat()}
    )

    return {
        "state": state,
        "device": device_payload,
        "session": session_payload,
        "calm_index": calm_payload,
        "remaining_s": remaining,
    }


def _session_used_in_range(session: ScreenSession, start: datetime, end: datetime, now: datetime) -> int:
    """E7: sum used_s deltas of sessions overlapping the range (pro-rated by overlap)."""
    if session.started_at is None:
        return 0
    session_end = session.ended_at or now
    duration = (session_end - session.started_at).total_seconds()
    if duration <= 0:
        return session.used_s if start <= session.started_at < end else 0
    overlap_start = max(session.started_at, start)
    overlap_end = min(session_end, end)
    overlap = (overlap_end - overlap_start).total_seconds()
    if overlap <= 0:
        return 0
    return int(round(session.used_s * (overlap / duration)))


def overview(db: Session, child: Child, tz: ZoneInfo, range_name: str) -> dict:
    now = datetime.now(UTC)
    start, end = range_bounds(range_name, tz, now)
    length = end - start
    prev_start, prev_end = start - length, start

    sessions = db.scalars(
        select(ScreenSession).where(
            ScreenSession.child_id == child.id,
            ScreenSession.started_at.is_not(None),
            ScreenSession.started_at < end,
        )
    ).all()
    screen_time_s = sum(_session_used_in_range(s, start, end, now) for s in sessions)

    def _mean_calm_in(lo: datetime, hi: datetime) -> float | None:
        values = db.scalars(
            select(EmotionEvent.calm_index).where(
                EmotionEvent.child_id == child.id,
                EmotionEvent.face_present.is_(True),
                EmotionEvent.ts >= lo,
                EmotionEvent.ts < hi,
            )
        ).all()
        return round(sum(values) / len(values), 1) if values else None

    avg_calm = _mean_calm_in(start, end)
    prev_avg = _mean_calm_in(prev_start, prev_end)
    trend = None
    if avg_calm is not None and prev_avg is not None and prev_avg != 0:
        trend = round((avg_calm - prev_avg) / prev_avg * 100, 1)

    stress_episodes = len(
        db.scalars(
            select(LedgerEvent.id).where(
                LedgerEvent.child_id == child.id,
                LedgerEvent.kind == "stress_alert",
                LedgerEvent.ts >= start,
                LedgerEvent.ts < end,
            )
        ).all()
    )

    def _ledger_seconds(kind: str, lo: datetime, hi: datetime) -> int:
        values = db.scalars(
            select(LedgerEvent.seconds).where(
                LedgerEvent.child_id == child.id,
                LedgerEvent.kind == kind,
                LedgerEvent.ts >= lo,
                LedgerEvent.ts < hi,
            )
        ).all()
        return sum(values)

    return {
        "range": range_name,
        "screen_time_s": screen_time_s,
        "avg_calm": avg_calm,
        "avg_calm_trend_pct": trend,
        "stress_episodes": stress_episodes,
        "bonus_s": _ledger_seconds("bonus", start, end),
        "penalty_s": _ledger_seconds("penalty", start, end),
        "sessions_count": len([s for s in sessions if start <= s.started_at < end]),
    }


def emotion_timeline(db: Session, child: Child, tz: ZoneInfo, local_date: date_type) -> dict:
    try:
        start_local = datetime.combine(local_date, time.min, tzinfo=tz)
    except Exception as error:
        raise ApiError(422, "VALIDATION_ERROR", "date must be YYYY-MM-DD") from error
    end_local = start_local + timedelta(days=1)
    start, end = start_local.astimezone(UTC), end_local.astimezone(UTC)

    events = db.scalars(
        select(EmotionEvent).where(
            EmotionEvent.child_id == child.id,
            EmotionEvent.face_present.is_(True),
            EmotionEvent.ts >= start,
            EmotionEvent.ts < end,
        )
    ).all()

    per_minute: dict[int, list[int]] = {}
    for event in events:
        local_ts = event.ts.astimezone(tz)
        minute = local_ts.hour * 60 + local_ts.minute
        per_minute.setdefault(minute, []).append(event.calm_index)

    buckets = []
    for minute in range(24 * 60):
        samples = per_minute.get(minute)
        local_minute = start_local + timedelta(minutes=minute)
        buckets.append(
            {
                "t": local_minute.isoformat(),
                "value": round(sum(samples) / len(samples), 1) if samples else None,
                "n": len(samples) if samples else 0,
            }
        )
    return {"date": local_date.isoformat(), "tz": str(tz), "buckets": buckets}


def app_usage(db: Session, child: Child, tz: ZoneInfo, range_name: str) -> dict:
    start, end = range_bounds(range_name, tz, datetime.now(UTC))
    start_date = start.astimezone(tz).date()
    end_date = (end - timedelta(seconds=1)).astimezone(tz).date()
    rows = db.execute(
        select(AppUsageDaily.package, AppUsageDaily.label, AppUsageDaily.seconds).where(
            AppUsageDaily.child_id == child.id,
            AppUsageDaily.date >= start_date,
            AppUsageDaily.date <= end_date,
        )
    ).all()
    totals: dict[str, dict] = {}
    for package, label, seconds in rows:
        entry = totals.setdefault(package, {"package": package, "label": label, "seconds": 0})
        entry["seconds"] += seconds
    ranked = sorted(totals.values(), key=lambda item: item["seconds"], reverse=True)
    blocked = set((child.settings or {}).get("blocked_packages", []))
    top = ranked[:10]
    for item in top:
        item["blocked"] = item["package"] in blocked
    other = sum(item["seconds"] for item in ranked[10:])
    return {"items": top, "other_seconds": other}


def sessions_list(db: Session, child: Child, tz: ZoneInfo, range_name: str) -> list[dict]:
    start, end = range_bounds(range_name, tz, datetime.now(UTC))
    sessions = db.scalars(
        select(ScreenSession)
        .where(
            ScreenSession.child_id == child.id,
            ScreenSession.created_at >= start,
            ScreenSession.created_at < end,
        )
        .order_by(ScreenSession.created_at.desc())
    ).all()

    out = []
    for session in sessions:
        ledger = db.scalars(
            select(LedgerEvent)
            .where(LedgerEvent.session_id == session.id)
            .order_by(LedgerEvent.ts)
        ).all()
        calm_values = db.scalars(
            select(EmotionEvent.calm_index).where(
                EmotionEvent.session_id == session.id, EmotionEvent.face_present.is_(True)
            )
        ).all()
        out.append(
            {
                "id": str(session.id),
                "status": session.status,
                "granted_s": session.granted_s,
                "bonus_s": session.bonus_s,
                "penalty_s": session.penalty_s,
                "used_s": session.used_s,
                "started_at": session.started_at.isoformat() if session.started_at else None,
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "end_reason": session.end_reason,
                "source": session.source,
                "avg_calm": round(sum(calm_values) / len(calm_values), 1) if calm_values else None,
                "ledger": [
                    {
                        "ts": event.ts.isoformat(),
                        "kind": event.kind,
                        "seconds": event.seconds,
                        "reason": event.reason,
                    }
                    for event in ledger
                ],
            }
        )
    return out
