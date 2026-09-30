#!/usr/bin/env ml/.venv/bin/python
"""Download FER2013 (P3.2) — REQUIRES human step H3 (Kaggle credentials = licence acceptance)."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from src.config import DATA_DIR

SLUG = "msambare/fer2013"


def main() -> int:
    if shutil.which("kaggle") is None and (Path.home() / ".kaggle" / "kaggle.json").exists() is False:
        print(
            "kaggle CLI/credentials not found. Complete human step H3 first (see SETUP_REQUIRED.md):\n"
            "  export KAGGLE_USERNAME=... KAGGLE_KEY=...\n"
            f"then re-run: ml/.venv/bin/kaggle datasets download -d {SLUG} -p ml/data/ --unzip",
            file=sys.stderr,
        )
        return 1
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["kaggle", "datasets", "download", "-d", SLUG, "-p", str(DATA_DIR), "--unzip"],
        check=False,
    )
    if result.returncode != 0:
        print("kaggle download failed — verify the slug exists; if it moved, find a FER2013 "
              "mirror, log it in DECISIONS.md, and update SLUG here.", file=sys.stderr)
        return result.returncode
    print(f"FER2013 downloaded to {DATA_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
