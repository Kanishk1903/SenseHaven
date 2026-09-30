"""Device event ingest (P2.6): idempotent, single-transaction, device-authoritative numbers.

Server rules (File 03 binding):
- UNIQUE(child_id, client_uuid) + ON CONFLICT DO NOTHING for emotion/ledger rows.
- app_usage_daily upsert keyed (child, date, package) keeping the MAX seconds.
- session snapshot upserts by id with used_s/bonus_s/penalty_s = max(existing, reported);
  a session in ended|expired never returns to an earlier status.
- a stress_alert ledger event creates one alert (dedupe per session per 10-minute bucket).
- heartbeat losing a permission grant creates one alert per device per grant per day.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..models import Alert, AppUsageDaily, Child, Device, EmotionEvent, LedgerEvent, ScreenSession
from ..problems import ApiError
from ..schemas.device import EventsBatchIn

BATCH_LIMIT = 200
TERMINAL_STATUSES = {"ended", "expired"}
CURRENT_STATUSES = ("pending", "active", "cooldown")


def current_session(db: Session, child_id: uuid.UUID) -> ScreenSession | None:
    return db.scalar(
        select(ScreenSession)
        .where(ScreenSession.child_id == child_id, ScreenSession.status.in_(CURRENT_STATUSES))
        .order_by(ScreenSession.created_at.desc())
        .limit(1)
    )


def _upsert_alert(db: Session, **values) -> None:
    stmt = pg_insert(Alert).values(**values).on_conflict_do_nothing(index_elements=["dedupe_key"])
    db.execute(stmt)


def _stress_alert(db: Session, device: Device, item) -> None:
    child = db.get(Child, device.child_id)
    bucket = int(item.ts.timestamp() // 600) * 600
    cooldown_min = (child.settings or {}).get("cooldown_min", 5)
    _upsert_alert(
        db,
        parent_id=child.parent_id,
        child_id=child.id,
        kind="stress_alert",
        severity="warning",
        title=f"{child.name} had a stressful stretch — a {cooldown_min}-minute breather was started",
        body="SenseHeaven noticed a long run of stress signals and started a breather. No time was consumed during the pause.",
        payload={
            "session_id": str(item.session_id) if item.session_id else None,
            "ts": item.ts.isoformat(),
            "seconds": item.seconds,
        },
        dedupe_key=f"stress:{item.session_id}:{bucket}",
    )


def _upsert_session_snapshot(db: Session, device: Device, snapshot) -> None:
    existing = db.get(ScreenSession, snapshot.id)
    if existing is None:
        db.add(
            ScreenSession(
                id=snapshot.id,
                child_id=device.child_id,
                device_id=device.id,
                status=snapshot.status,
                granted_s=snapshot.granted_s,
                bonus_s=snapshot.bonus_s,
                penalty_s=snapshot.penalty_s,
                used_s=snapshot.used_s,
                started_at=snapshot.started_at,
                ended_at=snapshot.ended_at,
                end_reason=snapshot.end_reason,
                source=snapshot.source,
            )
        )
        db.flush()
        return
    if existing.child_id != device.child_id:
        return  # a device can never touch another child's session
    if existing.status in TERMINAL_STATUSES:
        return  # ended/expired sessions never reopen
    if existing.status in ("active", "cooldown") and snapshot.status == "pending":
        return  # never un-start a session
    existing.status = snapshot.status
    existing.granted_s = snapshot.granted_s
    existing.bonus_s = max(existing.bonus_s, snapshot.bonus_s)
    existing.penalty_s = max(existing.penalty_s, snapshot.penalty_s)
    existing.used_s = max(existing.used_s, snapshot.used_s)
    if snapshot.started_at is not None:
        existing.started_at = snapshot.started_at
    if snapshot.ended_at is not None:
        existing.ended_at = snapshot.ended_at
    if snapshot.end_reason is not None:
        existing.end_reason = snapshot.end_reason
    db.flush()


def _apply_heartbeat(db: Session, device: Device, heartbeat) -> None:
    now = datetime.now(timezone.utc)
    device.last_seen_at = now
    if heartbeat.battery_pct is not None:
        device.battery_pct = heartbeat.battery_pct

    previous = dict(device.permissions or {})
    grants = heartbeat.permissions.model_dump()
    updated = dict(previous)
    updated.update(grants)
    updated["camera_ok"] = heartbeat.camera_ok
    device.permissions = updated  # fresh dict so JSONB change is detected

    session = current_session(db, device.child_id)
    if session is not None and heartbeat.used_s > session.used_s:
        session.used_s = heartbeat.used_s

    today = now.date()
    child = db.get(Child, device.child_id)
    for grant, has_now in grants.items():
        if previous.get(grant) is True and has_now is False:
            _upsert_alert(
                db,
                parent_id=child.parent_id,
                child_id=child.id,
                kind="permission_revoked",
                severity="warning",
                title=f"{child.name}'s phone lost a permission",
                body=f"The '{grant}' permission was turned off. Emotion monitoring may pause until it is granted again.",
                payload={"grant": grant},
                dedupe_key=f"perm:{device.id}:{today}:{grant}",
            )


def ingest_events(db: Session, device: Device, batch: EventsBatchIn) -> dict:
    total = len(batch.emotion) + len(batch.ledger) + len(batch.app_usage) + len(batch.sessions)
    if total > BATCH_LIMIT:
        raise ApiError(
            413,
            "BATCH_TOO_LARGE",
            "That update was too big to accept at once. It will be resent in smaller parts.",
        )
    child_id = device.child_id
    accepted = {"emotion": 0, "ledger": 0, "app_usage": 0, "sessions": 0}

    # Sessions first: ledger/emotion rows carry FKs to them.
    for snapshot in batch.sessions:
        _upsert_session_snapshot(db, device, snapshot)
        accepted["sessions"] += 1

    if batch.emotion:
        rows = [
            {
                "child_id": child_id,
                "session_id": item.session_id,
                "client_uuid": item.client_uuid,
                "ts": item.ts,
                "calm_index": item.calm_index,
                "label": item.label,
                "face_present": item.face_present,
                "quality": item.quality,
            }
            for item in batch.emotion
        ]
        stmt = (
            pg_insert(EmotionEvent)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["child_id", "client_uuid"])
            .returning(EmotionEvent.id)
        )
        # rowcount is unreliable for multi-row inserts (insertmanyvalues) — count RETURNING rows.
        accepted["emotion"] = len(db.execute(stmt).all())

    if batch.ledger:
        rows = [
            {
                "child_id": child_id,
                "session_id": item.session_id,
                "client_uuid": item.client_uuid,
                "ts": item.ts,
                "kind": item.kind,
                "seconds": item.seconds,
                "reason": item.reason,
            }
            for item in batch.ledger
        ]
        stmt = (
            pg_insert(LedgerEvent)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["child_id", "client_uuid"])
            .returning(LedgerEvent.id)
        )
        accepted["ledger"] = len(db.execute(stmt).all())
        for item in batch.ledger:
            if item.kind == "stress_alert":
                _stress_alert(db, device, item)

    if batch.app_usage:
        best: dict[tuple, object] = {}
        for item in batch.app_usage:
            key = (item.date, item.package)
            if key not in best or item.seconds > best[key].seconds:
                best[key] = item
        rows = [
            {"child_id": child_id, "date": item.date, "package": item.package, "label": item.label, "seconds": item.seconds}
            for item in best.values()
        ]
        stmt = pg_insert(AppUsageDaily).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["child_id", "date", "package"],
            set_={
                "seconds": func.greatest(AppUsageDaily.seconds, stmt.excluded.seconds),
                "label": stmt.excluded.label,
            },
        )
        db.execute(stmt)
        accepted["app_usage"] = len(rows)

    if batch.heartbeat is not None:
        _apply_heartbeat(db, device, batch.heartbeat)

    db.commit()
    duplicates = total - sum(accepted.values())
    return {"accepted": accepted, "duplicates": duplicates}
