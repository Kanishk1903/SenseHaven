"""FastAPI app factory (P2.1). Routers are added phase by phase."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from .config import Settings, get_settings
from .db import Base, engine
from .middleware import install_middleware
from .problems import install_error_handlers


def _wait_for_db(seconds: int = 60) -> None:
    """Retry the first DB connection (Neon cold start tolerance, P7.1)."""
    import time

    deadline = time.monotonic() + seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as error:  # noqa: BLE001 - retry any connection failure
            last_error = error
            time.sleep(1)
    raise RuntimeError(f"database not reachable after {seconds}s: {last_error}")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        _wait_for_db(60)
        Base.metadata.create_all(engine)
        yield

    app = FastAPI(
        title="SenseHeaven API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    install_middleware(app, settings)
    install_error_handlers(app)

    from .routers import alerts, analytics, auth, children, device, devices, ops, pairing, parents, sessions

    app.include_router(ops.router)
    app.include_router(ops.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(parents.router, prefix="/api/v1")
    app.include_router(children.router, prefix="/api/v1")
    app.include_router(pairing.router, prefix="/api/v1")
    app.include_router(device.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")
    app.include_router(analytics.router, prefix="/api/v1")
    app.include_router(alerts.router, prefix="/api/v1")
    app.include_router(devices.router, prefix="/api/v1")

    return app


app = create_app()
