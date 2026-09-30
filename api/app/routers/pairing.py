"""Pairing code issuance (parent side, P2.5)."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Parent
from ..problems import ApiError
from ..services.children import get_child_or_404
from ..services.pairing import create_pairing_code

router = APIRouter(tags=["pairing"])


@router.post("/children/{child_id}/pairing-code", status_code=201, dependencies=[Depends(require_requested_with)])
def issue_pairing_code(
    child_id: uuid.UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> dict:
    child = get_child_or_404(parent, child_id, db)
    if parent.pin_hash is None:
        raise ApiError(409, "PIN_REQUIRED", "Set your 6-digit device PIN first — you'll find it in Account.")
    row, code = create_pairing_code(db, child)
    db.commit()
    return {"code": code, "expires_at": row.expires_at.isoformat()}
