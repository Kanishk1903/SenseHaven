"""Parent auth: register / login / logout / me (P2.3)."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Parent
from ..problems import ApiError
from ..schemas.auth import LoginIn, ParentOut, RegisterIn
from ..security.hashing import (
    DUMMY_HASH,
    SESSION_COOKIE,
    SESSION_TTL_S,
    create_session_token,
    hash_password,
    verify_password,
)
from ..security.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_FAIL_LIMIT = 5
LOGIN_FAIL_WINDOW_S = 15 * 60


def _set_session_cookie(response: Response, parent_id) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(parent_id),
        max_age=SESSION_TTL_S,
        path="/",
        httponly=True,
        samesite="strict",
        secure=settings.is_production,
    )


def _parent_out(parent: Parent) -> ParentOut:
    return ParentOut(
        id=parent.id,
        email=parent.email,
        display_name=parent.display_name,
        timezone=parent.timezone,
        has_pin=parent.pin_hash is not None,
        created_at=parent.created_at,
    )


@router.post("/register", status_code=201, dependencies=[Depends(require_requested_with)])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> ParentOut:
    existing = db.scalar(select(Parent).where(Parent.email == body.email))
    if existing is not None:
        raise ApiError(409, "EMAIL_TAKEN", "An account with this email already exists. Try signing in instead.")
    parent = Parent(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        timezone=body.timezone,
    )
    db.add(parent)
    db.commit()
    _set_session_cookie(response, parent.id)
    return _parent_out(parent)


@router.post("/login", dependencies=[Depends(require_requested_with)])
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> ParentOut:
    key = f"login:{request.client.host if request.client else 'unknown'}:{body.email}"
    allowed, retry_after = limiter.check(key, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_S)
    if not allowed:
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Too many attempts. Wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )

    parent = db.scalar(select(Parent).where(Parent.email == body.email))
    password_hash = parent.password_hash if parent is not None else DUMMY_HASH
    if not verify_password(password_hash, body.password):
        limiter.hit(key, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_S)
        raise ApiError(401, "INVALID_CREDENTIALS", "That email and password don't match. Check them and try again.")

    _set_session_cookie(response, parent.id)
    return _parent_out(parent)


@router.post("/logout", dependencies=[Depends(require_requested_with)])
def logout(response: Response) -> dict:
    settings = get_settings()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="strict", secure=settings.is_production)
    return {"status": "ok"}


@router.get("/me")
def me(parent: Parent = Depends(get_current_parent)) -> ParentOut:
    return _parent_out(parent)
