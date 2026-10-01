#!/usr/bin/env python3
"""Generate docs/er.mermaid from the SQLAlchemy metadata (P8.1). Deterministic."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven")
os.environ.setdefault("APP_SECRET", "er-gen-not-for-production")
os.environ.setdefault("PAIRING_PEPPER", "er-gen-pepper")

from api.app.db import Base

OUT = ROOT / "docs" / "er.mermaid"


def main() -> int:
    lines = ["erDiagram"]
    for table in sorted(Base.metadata.sorted_tables, key=lambda t: t.name):
        lines.append(f"    {table.name} {{")
        for column in table.columns:
            type_name = column.type.__class__.__name__.upper()
            flag = " PK" if column.primary_key else (" FK" if column.foreign_keys else "")
            lines.append(f"        {type_name} {column.name}{flag}")
        lines.append("    }")
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            lines.append(f"    {fk.constraint.referred_table.name} ||--o{{ {table.name} : has")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
