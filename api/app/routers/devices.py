"""Parent-side device management (P2.7): list + revoke."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_parent, get_db, require_requested_with
from ..models import Child, Device, Parent
from ..problems import ApiError
from ..services.children import get_child_or_404

router = APIRouter(tags=["devices"])


def _device_out(device: Device) -> dict:
    return {
        "id": str(device.id),
        "name": device.name,
        "android_version": device.android_version,
        "app_version": device.app_version,
        "paired_at": device.paired_at.isoformat(),
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "revoked_at": device.revoked_at.isoformat() if device.revoked_at else None,
        "battery_pct": device.battery_pct,
        "permissions": device.permissions or {},
    }


@router.get("/children/{child_id}/devices")
def list_devices(
    child_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)
) -> list[dict]:
    child = get_child_or_404(parent, child_id, db)
    devices = db.scalars(select(Device).where(Device.child_id == child.id).order_by(Device.paired_at)).all()
    return [_device_out(device) for device in devices]


@router.delete("/devices/{device_id}", status_code=204, dependencies=[Depends(require_requested_with)])
def revoke_device(
    device_id: uuid.UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)
) -> None:
    device = db.get(Device, device_id)
    if device is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    child = db.get(Child, device.child_id)
    if child is None or child.parent_id != parent.id:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that. It may have been removed — head back and try again.")
    device.revoked_at = device.revoked_at or datetime.now(UTC)
    db.commit()
