#!/usr/bin/env python3
"""Idempotent demo seed (P2.8): demo parent + child "Aarav" + 7 days of realistic data.

Run from the repo root:  api/.venv/bin/python scripts/seed_demo.py
Safe to run twice — existing rows are detected and skipped.
"""
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven")
os.environ.setdefault("APP_SECRET", "dev-only-secret-replace-in-production")
os.environ.setdefault("PAIRING_PEPPER", "dev-only-pepper-replace-in-production")

from sqlalchemy import select

from api.app.db import Base, SessionLocal, engine
from api.app.models import (
    Alert,
    AppUsageDaily,
    Child,
    EmotionEvent,
    LedgerEvent,
    Parent,
    ScreenSession,
)
from api.app.security.hashing import (
    PBKDF2_ITERATIONS,
    hash_password,
    hash_pin,
    new_pin_salt,
)

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@senseheaven.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo-password-123")
DEMO_PIN = os.environ.get("DEMO_PIN", "123456")
SEED = 20260928
DAYS = 7
PACKAGES = [
    ("com.google.android.youtube", "YouTube"),
    ("com.instagram.android", "Instagram"),
    ("com.android.chrome", "Chrome"),
    ("org.jsl.paint", "Paint"),
]


def ensure_parent(db) -> Parent:
    parent = db.scalar(select(Parent).where(Parent.email == DEMO_EMAIL))
    if parent is not None:
        print(f"demo parent {DEMO_EMAIL} exists")
        return parent
    salt = new_pin_salt()
    parent = Parent(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        display_name="Demo Parent",
        timezone="Asia/Kolkata",
        pin_salt=salt,
        pin_hash=hash_pin(DEMO_PIN, salt),
        pin_iterations=PBKDF2_ITERATIONS,
        pin_version=2,
    )
    db.add(parent)
    db.commit()
    print(f"created demo parent {DEMO_EMAIL} (PIN {DEMO_PIN})")
    return parent


def ensure_child(db, parent: Parent) -> Child:
    child = db.scalar(select(Child).where(Child.parent_id == parent.id, Child.name == "Aarav"))
    if child is not None:
        print("child Aarav exists")
        return child
    child = Child(
        parent_id=parent.id,
        name="Aarav",
        birth_year=2015,
        avatar_key="orb-2",
        settings={
            "config_version": 1,
            "good_bonus_min": 10,
            "stress_penalty_min": 5,
            "cooldown_min": 5,
            "max_bonus_per_session_min": 30,
            "calm_threshold": 70,
            "stress_threshold": 35,
            "sustained_stress_s": 300,
            "sustained_calm_s": 900,
            "penalty_lockout_s": 900,
            "monitoring_enabled": True,
            "activity_log_enabled": True,
            "show_mood_to_child": False,
            "blocked_packages": [],
            "allowed_packages": ["com.android.dialer", "com.android.emergency"],
        },
    )
    db.add(child)
    db.commit()
    print("created child Aarav")
    return child


def seed_history(db, child: Child) -> None:
    has_history = db.scalar(select(EmotionEvent.id).where(EmotionEvent.child_id == child.id).limit(1))
    if has_history is not None:
        print("emotion events already present — history seed skipped")
        return
    # Clear any orphaned seed alerts from an interrupted earlier run (idempotency).
    db.query(Alert).filter(Alert.dedupe_key.like("seed-stress-%")).delete(synchronize_session=False)

    rng = random.Random(SEED)
    now = datetime.now(timezone.utc)
    counter = 0

    def next_uuid() -> str:
        nonlocal counter
        counter += 1
        return f"seed-{counter:08d}-{uuid.uuid4()}"

    for day_offset in range(DAYS, 0, -1):
        # One session per day, 10:00–11:30 IST (= 04:30–06:00 UTC).
        day_start = (now - timedelta(days=day_offset)).replace(hour=4, minute=30, second=0, microsecond=0)
        bonus = 600 if day_offset % 3 == 0 else 0
        penalty = 300 if day_offset % 2 == 0 else 0
        session = ScreenSession(
            child_id=child.id,
            status="ended",
            granted_s=5400,
            used_s=5100 + rng.randint(-600, 300),
            bonus_s=bonus,
            penalty_s=penalty,
            started_at=day_start,
            ended_at=day_start + timedelta(minutes=90),
            end_reason="expired",
            source="parent_web",
        )
        db.add(session)
        db.flush()

        for minute in range(0, 90, 10):
            ts = day_start + timedelta(minutes=minute)
            stressed = day_offset % 2 == 0 and 30 <= minute <= 50
            calm_index = rng.randint(15, 30) if stressed else rng.randint(65, 90)
            label = "stressed" if calm_index < 35 else ("calm" if calm_index >= 70 else "neutral")
            db.add(
                EmotionEvent(
                    child_id=child.id,
                    session_id=session.id,
                    client_uuid=next_uuid(),
                    ts=ts,
                    calm_index=calm_index,
                    label=label,
                    face_present=True,
                    quality=round(rng.uniform(0.6, 0.95), 2),
                )
            )

        db.add(
            LedgerEvent(child_id=child.id, session_id=session.id, client_uuid=next_uuid(),
                        ts=day_start + timedelta(minutes=20), kind="bonus", seconds=600,
                        reason="Sustained calm stretch")
        )
        if day_offset % 2 == 0:
            db.add(
                LedgerEvent(child_id=child.id, session_id=session.id, client_uuid=next_uuid(),
                            ts=day_start + timedelta(minutes=40), kind="stress_alert", seconds=300,
                            reason="Sustained stress signals")
            )
            db.add(
                LedgerEvent(child_id=child.id, session_id=session.id, client_uuid=next_uuid(),
                            ts=day_start + timedelta(minutes=40), kind="penalty", seconds=300,
                            reason="Stress breather")
            )
            db.add(
                Alert(
                    parent_id=child.parent_id,
                    child_id=child.id,
                    kind="stress_alert",
                    severity="warning",
                    title="Aarav had a stressful stretch — a 5-minute breather was started",
                    body="SenseHeaven noticed a long run of stress signals and started a breather.",
                    dedupe_key=f"seed-stress-{day_offset}",
                )
            )

        for package, label in PACKAGES:
            db.add(
                AppUsageDaily(child_id=child.id, date=day_start.date(), package=package,
                              label=label, seconds=rng.randint(300, 1800))
            )

    db.commit()
    print(f"seeded {DAYS} days of history for Aarav")


def main() -> int:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        parent = ensure_parent(db)
        child = ensure_child(db, parent)
        seed_history(db, child)
    print("seed complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
