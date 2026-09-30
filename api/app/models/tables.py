"""SQLAlchemy models — the 10 lean tables (LEAN §1.2).

Conventions (File 01 §E1): UUID PKs generated in Python (uuid4, NOT DB defaults), UTC
timezone-aware datetimes everywhere, idempotency via UNIQUE(child_id, client_uuid).
Cross-tenant isolation is enforced in queries, not the schema.
"""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Identity

from ..db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


class Parent(Base):
    __tablename__ = "parents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True)  # always stored lower-case
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(Text)
    pin_salt: Mapped[str | None] = mapped_column(Text, nullable=True)
    pin_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    pin_iterations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pin_version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Child(Base):
    __tablename__ = "children"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    parent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parents.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(Text)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avatar_key: Mapped[str] = mapped_column(Text, default="orb-1")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PairingCode(Base):
    __tablename__ = "pairing_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(Text, index=True)  # sha256(code + PAIRING_PEPPER)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index(
            "uq_devices_active_child",
            "child_id",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, index=True)  # sha256(token)
    name: Mapped[str] = mapped_column(Text)
    android_version: Mapped[str] = mapped_column(Text, default="")
    app_version: Mapped[str] = mapped_column(Text, default="")
    paired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permissions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    battery_pct: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class ScreenSession(Base):
    __tablename__ = "screen_sessions"
    __table_args__ = (Index("ix_sessions_child_started", "child_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(Text)  # pending|active|cooldown|expired|ended
    granted_s: Mapped[int] = mapped_column(Integer)
    bonus_s: Mapped[int] = mapped_column(Integer, default=0)
    penalty_s: Mapped[int] = mapped_column(Integer, default=0)
    used_s: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    pause_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(Text, default="parent_web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EmotionEvent(Base):
    __tablename__ = "emotion_events"
    __table_args__ = (
        Index("uq_emotion_child_uuid", "child_id", "client_uuid", unique=True),
        Index("ix_emotion_child_ts", "child_id", "ts"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("screen_sessions.id", ondelete="SET NULL"), nullable=True
    )
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    client_uuid: Mapped[str] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    calm_index: Mapped[int] = mapped_column(SmallInteger)
    label: Mapped[str] = mapped_column(Text)  # calm|neutral|stressed
    face_present: Mapped[bool] = mapped_column(Boolean)
    quality: Mapped[float] = mapped_column(Float)


class LedgerEvent(Base):
    __tablename__ = "ledger_events"
    __table_args__ = (
        Index("uq_ledger_child_uuid", "child_id", "client_uuid", unique=True),
        Index("ix_ledger_child_ts", "child_id", "ts"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("screen_sessions.id", ondelete="SET NULL"), nullable=True
    )
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    client_uuid: Mapped[str] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(Text)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class AppUsageDaily(Base):
    __tablename__ = "app_usage_daily"
    __table_args__ = (
        Index("uq_usage_child_date_package", "child_id", "date", "package", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    package: Mapped[str] = mapped_column(Text)
    label: Mapped[str] = mapped_column(Text, default="")
    seconds: Mapped[int] = mapped_column(BigInteger, default=0)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    parent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parents.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(Text)  # info|warning|critical
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
