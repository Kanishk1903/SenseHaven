"""Shared FastAPI dependencies (P2.1+): db session, parent session, device bearer, CSRF-style header."""
import hashlib
from collections.abc import Generator

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Device, Parent
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
    except jwt.ExpiredSignatureError as error:
        raise ApiError(401, "UNAUTHENTICATED", "Your session expired. Sign in again to keep going.") from error
    except (jwt.InvalidTokenError, ValueError) as error:
        raise ApiError(401, "UNAUTHENTICATED", "Your session ended. Sign in again to keep going.") from error
    parent = db.get(Parent, parent_id)
    if parent is None:
        raise ApiError(401, "UNAUTHENTICATED", "Your session ended. Sign in again to keep going.")
    return parent


def get_current_device(request: Request, db: Session = Depends(get_db)) -> Device:
    """Bearer-token device auth. A device may only ever touch its own child's data."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise ApiError(
            401,
            "DEVICE_TOKEN_INVALID",
            "This phone isn't paired any more. Open the app and pair with a new code.",
        )
    token_hash = hashlib.sha256(auth[7:].encode()).hexdigest()
    device = db.scalar(select(Device).where(Device.token_hash == token_hash))
    if device is None:
        raise ApiError(
            401,
            "DEVICE_TOKEN_INVALID",
            "This phone isn't paired any more. Open the app and pair with a new code.",
        )
    if device.revoked_at is not None:
        raise ApiError(
            401,
            "DEVICE_REVOKED",
            "This phone was unpaired from the parent dashboard. Pair again to reconnect.",
        )
    return device
