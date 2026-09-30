"""Parent account management (lean: device PIN only — P2.3)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Parent
from ..problems import ApiError
from ..schemas.auth import PinIn
from ..security.hashing import PBKDF2_ITERATIONS, hash_pin, new_pin_salt, verify_password

router = APIRouter(prefix="/parents", tags=["parents"])


@router.put("/me/pin", status_code=204, dependencies=[Depends(require_requested_with)])
def set_pin(
    body: PinIn,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(parent.password_hash, body.password):
        raise ApiError(401, "INVALID_CREDENTIALS", "That password doesn't match. Check it and try again.")
    salt = new_pin_salt()
    parent.pin_salt = salt
    parent.pin_hash = hash_pin(body.pin, salt)
    parent.pin_iterations = PBKDF2_ITERATIONS
    parent.pin_version = (parent.pin_version or 1) + 1
    db.commit()
