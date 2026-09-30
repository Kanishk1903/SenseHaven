"""Child lookup helpers shared by routers (P2.4+)."""
import uuid

from sqlalchemy.orm import Session

from ..models import Child, Parent
from ..problems import ApiError


def get_child_or_404(parent: Parent, child_id: uuid.UUID, db: Session) -> Child:
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent.id or child.deleted_at is not None:
        raise ApiError(
            404,
            "NOT_FOUND",
            "We couldn't find that. It may have been removed — head back and try again.",
        )
    return child
