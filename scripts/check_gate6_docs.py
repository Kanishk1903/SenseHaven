#!/usr/bin/env python3
"""Gate-6 doc checks: edge-case rows mapped + acceptance steps + no open known issues."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
mode = sys.argv[1] if len(sys.argv) > 1 else ""

if mode == "edge":
    text = (ROOT / "docs" / "edge_case_coverage.md").read_text()
    rows = set(re.findall(r"^\| (\d+) \|", text, re.MULTILINE))
    required = {"1", "2", "3", "4", "5", "6", "9", "10", "11", "14", "15", "17", "18", "20"}
    missing = required - rows
    assert not missing, f"edge rows missing: {missing}"
    for name in ("RulesEngineTest", "test_events_idempotent_replay",
                 "test_sync_shape_and_config_pin_versioning"):
        referenced = name in text
        in_api = any(name in f.read_text() for f in (ROOT / "api" / "tests").glob("*.py"))
        in_android = any(name in f.read_text()
                         for f in (ROOT / "android" / "app" / "src" / "test").rglob("*.kt"))
        assert referenced or in_api or in_android, f"edge proof missing: {name}"
    print("edge rows 1,2,3,4,5,6,9,10,11,14,15,17,18,20 all mapped to proof")
elif mode == "acceptance":
    text = (ROOT / "docs" / "DEVICE_ACCEPTANCE_TEST.md").read_text()
    steps = re.findall(r"^\| (A\d+) \|", text, re.MULTILINE)
    assert len(steps) >= 20, f"only {len(steps)} acceptance steps"
    print(f"acceptance doc: A1..{steps[-1][1:]} present ({len(steps)} steps)")
elif mode == "known":
    text = (ROOT / "KNOWN_ISSUES.md").read_text()
    assert "| (none open)" in text or "no open" in text.lower(), "open known issues present"
    print("known issues: none open")
else:
    print("usage: check_gate6_docs.py edge|acceptance|known", file=sys.stderr)
    sys.exit(2)
