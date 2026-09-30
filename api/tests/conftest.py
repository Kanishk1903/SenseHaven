"""Test bootstrap: env before app import, real Postgres (compose db), clean tables per test."""
import os

os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven"
)
os.environ.setdefault("APP_SECRET", "test-only-secret-not-for-production")
os.environ.setdefault("PAIRING_PEPPER", "test-only-pepper-not-for-production")
os.environ.setdefault("ENV", "test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.app.db import Base, engine  # noqa: E402
from api.app.main import create_app  # noqa: E402
from api.app.security.limiter import limiter  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    limiter.reset()


REQUESTED_WITH = {"X-Requested-With": "senseheaven"}


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def parent_client(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "parent@example.com",
            "password": "correct-horse-battery",
            "display_name": "Priya",
            "timezone": "Asia/Kolkata",
        },
        headers=REQUESTED_WITH,
    )
    assert response.status_code == 201
    return client


@pytest.fixture
def other_client():
    """A second, independently-authenticated browser (separate cookie jar)."""
    with TestClient(create_app()) as test_client:
        response = test_client.post(
            "/api/v1/auth/register",
            json={
                "email": "other@example.com",
                "password": "other-password-123",
                "display_name": "Other",
                "timezone": "Asia/Kolkata",
            },
            headers=REQUESTED_WITH,
        )
        assert response.status_code == 201
        yield test_client
