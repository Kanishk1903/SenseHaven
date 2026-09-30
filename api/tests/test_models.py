"""P2.2 — schema constraints actually reject bad data; cascade delete removes child data."""
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.app.models import (
    Alert,
    AppUsageDaily,
    Child,
    Command,
    Device,
    EmotionEvent,
    LedgerEvent,
    Parent,
    ScreenSession,
)


def make_parent(db) -> Parent:
    parent = Parent(
        email="parent@example.com",
        password_hash="x",
        display_name="Parent",
        timezone="Asia/Kolkata",
    )
    db.add(parent)
    db.flush()
    return parent


def make_child(db, parent=None) -> Child:
    parent = parent or make_parent(db)
    child = Child(parent_id=parent.id, name="Aarav", settings={"config_version": 1})
    db.add(child)
    db.flush()
    return child


def test_duplicate_emotion_client_uuid_rejected(client, db_session=None):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        child = make_child(db)
        ts = datetime.now(UTC)
        db.add(
            EmotionEvent(
                child_id=child.id, client_uuid="evt-1", ts=ts, calm_index=70,
                label="calm", face_present=True, quality=0.9,
            )
        )
        db.commit()
        db.add(
            EmotionEvent(
                child_id=child.id, client_uuid="evt-1", ts=ts, calm_index=50,
                label="neutral", face_present=True, quality=0.9,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_duplicate_ledger_client_uuid_rejected(client):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        child = make_child(db)
        db.add(
            LedgerEvent(
                child_id=child.id, client_uuid="led-1", ts=datetime.now(UTC),
                kind="bonus", seconds=600,
            )
        )
        db.commit()
        db.add(
            LedgerEvent(
                child_id=child.id, client_uuid="led-1", ts=datetime.now(UTC),
                kind="bonus", seconds=600,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_only_one_active_device_per_child(client):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        child = make_child(db)
        db.add(Device(child_id=child.id, token_hash="t1", name="Phone"))
        db.commit()
        db.add(Device(child_id=child.id, token_hash="t2", name="Second phone"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_revoked_device_frees_child_slot(client):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        child = make_child(db)
        first = Device(child_id=child.id, token_hash="t1", name="Old phone")
        db.add(first)
        db.commit()
        first.revoked_at = datetime.now(UTC)
        db.commit()
        db.add(Device(child_id=child.id, token_hash="t2", name="New phone"))
        db.commit()  # must not raise
        devices = db.scalars(select(Device).where(Device.child_id == child.id)).all()
        assert len(devices) == 2


def test_alert_dedupe_key_unique(client):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        parent = make_parent(db)
        child = make_child(db, parent)
        db.add(Alert(parent_id=parent.id, child_id=child.id, kind="stress_alert",
                     severity="warning", title="t", dedupe_key="stress:s:1200"))
        db.commit()
        db.add(Alert(parent_id=parent.id, child_id=child.id, kind="stress_alert",
                     severity="warning", title="t2", dedupe_key="stress:s:1200"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_cascade_delete_child_removes_data(client):
    from api.app.db import SessionLocal

    with SessionLocal() as db:
        parent = make_parent(db)
        child = make_child(db, parent)
        now = datetime.now(UTC)
        session = ScreenSession(child_id=child.id, status="active", granted_s=3600, started_at=now)
        db.add(session)
        db.flush()
        db.add_all(
            [
                EmotionEvent(child_id=child.id, client_uuid="e1", ts=now, calm_index=70,
                             label="calm", face_present=True, quality=0.9),
                LedgerEvent(child_id=child.id, client_uuid="l1", ts=now, kind="bonus", seconds=600),
                AppUsageDaily(child_id=child.id, date=now.date(), package="com.youtube",
                              label="YouTube", seconds=120),
                Alert(parent_id=parent.id, child_id=child.id, kind="stress_alert",
                      severity="warning", title="t", dedupe_key="stress:s1"),
                Command(child_id=child.id, kind="start_session", payload={},
                        expires_at=now + timedelta(hours=24)),
                Device(child_id=child.id, token_hash="tk", name="Phone"),
            ]
        )
        db.commit()

        db.delete(child)
        db.commit()

        for model in (ScreenSession, EmotionEvent, LedgerEvent, AppUsageDaily, Alert, Command, Device):
            remaining = db.scalars(select(model)).all()
            assert remaining == [], f"{model.__tablename__} rows survived child delete"
