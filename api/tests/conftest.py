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


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client
