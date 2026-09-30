"""Ops endpoints: /healthz (process up) and /readyz (DB reachable). Mounted at root and /api/v1."""
from fastapi import APIRouter, Request
from sqlalchemy import text

from ..db import SessionLocal
from ..problems import problem_response

router = APIRouter(tags=["ops"])


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
def readyz(request: Request):
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - any DB failure means not ready
        return problem_response(request, 503, "INTERNAL_ERROR", "Database is not reachable yet.")
    return {"status": "ready"}
