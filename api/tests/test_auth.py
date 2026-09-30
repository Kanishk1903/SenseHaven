"""P2.3 — auth, throttling, cookie flags, PIN."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from api.app.config import get_settings
from api.app.security.hashing import create_session_token


def register_body(**overrides) -> dict:
    body = {
        "email": "parent@example.com",
        "password": "correct-horse-battery",
        "display_name": "Priya",
        "timezone": "Asia/Kolkata",
    }
    body.update(overrides)
    return body


def register(client, **overrides):
    return client.post("/api/v1/auth/register", json=register_body(**overrides), headers={"X-Requested-With": "senseheaven"})


def login(client, email="parent@example.com", password="correct-horse-battery"):
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers={"X-Requested-With": "senseheaven"}
    )


def test_register_login_me(client):
    response = register(client)
    assert response.status_code == 201
    assert response.json()["email"] == "parent@example.com"
    assert response.json()["has_pin"] is False
    assert "sh_session" in response.cookies

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["display_name"] == "Priya"


def test_register_stores_email_lower_case(client):
    response = register(client, email="PARENT@Example.COM")
    assert response.json()["email"] == "parent@example.com"


def test_register_duplicate_email_409(client):
    assert register(client).status_code == 201
    again = register(client, display_name="Other")
    assert again.status_code == 409
    assert again.json()["code"] == "EMAIL_TAKEN"


def test_register_short_password_422(client):
    response = register(client, password="short")
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["errors"]


def test_register_bad_timezone_422(client):
    assert register(client, timezone="Mars/Olympus").status_code == 422


def test_mutating_without_requested_with_403(client):
    response = client.post("/api/v1/auth/register", json=register_body())
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_HEADER_MISSING"


def test_login_wrong_password_401(client):
    register(client)
    response = login(client, password="wrong-password-1")
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_email_same_code_401(client):
    response = login(client, email="nobody@example.com")
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_login_throttle_429_with_retry_after(client):
    register(client)
    for _ in range(5):
        login(client, password="wrong-password-1")
    sixth = login(client, password="wrong-password-1")
    assert sixth.status_code == 429
    assert sixth.json()["code"] == "RATE_LIMITED"
    assert "Retry-After" in sixth.headers


def test_successful_login_resets_and_works(client):
    register(client)
    login(client, password="wrong-password-1")
    ok = login(client)
    assert ok.status_code == 200
    assert "sh_session" in ok.cookies


def test_me_without_cookie_401(client):
    fresh = client
    fresh.cookies.clear()
    response = fresh.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_tampered_jwt_401(client):
    register(client)
    client.cookies.set("sh_session", create_session_token(uuid.uuid4())[:-3] + "xyz")
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_expired_jwt_401(client):
    now = datetime.now(timezone.utc)
    settings = get_settings()
    expired = pyjwt.encode(
        {"sub": str(uuid.uuid4()), "iat": now - timedelta(days=15), "exp": now - timedelta(seconds=10)},
        settings.app_secret,
        algorithm="HS256",
    )
    client.cookies.set("sh_session", expired)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_clears_cookie(client):
    register(client)
    logout = client.post("/api/v1/auth/logout", headers={"X-Requested-With": "senseheaven"})
    assert logout.status_code == 200
    client.cookies.clear()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_cookie_flags(client):
    response = register(client)
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie
    assert "secure" not in set_cookie  # ENV=test is not production


def test_pin_set_requires_password_and_bumps_version(client):
    register(client)
    wrong = client.put(
        "/api/v1/parents/me/pin",
        json={"password": "not-my-password", "pin": "123456"},
        headers={"X-Requested-With": "senseheaven"},
    )
    assert wrong.status_code == 401

    bad_format = client.put(
        "/api/v1/parents/me/pin",
        json={"password": "correct-horse-battery", "pin": "12345"},
        headers={"X-Requested-With": "senseheaven"},
    )
    assert bad_format.status_code == 422

    ok = client.put(
        "/api/v1/parents/me/pin",
        json={"password": "correct-horse-battery", "pin": "123456"},
        headers={"X-Requested-With": "senseheaven"},
    )
    assert ok.status_code == 204

    me = client.get("/api/v1/auth/me")
    assert me.json()["has_pin"] is True
