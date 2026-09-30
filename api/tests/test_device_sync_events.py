"""P2.6 — sync versioning, idempotent ingest, monotonic used_s, command lifecycle, alerts."""
import uuid
from datetime import UTC, datetime, timedelta

from api.app.db import SessionLocal
from api.app.models import Alert, Device, EmotionEvent, LedgerEvent, ScreenSession
from api.app.services.commands import enqueue_command
from api.tests.test_pairing import REQ, issue_code, make_child, pair, set_pin


def device_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def paired(client) -> dict:
    set_pin(client)
    child = make_child(client)
    token = pair(client, issue_code(client, child["id"])).json()["device_token"]
    return {"token": token, "child": child, "headers": device_headers(token)}


def iso_now() -> str:
    return datetime.now(UTC).isoformat()


def emotion_items(n=1, session_id=None, **overrides) -> list[dict]:
    items = []
    for _ in range(n):
        item = {
            "client_uuid": f"emo-{uuid.uuid4()}",
            "ts": iso_now(),
            "calm_index": 75,
            "label": "calm",
            "face_present": True,
            "quality": 0.9,
        }
        if session_id:
            item["session_id"] = session_id
        item.update(overrides)
        items.append(item)
    return items


def ledger_items(n=1, session_id=None, kind="bonus", seconds=600, **overrides) -> list[dict]:
    items = []
    for _ in range(n):
        item = {
            "client_uuid": f"led-{uuid.uuid4()}",
            "ts": iso_now(),
            "kind": kind,
            "seconds": seconds,
        }
        if session_id:
            item["session_id"] = session_id
        item.update(overrides)
        items.append(item)
    return items


def session_snapshot(status="active", used_s=60, session_id=None, **overrides) -> dict:
    snapshot = {
        "id": str(session_id or uuid.uuid4()),
        "status": status,
        "granted_s": 3600,
        "bonus_s": 0,
        "penalty_s": 0,
        "used_s": used_s,
        "started_at": iso_now(),
        "source": "parent_web",
    }
    snapshot.update(overrides)
    return snapshot


def post_events(client, ctx, **items):
    body = {"sent_at": iso_now(), **items}
    return client.post("/api/v1/device/events", json=body, headers=ctx["headers"])


def sync(client, ctx, **params):
    return client.get("/api/v1/device/sync", params=params or None, headers=ctx["headers"])


def test_sync_shape_and_config_pin_versioning(parent_client):
    ctx = paired(parent_client)
    first = sync(parent_client, ctx).json()
    assert first["config_version"] == 1
    assert first["config"]["calm_threshold"] == 70
    assert first["pin"]["algo"] == "pbkdf2-sha256"
    assert first["pin_version"] == 2
    assert first["session"] is None and first["commands"] == []

    unchanged = sync(parent_client, ctx, config_version=1, pin_version=2).json()
    assert unchanged["config"] is None and unchanged["pin"] is None

    parent_client.patch(
        f"/api/v1/children/{ctx['child']['id']}/settings", json={"calm_threshold": 80}, headers=REQ
    )
    changed = sync(parent_client, ctx, config_version=1, pin_version=2).json()
    assert changed["config_version"] == 2 and changed["config"]["calm_threshold"] == 80

    parent_client.put(
        "/api/v1/parents/me/pin", json={"password": "correct-horse-battery", "pin": "654321"}, headers=REQ
    )
    new_pin = sync(parent_client, ctx, config_version=2, pin_version=2).json()
    assert new_pin["pin"] is not None and new_pin["pin_version"] == 3


def test_sync_returns_device_session(parent_client):
    ctx = paired(parent_client)
    post_events(parent_client, ctx, sessions=[session_snapshot(status="active", used_s=60)])
    body = sync(parent_client, ctx).json()
    assert body["session"]["status"] == "active"
    assert body["session"]["used_s"] == 60


def test_events_idempotent_replay(parent_client):
    ctx = paired(parent_client)
    snap = session_snapshot(status="active", used_s=100)
    batch = {
        "sessions": [snap],
        "emotion": emotion_items(2, session_id=snap["id"]),
        "ledger": ledger_items(1, session_id=snap["id"]),
        "app_usage": [{"date": iso_now()[:10], "package": "com.youtube", "label": "YouTube", "seconds": 120}],
    }
    first = post_events(parent_client, ctx, **batch).json()
    assert first["accepted"] == {"emotion": 2, "ledger": 1, "app_usage": 1, "sessions": 1}
    assert first["duplicates"] == 0

    second = post_events(parent_client, ctx, **batch).json()
    assert second["accepted"]["emotion"] == 0 and second["accepted"]["ledger"] == 0
    assert second["duplicates"] == 3

    with SessionLocal() as db:
        assert db.query(EmotionEvent).count() == 2
        assert db.query(LedgerEvent).count() == 1


def test_used_s_is_monotonic(parent_client):
    ctx = paired(parent_client)
    snap = session_snapshot(status="active", used_s=100)
    post_events(parent_client, ctx, sessions=[snap])
    post_events(parent_client, ctx, heartbeat={"used_s": 150, "camera_ok": True})
    post_events(parent_client, ctx, sessions=[dict(snap, used_s=120)])
    post_events(parent_client, ctx, heartbeat={"used_s": 90, "camera_ok": True})
    assert sync(parent_client, ctx).json()["session"]["used_s"] == 150


def test_ended_session_never_reopens(parent_client):
    ctx = paired(parent_client)
    snap = session_snapshot(status="active", used_s=300)
    post_events(parent_client, ctx, sessions=[snap])
    post_events(
        parent_client, ctx, sessions=[dict(snap, status="ended", ended_at=iso_now(), end_reason="expired")]
    )
    post_events(parent_client, ctx, sessions=[dict(snap, status="active")])
    with SessionLocal() as db:
        row = db.get(ScreenSession, uuid.UUID(snap["id"]))
        assert row.status == "ended"
        assert row.end_reason == "expired"


def test_stress_alert_dedupe_per_10min_bucket(parent_client):
    ctx = paired(parent_client)
    snap = session_snapshot(status="active", used_s=400)
    post_events(parent_client, ctx, sessions=[snap])
    # Anchor inside a 10-minute bucket so +5 min stays in-bucket and +15 min lands in the next.
    bucket_start = int(datetime.now(UTC).timestamp() // 600) * 600
    ts = datetime.fromtimestamp(bucket_start, UTC) + timedelta(minutes=1)
    post_events(
        parent_client,
        ctx,
        ledger=ledger_items(1, session_id=snap["id"], kind="stress_alert", seconds=300, ts=ts.isoformat()),
    )
    post_events(
        parent_client,
        ctx,
        ledger=ledger_items(
            1, session_id=snap["id"], kind="stress_alert", seconds=300, ts=(ts + timedelta(minutes=5)).isoformat()
        ),
    )
    with SessionLocal() as db:
        alerts = db.query(Alert).filter(Alert.kind == "stress_alert").all()
        assert len(alerts) == 1
        assert "breather" in alerts[0].title
    post_events(
        parent_client,
        ctx,
        ledger=ledger_items(
            1, session_id=snap["id"], kind="stress_alert", seconds=300, ts=(ts + timedelta(minutes=15)).isoformat()
        ),
    )
    with SessionLocal() as db:
        assert db.query(Alert).filter(Alert.kind == "stress_alert").count() == 2


def test_permission_revoked_once_per_day(parent_client):
    ctx = paired(parent_client)
    perms = {"camera": True, "notifications": True, "usage_access": True, "overlay": True}
    post_events(parent_client, ctx, heartbeat={"used_s": 10, "camera_ok": True, "permissions": perms})
    post_events(parent_client, ctx, heartbeat={"used_s": 20, "camera_ok": False, "permissions": {**perms, "camera": False}})
    with SessionLocal() as db:
        assert db.query(Alert).filter(Alert.kind == "permission_revoked").count() == 1
    # same-day repeats stay deduped; a different grant gets its own alert
    post_events(parent_client, ctx, heartbeat={"used_s": 30, "camera_ok": True, "permissions": {**perms, "camera": True}})
    post_events(parent_client, ctx, heartbeat={"used_s": 40, "camera_ok": False, "permissions": {**perms, "camera": False}})
    post_events(
        parent_client, ctx,
        heartbeat={"used_s": 50, "camera_ok": False, "permissions": {**perms, "notifications": False}},
    )
    with SessionLocal() as db:
        assert db.query(Alert).filter(Alert.kind == "permission_revoked").count() == 2


def test_command_lifecycle(parent_client):
    ctx = paired(parent_client)
    with SessionLocal() as db:
        command = enqueue_command(db, uuid.UUID(ctx["child"]["id"]), "add_time", {"delta_s": 300})
        command_id = command.id
        expired = enqueue_command(db, uuid.UUID(ctx["child"]["id"]), "lock_now", {})
        expired.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()

    listed = sync(parent_client, ctx).json()["commands"]
    assert [c["id"] for c in listed] == [command_id]

    assert parent_client.post(f"/api/v1/device/commands/{command_id}/ack", headers=ctx["headers"]).status_code == 204
    assert sync(parent_client, ctx).json()["commands"] == []
    assert parent_client.post(f"/api/v1/device/commands/{command_id}/ack", headers=ctx["headers"]).status_code == 204
    assert parent_client.post("/api/v1/device/commands/999999/ack", headers=ctx["headers"]).status_code == 404


def test_expired_command_not_returned(parent_client):
    ctx = paired(parent_client)
    with SessionLocal() as db:
        command = enqueue_command(db, uuid.UUID(ctx["child"]["id"]), "add_time", {"delta_s": 300})
        command.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    assert sync(parent_client, ctx).json()["commands"] == []


def test_batch_over_200_items_413(parent_client):
    ctx = paired(parent_client)
    response = post_events(parent_client, ctx, emotion=emotion_items(201))
    assert response.status_code == 413
    assert response.json()["code"] == "BATCH_TOO_LARGE"


def test_malformed_items_422(parent_client):
    ctx = paired(parent_client)
    assert post_events(parent_client, ctx, emotion=emotion_items(1, calm_index=150)).status_code == 422
    assert post_events(parent_client, ctx, emotion=emotion_items(1, label="furious")).status_code == 422
    assert post_events(parent_client, ctx, emotion=emotion_items(1, unexpected_field=1)).status_code == 422
    bad_usage = [{"date": "2026-09-30", "package": "com.x", "seconds": -5}]
    assert post_events(parent_client, ctx, app_usage=bad_usage).status_code == 422


def test_heartbeat_route_updates_device(parent_client):
    ctx = paired(parent_client)
    response = parent_client.post(
        "/api/v1/device/heartbeat",
        json={"used_s": 0, "battery_pct": 55, "camera_ok": False, "permissions": {"camera": True}},
        headers=ctx["headers"],
    )
    assert response.status_code == 200
    with SessionLocal() as db:
        import hashlib

        token_hash = hashlib.sha256(ctx["token"].encode()).hexdigest()
        device = db.query(Device).filter(Device.token_hash == token_hash).one()
        assert device.battery_pct == 55
        assert device.permissions["camera_ok"] is False
        assert device.last_seen_at is not None
