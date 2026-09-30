"""Device-facing schemas (P2.6). Strict: unknown fields are rejected (malformed batch → 422)."""
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CalmLabel = Literal["calm", "neutral", "stressed"]
LedgerKind = Literal[
    "bonus",
    "penalty",
    "cooldown_start",
    "cooldown_end",
    "manual_add",
    "manual_remove",
    "stress_alert",
    "low_time",
    "locked",
    "unlocked",
]
SessionStatus = Literal["pending", "active", "cooldown", "expired", "ended"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmotionEventIn(StrictModel):
    client_uuid: str = Field(min_length=8, max_length=64)
    session_id: uuid.UUID | None = None
    ts: datetime
    calm_index: int = Field(ge=0, le=100)
    label: CalmLabel
    face_present: bool
    quality: float = Field(ge=0, le=1)


class LedgerEventIn(StrictModel):
    client_uuid: str = Field(min_length=8, max_length=64)
    session_id: uuid.UUID
    ts: datetime
    kind: LedgerKind
    seconds: int = Field(default=0, ge=0)
    reason: str | None = Field(default=None, max_length=200)


class AppUsageIn(StrictModel):
    date: date
    package: str = Field(min_length=1, max_length=120)
    label: str = Field(default="", max_length=120)
    seconds: int = Field(ge=0)


class SessionSnapshotIn(StrictModel):
    id: uuid.UUID
    status: SessionStatus
    granted_s: int = Field(ge=0)
    bonus_s: int = Field(default=0, ge=0)
    penalty_s: int = Field(default=0, ge=0)
    used_s: int = Field(default=0, ge=0)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    end_reason: str | None = Field(default=None, max_length=40)
    source: str = Field(default="device_pin", max_length=20)


class HeartbeatPermissions(StrictModel):
    camera: bool = False
    notifications: bool = False
    usage_access: bool = False
    overlay: bool = False


class HeartbeatIn(StrictModel):
    used_s: int = Field(default=0, ge=0)
    remaining_s: int | None = Field(default=None, ge=0)
    battery_pct: int | None = Field(default=None, ge=0, le=100)
    camera_ok: bool = True
    permissions: HeartbeatPermissions = Field(default_factory=HeartbeatPermissions)


class EventsBatchIn(StrictModel):
    sent_at: datetime | None = None
    emotion: list[EmotionEventIn] = Field(default_factory=list)
    ledger: list[LedgerEventIn] = Field(default_factory=list)
    app_usage: list[AppUsageIn] = Field(default_factory=list)
    sessions: list[SessionSnapshotIn] = Field(default_factory=list)
    heartbeat: HeartbeatIn | None = None
