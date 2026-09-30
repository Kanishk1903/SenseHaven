"""P2.8 — security consolidation: device-token scope, revocation, cookie-vs-bearer separation.

Cookie flags, login throttle, CSRF header, security headers and docs-off-in-production are
asserted in tests/test_auth.py and tests/test_health.py; the gate-2 security check runs all
three files.
"""
import hashlib
import uuid

from api.app.db import SessionLocal
from api.app.models import Device
from api.tests.test_pairing import REQ, issue_code, make_child, pair, set_pin


def paired_child(client) -> tuple[dict, str]:
    set_pin(client)
    child = make_child(client)
    token = pair(client, issue_code(client, child["id"])).json()["device_token"]
    return child, token


def test_parent_cookie_cannot_call_device_routes(parent_client):
    child, _token = paired_child(parent_client)
    response = parent_client.get("/api/v1/device/sync")
    assert response.status_code == 401
    assert response.json()["code"] == "DEVICE_TOKEN_INVALID"


def test_revoked_device_receives_DEVICE_REVOKED(parent_client):
    child, token = paired_child(parent_client)
    device_id = parent_client.get(f"/api/v1/children/{child['id']}/devices").json()[0]["id"]
    revoked = parent_client.delete(f"/api/v1/devices/{device_id}", headers=REQ)
    assert revoked.status_code == 204

    response = parent_client.get("/api/v1/device/sync", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["code"] == "DEVICE_REVOKED"

    with SessionLocal() as db:
        row = db.query(Device).filter(Device.token_hash == hashlib.sha256(token.encode()).hexdigest()).one()
        assert row.revoked_at is not None


def test_unknown_device_token_is_DEVICE_TOKEN_INVALID(parent_client):
    response = parent_client.get(
        "/api/v1/device/sync", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "DEVICE_TOKEN_INVALID"


def test_token_hash_is_never_stored_in_the_clear(parent_client):
    child, token = paired_child(parent_client)
    with SessionLocal() as db:
        rows = db.query(Device).filter(Device.child_id == uuid.UUID(child["id"])).all()
        assert rows, "device exists"
        assert all(device.token_hash != token for device in rows)
        assert rows[0].token_hash == hashlib.sha256(token.encode()).hexdigest()
