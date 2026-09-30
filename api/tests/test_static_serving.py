"""P4.1 — production static serving: SPA fallback, immutable assets, API untouched."""
from pathlib import Path

from fastapi.testclient import TestClient

from api.app import static_serving
from api.app.config import Settings
from api.app.main import create_app


def make_production_app(tmp_path: Path, monkeypatch) -> TestClient:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><html><body>SPA</body></html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setattr(static_serving, "WEB_DIST", dist)
    settings = Settings(
        env="production",
        database_url="postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven",
        app_secret="s" * 20,
        pairing_pepper="p" * 20,
    )
    return TestClient(create_app(settings))


def test_production_serves_index_and_spa_fallback(tmp_path, monkeypatch):
    client = make_production_app(tmp_path, monkeypatch)
    assert "SPA" in client.get("/").text
    deep = client.get("/children/abc123")
    assert deep.status_code == 200
    assert "SPA" in deep.text
    assert deep.headers["Cache-Control"] == "no-cache"


def test_production_assets_are_immutable(tmp_path, monkeypatch):
    client = make_production_app(tmp_path, monkeypatch)
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "immutable" in asset.headers["Cache-Control"]


def test_api_routes_win_over_static(tmp_path, monkeypatch):
    client = make_production_app(tmp_path, monkeypatch)
    assert client.get("/api/v1/healthz").status_code == 200
    assert client.get("/api/v1/healthz").json() == {"status": "ok"}
    # docs stay disabled in production
    assert client.get("/docs").status_code == 404


def test_static_mount_skipped_outside_production(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>SPA</html>")
    monkeypatch.setattr(static_serving, "WEB_DIST", dist)
    settings = Settings(env="development", database_url="postgresql+psycopg://x/y@localhost:5432/z",
                        app_secret="s" * 20, pairing_pepper="p" * 20)
    client = TestClient(create_app(settings))
    assert client.get("/").status_code == 404  # no static mount outside production
