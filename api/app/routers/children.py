"""Children CRUD + settings (P2.4). Cross-tenant access returns 404, never 403 (File 01 §E3)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Child, Parent
from ..problems import ApiError
from ..schemas.child import ChildIn, ChildOut, ChildPatch
from ..services.settings import apply_settings_patch, default_settings

router = APIRouter(prefix="/children", tags=["children"])


def get_child_or_404(parent: Parent, child_id: uuid.UUID, db: Session) -> Child:
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent.id or child.deleted_at is not None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    return child


def _out(child: Child) -> ChildOut:
    return ChildOut.model_validate(child)


@router.get("")
def list_children(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> list[ChildOut]:
    children = db.scalars(
        select(Child)
        .where(Child.parent_id == parent.id, Child.deleted_at.is_(None))
        .order_by(Child.created_at)
    ).all()
    return [_out(child) for child in children]


@router.post("", status_code=201, dependencies=[Depends(require_requested_with)])
def create_child(
    body: ChildIn, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)
) -> ChildOut:
    child = Child(
        parent_id=parent.id,
        name=body.name,
        birth_year=body.birth_year,
        avatar_key=body.avatar_key,
        settings=default_settings(),
    )
    db.add(child)
    db.commit()
    return _out(child)


@router.get("/{child_id}")
def get_child(child_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)) -> ChildOut:
    return _out(get_child_or_404(parent, child_id, db))


@router.patch("/{child_id}", dependencies=[Depends(require_requested_with)])
def patch_child(
    child_id: uuid.UUID,
    body: ChildPatch,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildOut:
    child = get_child_or_404(parent, child_id, db)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(child, key, value)
    db.commit()
    return _out(child)


@router.delete("/{child_id}", status_code=204, dependencies=[Depends(require_requested_with)])
def delete_child(
    child_id: uuid.UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> None:
    child = get_child_or_404(parent, child_id, db)
    child.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/{child_id}/settings")
def get_settings_route(
    child_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    return child.settings


@router.patch("/{child_id}/settings", dependencies=[Depends(require_requested_with)])
def patch_settings_route(
    child_id: uuid.UUID,
    body: dict,
    request: Request,
    response: Response,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    try:
        child.settings = apply_settings_patch(child.settings, body)
    except ValueError as error:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Some details need a fix. Check the highlighted fields and try again.",
        ) from error
    db.commit()
    return child.settings
