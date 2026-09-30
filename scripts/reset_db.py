#!/usr/bin/env python3
"""Dev-only database reset: drop_all + create_all. Refuses to run with ENV=production (P2.1)."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven")
os.environ.setdefault("APP_SECRET", "dev-only-secret-replace-in-production")
os.environ.setdefault("PAIRING_PEPPER", "dev-only-pepper-replace-in-production")

import api.app.models  # noqa: F401  (registers every table on Base.metadata)
from api.app.config import get_settings
from api.app.db import Base, engine


def main() -> int:
    settings = get_settings()
    if settings.is_production:
        print("reset_db.py refuses to run with ENV=production", file=sys.stderr)
        return 1
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("database reset (drop_all + create_all)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
