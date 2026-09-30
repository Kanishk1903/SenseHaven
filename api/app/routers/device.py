"""Device API (P2.5: pair; P2.6 adds sync/events/ack/heartbeat)."""
import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_device, get_db
from ..models import Child, Device, Parent
from ..problems import ApiError
from ..security.limiter import limiter
from ..services.pairing import find_known_code, find_usable_code

router = APIRouter(prefix="/device", tags=["device"])

PAIR_ATTEMPT_LIMIT = 10
PAIR_ATTEMPT_WINDOW_S = 3600


class PairIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    device_name: str = Field(min_length=1, max_length=80)
    android_version: str = Field(default="", max_length=20)
    app_version: str = Field(default="", max_length=20)


def _pair_throttle_key(request: Request) -> str:
    return f"pair:{request.client.host if request.client else 'unknown'}"


@router.post("/pair", status_code=201)
def pair(body: PairIn, request: Request, db: Session = Depends(get_db)) -> dict:
    key = _pair_throttle_key(request)
    allowed, retry_after = limiter.check(key, PAIR_ATTEMPT_LIMIT, PAIR_ATTEMPT_WINDOW_S)
    if not allowed:
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Too many attempts. Wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )
    limiter.hit(key, PAIR_ATTEMPT_LIMIT, PAIR_ATTEMPT_WINDOW_S)

    row = find_usable_code(db, body.code)
    if row is None:
        known = find_known_code(db, body.code)
        if known is not None:
            # A code that exists but cannot be used burns its attempts too (D-18).
            known.attempts += 1
            db.commit()
            raise ApiError(410, "PAIRING_CODE_EXPIRED", "That code expired — pairing codes last 10 minutes. Generate a new one.")
        raise ApiError(422, "PAIRING_CODE_INVALID", "That code isn't right. Compare it with the dashboard code and try again.")

    child = db.get(Child, row.child_id)
    parent = db.get(Parent, child.parent_id)

    # Pairing again for a child revokes the previous device (File 03 binding; D-19).
    now = datetime.now(timezone.utc)
    for old in db.scalars(
        select(Device).where(Device.child_id == child.id, Device.revoked_at.is_(None))
    ):
        old.revoked_at = now

    token = secrets.token_urlsafe(32)
    device = Device(
        child_id=child.id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        name=body.device_name,
        android_version=body.android_version,
        app_version=body.app_version,
        permissions={},
    )
    row.used_at = now
    db.add(device)
    db.commit()

    pin_payload = None
    if parent.pin_hash is not None:
        pin_payload = {
            "algo": "pbkdf2-sha256",
            "iterations": parent.pin_iterations,
            "salt_b64": base64.b64encode(bytes.fromhex(parent.pin_salt)).decode(),
            "hash_b64": base64.b64encode(bytes.fromhex(parent.pin_hash)).decode(),
        }

    return {
        "device_token": token,
        "child": {"id": str(child.id), "name": child.name},
        "config_version": child.settings.get("config_version", 1),
        "config": child.settings,
        "pin": pin_payload,
        "pin_version": parent.pin_version,
    }
