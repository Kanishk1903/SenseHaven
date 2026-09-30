"""Password (argon2id), device-PIN (PBKDF2-HMAC-SHA256) and session-JWT helpers (P2.3)."""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import argon2
import jwt

from ..config import get_settings

_hasher = argon2.PasswordHasher()
# Verified against unknown emails so login timing does not reveal whether an account exists.
DUMMY_HASH = _hasher.hash("senseheaven-timing-equalizer")

SESSION_COOKIE = "sh_session"
SESSION_TTL_S = 14 * 24 * 3600
PBKDF2_ITERATIONS = 210_000


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except Exception:  # noqa: BLE001 - any failure means "not valid"
        return False


def new_pin_salt() -> str:
    return secrets.token_hex(16)


def hash_pin(pin: str, salt_hex: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt_hex), iterations).hex()


def verify_pin(pin: str, salt_hex: str, expected_hex: str, iterations: int) -> bool:
    computed = hash_pin(pin, salt_hex, iterations)
    return hmac.compare_digest(computed, expected_hex)


def create_session_token(parent_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(parent_id),
        "iat": now,
        "exp": now + timedelta(seconds=SESSION_TTL_S),
    }
    return jwt.encode(payload, settings.app_secret, algorithm="HS256")


def decode_session_token(token: str) -> uuid.UUID:
    """Returns the parent id; raises jwt.PyJWTError subclasses on any problem."""
    payload = jwt.decode(token, get_settings().app_secret, algorithms=["HS256"])
    return uuid.UUID(payload["sub"])
