"""P2.5 — pairing codes (TTL, single-use, attempts) and device pairing (revoke, throttle)."""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from api.app.db import SessionLocal
from api.app.main import create_app
from api.app.models import Device, PairingCode

REQ = {"X-Requested-With": "senseheaven"}


def set_pin(client, pin="123456"):
    response = client.put(
        "/api/v1/parents/me/pin", json={"password": "correct-horse-battery", "pin": pin}, headers=REQ
    )
    assert response.status_code == 204


def make_child(client, name="Aarav") -> dict:
    response = client.post("/api/v1/children", json={"name": name}, headers=REQ)
    assert response.status_code == 201
    return response.json()


def issue_code(client, child_id) -> str:
    response = client.post(f"/api/v1/children/{child_id}/pairing-code", headers=REQ)
    assert response.status_code == 201
    return response.json()["code"]


def pair(client, code: str, name="Test phone"):
    return client.post(
        "/api/v1/device/pair",
        json={"code": code, "device_name": name, "android_version": "14", "app_version": "1.0.0"},
    )


def wrong_code_for(code: str) -> str:
    return "111111" if code != "111111" else "222222"


def test_pairing_code_requires_pin(parent_client):
    child = make_child(parent_client)
    denied = parent_client.post(f"/api/v1/children/{child['id']}/pairing-code", headers=REQ)
    assert denied.status_code == 409
    assert denied.json()["code"] == "PIN_REQUIRED"

    set_pin(parent_client)
    issued = parent_client.post(f"/api/v1/children/{child['id']}/pairing-code", headers=REQ)
    assert issued.status_code == 201
    assert len(issued.json()["code"]) == 6 and issued.json()["code"].isdigit()
    assert "expires_at" in issued.json()


def test_pair_success_payload(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    response = pair(parent_client, code)
    assert response.status_code == 201
    body = response.json()
    assert len(body["device_token"]) >= 40
    assert body["child"]["id"] == child["id"]
    assert body["child"]["name"] == "Aarav"
    assert body["config_version"] == 1
    assert body["config"]["cooldown_min"] == 5
    assert body["pin"]["algo"] == "pbkdf2-sha256"
    assert body["pin"]["iterations"] == 210000
    assert body["pin"]["salt_b64"] and body["pin"]["hash_b64"]
    assert body["pin_version"] == 2  # bumped once by set_pin


def test_code_works_once(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    assert pair(parent_client, code, "First").status_code == 201
    again = pair(parent_client, code, "Second")
    assert again.status_code == 410
    assert again.json()["code"] == "PAIRING_CODE_EXPIRED"


def test_wrong_code_422(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    response = pair(parent_client, wrong_code_for(code))
    assert response.status_code == 422
    assert response.json()["code"] == "PAIRING_CODE_INVALID"


def test_expired_code_410_and_burns_attempt(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    code_hash = __import__("hashlib").sha256((code + "test-only-pepper-not-for-production").encode()).hexdigest()
    with SessionLocal() as db:
        row = db.query(PairingCode).filter(PairingCode.code_hash == code_hash).one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    response = pair(parent_client, code)
    assert response.status_code == 410
    with SessionLocal() as db:
        row = db.query(PairingCode).filter(PairingCode.code_hash == code_hash).one()
        assert row.attempts == 1


def test_exhausted_code_blocked(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    code_hash = __import__("hashlib").sha256((code + "test-only-pepper-not-for-production").encode()).hexdigest()
    with SessionLocal() as db:
        row = db.query(PairingCode).filter(PairingCode.code_hash == code_hash).one()
        row.attempts = 5
        db.commit()
    response = pair(parent_client, code)
    assert response.status_code == 410


def test_pairing_again_revokes_previous_device(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    token1 = pair(parent_client, issue_code(parent_client, child["id"]), "Old").json()["device_token"]
    token2 = pair(parent_client, issue_code(parent_client, child["id"]), "New").json()["device_token"]
    with SessionLocal() as db:
        devices = db.query(Device).filter(Device.child_id == uuid.UUID(child["id"])).all()
        assert len(devices) == 2
        active = [d for d in devices if d.revoked_at is None]
        assert len(active) == 1
        import hashlib

        assert active[0].token_hash == hashlib.sha256(token2.encode()).hexdigest()
        revoked = [d for d in devices if d.revoked_at is not None]
        assert revoked[0].token_hash == hashlib.sha256(token1.encode()).hexdigest()


def test_pair_throttle_429(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    code = issue_code(parent_client, child["id"])
    wrong = wrong_code_for(code)
    for _ in range(10):
        assert pair(parent_client, wrong).status_code == 422
    eleventh = pair(parent_client, wrong)
    assert eleventh.status_code == 429
    assert eleventh.json()["code"] == "RATE_LIMITED"
    assert "Retry-After" in eleventh.headers


def test_device_token_cannot_call_parent_routes(parent_client):
    set_pin(parent_client)
    child = make_child(parent_client)
    token = pair(parent_client, issue_code(parent_client, child["id"])).json()["device_token"]
    with TestClient(create_app()) as anon:
        response = anon.get("/api/v1/children", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401
        assert response.json()["code"] == "UNAUTHENTICATED"


def test_pair_missing_fields_422(parent_client):
    response = parent_client.post("/api/v1/device/pair", json={"code": "123456"})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
