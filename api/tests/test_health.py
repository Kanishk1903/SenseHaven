"""P2.1 — health endpoints, problem+json shape, security headers, docs-off in production."""
from fastapi.testclient import TestClient

from api.app.main import create_app


def test_healthz_ok(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_healthz_under_api_v1(client):
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200


def test_readyz_with_db(client):
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readyz_503_when_db_down(client, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    broken = sessionmaker(bind=create_engine("postgresql+psycopg://senseheaven:senseheaven@localhost:59999/x"))
    import api.app.routers.ops as ops

    monkeypatch.setattr(ops, "SessionLocal", broken)
    response = client.get("/readyz")
    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert body["request_id"]


def test_unknown_route_is_problem_json(client):
    response = client.get("/api/v1/definitely-not-a-route")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["status"] == 404
    assert body["request_id"]
    assert response.headers["X-Request-ID"] == body["request_id"]


def test_security_headers_present(client):
    response = client.get("/healthz")
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]


def test_hsts_only_in_production():
    from api.app.config import Settings

    settings = Settings(
        env="production", database_url="postgresql+psycopg://x/y",
        app_secret="s" * 20, pairing_pepper="p" * 20,
    )
    app = create_app(settings)
    with TestClient(app, raise_server_exceptions=False) as production_client:
        response = production_client.get("/api/v1/healthz")
        assert "Strict-Transport-Security" in response.headers
        assert production_client.get("/docs").status_code == 404
        assert production_client.get("/openapi.json").status_code == 404


def test_docs_available_outside_production(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200
