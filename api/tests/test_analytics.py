"""P2.7 — analytics correctness: DST timeline buckets, empty-data nulls, live-state derivation."""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from api.app.db import SessionLocal
from api.app.main import create_app
from api.app.models import Child, EmotionEvent, Parent
from api.tests.test_device_sync_events import (
    paired,
    post_events,
    session_snapshot,
)
from api.tests.test_pairing import REQ, set_pin


def register_with_tz(client, email, tz):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse-battery", "display_name": "Tz",
              "timezone": tz},
        headers=REQ,
    )
    assert response.status_code == 201


def make_child_direct(db, parent_email) -> str:
    parent = db.query(Parent).filter(Parent.email == parent_email).one()
    child = Child(parent_id=parent.id, name="Berlin Kid", settings={"config_version": 1})
    db.add(child)
    db.commit()
    return str(child.id)


def test_timeline_handles_dst_transition_day(parent_client):
    # Berlin spring-forward: 2026-03-29 02:00 -> 03:00. A local day still has 1440 minutes.
    with TestClient(create_app()) as berlin:
        register_with_tz(berlin, "berlin@example.com", "Europe/Berlin")
        set_pin(berlin)
        with SessionLocal() as db:
            child_id = make_child_direct(db, "berlin@example.com")
        # 12:00 local CEST (UTC+2) = 10:00 UTC; 01:30 local (UTC+1, before the jump) = 00:30 UTC.
        for hour, minute in ((10, 0), (0, 30)):
            with SessionLocal() as db:
                db.add(
                    EmotionEvent(
                        child_id=uuid.UUID(child_id), client_uuid=f"dst-{hour}-{minute}",
                        ts=datetime(2026, 3, 29, hour, minute, tzinfo=UTC),
                        calm_index=72, label="calm", face_present=True, quality=0.9,
                    )
                )
                db.commit()
        response = berlin.get(f"/api/v1/children/{child_id}/analytics/emotion-timeline?date=2026-03-29")
        assert response.status_code == 200
        body = response.json()
        assert body["tz"] == "Europe/Berlin"
        assert len(body["buckets"]) == 1440
        by_t = {bucket["t"]: bucket for bucket in body["buckets"]}
        noon = by_t["2026-03-29T12:00:00+02:00"]
        assert noon["n"] == 1 and noon["value"] == 72
        early = by_t["2026-03-29T01:30:00+01:00"]
        assert early["n"] == 1 and early["value"] == 72
        gaps = [b for b in body["buckets"] if b["value"] is None]
        assert len(gaps) == 1438  # gaps stay gaps — never interpolated


def test_empty_data_returns_nulls_and_empty_arrays_never_500(parent_client):
    child = parent_client.post("/api/v1/children", json={"name": "NoData"}, headers=REQ).json()

    overview = parent_client.get(f"/api/v1/children/{child['id']}/analytics/overview?range=7d")
    assert overview.status_code == 200
    assert overview.json()["screen_time_s"] == 0
    assert overview.json()["avg_calm"] is None
    assert overview.json()["avg_calm_trend_pct"] is None

    timeline = parent_client.get(
        f"/api/v1/children/{child['id']}/analytics/emotion-timeline?date=2026-09-30"
    ).json()
    assert len(timeline["buckets"]) == 1440
    assert all(bucket["value"] is None and bucket["n"] == 0 for bucket in timeline["buckets"])

    usage = parent_client.get(f"/api/v1/children/{child['id']}/analytics/app-usage?range=30d").json()
    assert usage == {"items": [], "other_seconds": 0}
    assert parent_client.get(f"/api/v1/children/{child['id']}/analytics/sessions?range=30d").json() == []


def test_live_state_transitions(parent_client):
    # unpaired: no device ever
    child = parent_client.post("/api/v1/children", json={"name": "States"}, headers=REQ).json()
    assert parent_client.get(f"/api/v1/children/{child['id']}/live").json()["state"] == "unpaired"

    ctx = paired(parent_client)  # pairs, but has never synced -> stale
    child_id = ctx["child"]["id"]
    live = parent_client.get(f"/api/v1/children/{child_id}/live").json()
    assert live["state"] == "offline"
    assert live["device"]["stale"] is True

    # fresh sync + no session -> locked
    parent_client.get("/api/v1/device/sync", headers=ctx["headers"])
    live = parent_client.get(f"/api/v1/children/{child_id}/live").json()
    assert live["state"] == "locked"

    # active session -> active with remaining time
    snap = session_snapshot(status="active", used_s=600)
    post_events(parent_client, ctx, sessions=[snap],
                heartbeat={"used_s": 600, "camera_ok": True})
    live = parent_client.get(f"/api/v1/children/{child_id}/live").json()
    assert live["state"] == "active"
    assert live["remaining_s"] == snap["granted_s"] - 600
    assert live["calm_index"] is None or live["calm_index"]["label"] in ("calm", "neutral", "stressed")


def test_overview_counters_from_seeded_day(parent_client):
    ctx = paired(parent_client)
    child_id = ctx["child"]["id"]
    started = datetime.now(UTC).replace(second=0, microsecond=0) - timedelta(minutes=30)
    iso = started.isoformat()
    snap = {
        "id": str(uuid.uuid4()), "status": "ended", "granted_s": 3600, "bonus_s": 600,
        "penalty_s": 300, "used_s": 600, "started_at": iso,
        "ended_at": (started + timedelta(minutes=30)).isoformat(), "end_reason": "expired",
        "source": "parent_web",
    }
    emotion = [
        {"client_uuid": f"ov-{uuid.uuid4().hex[:8]}", "session_id": snap["id"],
         "ts": (started + timedelta(minutes=m)).isoformat(),
         "calm_index": ci, "label": "calm" if ci >= 70 else "stressed",
         "face_present": True, "quality": 0.9}
        for m, ci in ((0, 80), (5, 80), (10, 80), (15, 40))
    ]
    ledger = [
        {"client_uuid": f"ovl-{uuid.uuid4().hex[:8]}", "session_id": snap["id"],
         "ts": (started + timedelta(minutes=10)).isoformat(), "kind": "bonus", "seconds": 600},
        {"client_uuid": f"ovl-{uuid.uuid4().hex[:8]}", "session_id": snap["id"],
         "ts": (started + timedelta(minutes=20)).isoformat(), "kind": "penalty", "seconds": 300},
        {"client_uuid": f"ovl-{uuid.uuid4().hex[:8]}", "session_id": snap["id"],
         "ts": (started + timedelta(minutes=20)).isoformat(), "kind": "stress_alert", "seconds": 300},
    ]
    usage = [{"date": started.date().isoformat(), "package": "com.youtube",
              "label": "YouTube", "seconds": 480}]
    response = post_events(parent_client, ctx, sessions=[snap], emotion=emotion,
                           ledger=ledger, app_usage=usage,
                           heartbeat={"used_s": 600, "camera_ok": True})
    assert response.status_code == 200

    overview = parent_client.get(f"/api/v1/children/{child_id}/analytics/overview?range=today").json()
    assert overview["screen_time_s"] == 600
    assert overview["avg_calm"] == 70.0  # mean of 80, 80, 80, 40
    assert overview["stress_episodes"] == 1
    assert overview["bonus_s"] == 600
    assert overview["penalty_s"] == 300
    assert overview["sessions_count"] == 1

    usage_response = parent_client.get(f"/api/v1/children/{child_id}/analytics/app-usage?range=today").json()
    assert usage_response["items"][0]["package"] == "com.youtube"
    assert usage_response["items"][0]["seconds"] == 480

    sessions = parent_client.get(f"/api/v1/children/{child_id}/analytics/sessions?range=today").json()
    assert sessions[0]["avg_calm"] == 70.0
    kinds = [entry["kind"] for entry in sessions[0]["ledger"]]
    assert kinds == ["bonus", "penalty", "stress_alert"]
