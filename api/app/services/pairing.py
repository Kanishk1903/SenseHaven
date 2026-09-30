"""Pairing service (P2.5): 6-digit codes, peppered sha256, TTL, single use, attempts."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Child, PairingCode

CODE_TTL_S = 10 * 60
MAX_ATTEMPTS = 5


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    return hashlib.sha256((code + get_settings().pairing_pepper).encode()).hexdigest()


def expire_stale_codes(db: Session, child_id) -> None:
    """Only one live code per child: expire earlier unused codes (idempotent re-issue)."""
    now = datetime.now(timezone.utc)
    for code in db.scalars(
        select(PairingCode).where(
            PairingCode.child_id == child_id,
            PairingCode.used_at.is_(None),
            PairingCode.expires_at > now,
        )
    ):
        code.expires_at = now
    db.flush()


def create_pairing_code(db: Session, child: Child) -> tuple[PairingCode, str]:
    """Returns (row, plain code) — the plain code is shown exactly once."""
    expire_stale_codes(db, child.id)
    code = generate_code()
    row = PairingCode(
        child_id=child.id,
        code_hash=hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=CODE_TTL_S),
    )
    db.add(row)
    db.flush()
    return row, code


def find_usable_code(db: Session, code: str) -> PairingCode | None:
    now = datetime.now(timezone.utc)
    return db.scalar(
        select(PairingCode).where(
            PairingCode.code_hash == hash_code(code),
            PairingCode.used_at.is_(None),
            PairingCode.expires_at > now,
            PairingCode.attempts < MAX_ATTEMPTS,
        )
    )


def find_known_code(db: Session, code: str) -> PairingCode | None:
    """Any row with this hash (used/expired/exhausted) — for accurate error codes."""
    return db.scalar(select(PairingCode).where(PairingCode.code_hash == hash_code(code)))
