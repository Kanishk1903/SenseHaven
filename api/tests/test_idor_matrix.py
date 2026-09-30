"""P2.8 — IDOR matrix: every parent route with a path id must 404 across tenants.

The matrix is built from a request factory per route template; a check at the end asserts the
factory covers EVERY discovered parent route with a path parameter, so new routes cannot dodge
the matrix.
"""
import uuid

from api.app.main import create_app
from api.tests.test_pairing import REQ, issue_code, pair, set_pin

NOT_FOUND = 404


def register(client, email):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "display_name": email.split("@")[0],
            "timezone": "Asia/Kolkata",
        },
        headers=REQ,
    )
    assert response.status_code == 201
    return client


def provision(client, email, child_name):
    """Register, PIN, child, pairing, device, active session, stress alert."""
    register(client, email)
    set_pin(client)
    child = client.post("/api/v1/children", json={"name": child_name}, headers=REQ).json()
    token = pair(client, issue_code(client, child["id"]), f"{child_name}-phone").json()["device_token"]
    headers = {"Authorization": f"Bearer {token}"}
    session_id = str(uuid.uuid4())
    now_iso = "2026-09-30T10:00:00+00:00"
    response = client.post(
        "/api/v1/device/events",
        json={
            "sent_at": now_iso,
            "sessions": [
                {"id": session_id, "status": "active", "granted_s": 3600, "used_s": 600,
                 "started_at": now_iso, "source": "parent_web"}
            ],
            "ledger": [
                {"client_uuid": f"led-{child_name}-{uuid.uuid4().hex[:8]}", "session_id": session_id,
                 "ts": now_iso, "kind": "stress_alert", "seconds": 300},
            ],
        },
        headers=headers,
    )
    assert response.status_code == 200
    alert_id = client.get("/api/v1/alerts").json()[0]["id"]
    return {
        "child_id": child["id"],
        "device_token": token,
        "session_id": session_id,
        "alert_id": alert_id,
    }


def idor_requests(ids: dict) -> list[tuple[str, str, dict | None, dict | None]]:
    """(template, method, json_body, params) for every parent route that takes a path id."""
    return [
        ("/children/{child_id}", "GET", None, None),
        ("/children/{child_id}", "PATCH", {"name": "Renamed"}, None),
        ("/children/{child_id}", "DELETE", None, None),
        ("/children/{child_id}/settings", "GET", None, None),
        ("/children/{child_id}/settings", "PATCH", {"calm_threshold": 75}, None),
        ("/children/{child_id}/devices", "GET", None, None),
        ("/children/{child_id}/pairing-code", "POST", None, None),
        ("/children/{child_id}/sessions", "POST", {"duration_min": 30}, None),
        ("/children/{child_id}/live", "GET", None, None),
        ("/children/{child_id}/analytics/overview", "GET", None, {"range": "today"}),
        ("/children/{child_id}/analytics/emotion-timeline", "GET", None, {"date": "2026-09-30"}),
        ("/children/{child_id}/analytics/app-usage", "GET", None, {"range": "7d"}),
        ("/children/{child_id}/analytics/sessions", "GET", None, {"range": "7d"}),
        ("/children/{child_id}/data", "DELETE", None, None),
        ("/sessions/{session_id}/end", "POST", None, None),
        ("/sessions/{session_id}/lock", "POST", None, None),
        ("/sessions/{session_id}/adjust", "POST", {"delta_seconds": 60, "reason": "t"}, None),
        ("/devices/{device_id}", "DELETE", None, None),
        ("/alerts/{alert_id}/read", "POST", None, None),
    ]


def _device_id_for(client, child_id) -> str:
    return client.get(f"/api/v1/children/{child_id}/devices").json()[0]["id"]


def test_idor_matrix(parent_client, other_client):
    a = provision(parent_client, "owner@example.com", "Aarav")
    b = provision(other_client, "intruder@example.com", "Ira")
    assert b["child_id"] != a["child_id"]
    a["device_id"] = _device_id_for(parent_client, a["child_id"])

    covered = set()
    for template, method, body, params in idor_requests(a):
        covered.add(template)
        url = template.format(
            child_id=a["child_id"], session_id=a["session_id"],
            device_id=a["device_id"], alert_id=a["alert_id"],
        )
        response = other_client.request(method, f"/api/v1{url}", json=body, params=params, headers=REQ)
        assert response.status_code == NOT_FOUND, f"{method} {url} -> {response.status_code} (expected 404)"

    # Every parent route with a path parameter discovered from the OpenAPI spec must be covered
    # by the matrix above — new routes cannot dodge it.
    parent_path_params = ("child_id", "session_id", "device_id", "alert_id")
    spec_paths = create_app().openapi()["paths"]
    discovered = {
        path.replace("/api/v1", "", 1)
        for path in spec_paths
        if any(f"{{{name}}}" in path for name in parent_path_params)
    }
    missing = {template for template in discovered if template not in covered}
    assert not missing, f"routes with path ids missing from the IDOR matrix: {missing}"


def test_device_session_snapshot_cannot_touch_foreign_session(parent_client, other_client):
    a = provision(parent_client, "owner2@example.com", "Aarav")
    b = provision(other_client, "intruder2@example.com", "Ira")

    # B's device claims A's session id with modified numbers — must be ignored.
    response = other_client.post(
        "/api/v1/device/events",
        json={
            "sent_at": "2026-09-30T10:05:00+00:00",
            "sessions": [
                {"id": a["session_id"], "status": "ended", "granted_s": 99999, "used_s": 99999,
                 "ended_at": "2026-09-30T11:00:00+00:00", "source": "parent_web"}
            ],
        },
        headers={"Authorization": f"Bearer {b['device_token']}"},
    )
    assert response.status_code == 200
    parent_client.post(
        f"/api/v1/sessions/{a['session_id']}/lock", headers=REQ
    )  # A's own control still resolves the session as active/pending
    live = parent_client.get(f"/api/v1/children/{a['child_id']}/live").json()
    assert live["session"]["granted_s"] == 3600
    assert live["session"]["status"] in ("pending", "active", "cooldown")
