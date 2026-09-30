"""Shared FastAPI dependencies (P2.1+): db session, parent session, CSRF-style header."""
import uuid
from collections.abc import Generator

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Parent
from .problems import ApiError
from .security.hashing import SESSION_COOKIE, decode_session_token

REQUESTED_WITH = "senseheaven"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_requested_with(request: Request) -> None:
    """Mutating parent requests must carry X-Requested-With (LEAN §1.2 CSRF replacement)."""
    if request.headers.get("X-Requested-With") != REQUESTED_WITH:
        raise ApiError(
            403,
            "CSRF_HEADER_MISSING",
            "We couldn't verify that request. Refresh the page and try again.",
        )


def get_current_parent(request: Request, db: Session = Depends(get_db)) -> Parent:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise ApiError(401, "UNAUTHENTICATED", "Your session ended. Sign in again to keep going.")
    try:
        parent_id = decode_session_token(token)
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "UNAUTHENTICATED", "Your session expired. Sign in again to keep going.")
    except (jwt.InvalidTokenError, ValueError):
        raise ApiError(401, "UNAUTHENTICATED", "Your session ended. Sign in again to keep going.")
    parent = db.get(Parent, parent_id)
    if parent is None:
        raise ApiError(401, "UNAUTHENTICATED", "Your session ended. Sign in again to keep going.")
    return parent
