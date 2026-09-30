#!/usr/bin/env python3
"""Gate-4 helper: assert the committed UI rubric pass rate is >= 80 % (LEAN §1.3)."""
import pathlib
import re
import sys

RUBRIC = pathlib.Path(__file__).resolve().parent.parent / "verification" / "ui-rubric-web.md"


def main() -> int:
    text = RUBRIC.read_text()
    match = re.search(r"Overall pass rate: (\d+)/(\d+)", text)
    if not match:
        print("check_rubric: overall pass-rate line missing from ui-rubric-web.md", file=sys.stderr)
        return 1
    rate = int(match.group(1)) / int(match.group(2))
    if rate < 0.80:
        print(f"check_rubric: FAIL — rubric pass rate {rate:.0%} < 80%", file=sys.stderr)
        return 1
    print(f"check_rubric: rubric pass rate {rate:.0%} >= 80%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
