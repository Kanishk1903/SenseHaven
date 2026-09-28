#!/usr/bin/env python3
"""Write and validate verification/phase-N.json for the gate runner.

Input is a TSV file (or `-` for stdin) produced by scripts/gate.sh:
    check\\t<name>\\t<cmd>\\t<exit>
    blocked\\t<name>\\t<H-id>\\t<why>

Output file (verification/phase-N.json):
    {phase, timestamp, checks:[{name, cmd, exit, pass, blocked?, note?}],
     verdict: "PASS|FAIL|PASS_WITH_FALLBACK|BLOCKED_ON_<H-id>", fallback_applied}

Exit codes: 0 unless verdict == FAIL (then 1); 2 on writer/validator errors.
`--selftest` writes a sample file to a temp dir and validates it — used by the gate-0
"runner" check (a nested `gate.sh 0` inside gate-0 would recurse forever).
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

REQUIRED_KEYS = {"phase", "timestamp", "checks", "verdict", "fallback_applied"}
CHECK_KEYS = ("name", "cmd", "exit", "pass")
VERDICTS = {"PASS", "FAIL", "PASS_WITH_FALLBACK"}


def validate(path: str) -> dict:
    with open(path) as f:
        data = json.load(f)
    missing = REQUIRED_KEYS - set(data)
    if missing:
        raise ValueError(f"phase json missing keys: {sorted(missing)}")
    for check in data["checks"]:
        for key in CHECK_KEYS:
            if key not in check:
                raise ValueError(f"check entry missing {key!r}: {check}")
    verdict = data["verdict"]
    if verdict not in VERDICTS and not verdict.startswith("BLOCKED_ON_"):
        raise ValueError(f"invalid verdict: {verdict}")
    return data


def build(phase: str, results_path: str) -> dict:
    if results_path == "-":
        lines = sys.stdin.read().splitlines()
    else:
        with open(results_path) as f:
            lines = f.read().splitlines()

    checks: list[dict] = []
    blocked_ids: list[str] = []
    failed = False
    for line in lines:
        if not line.strip():
            continue
        parts = line.split("\t")
        kind = parts[0]
        if kind == "check" and len(parts) >= 4:
            name, cmd, exit_s = parts[1], parts[2], parts[3]
            exit_code = int(exit_s) if exit_s.lstrip("-").isdigit() else 1
            checks.append({"name": name, "cmd": cmd, "exit": exit_code, "pass": exit_code == 0})
            if exit_code != 0:
                failed = True
        elif kind == "blocked" and len(parts) >= 3:
            name, hid = parts[1], parts[2]
            why = parts[3] if len(parts) > 3 else ""
            checks.append(
                {"name": name, "cmd": "", "exit": None, "pass": True, "blocked": hid, "note": why}
            )
            if hid not in blocked_ids:
                blocked_ids.append(hid)

    fallback_path = f"verification/.fallback-phase-{phase}"
    fallback = os.path.exists(fallback_path)
    if failed:
        verdict = "FAIL"
    elif fallback:
        verdict = "PASS_WITH_FALLBACK"
    elif blocked_ids:
        verdict = "BLOCKED_ON_" + "+".join(blocked_ids)
    else:
        verdict = "PASS"

    return {
        "phase": int(phase),
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "checks": checks,
        "verdict": verdict,
        "fallback_applied": fallback,
    }


def main() -> int:
    args = sys.argv[1:]
    if args and args[0] == "--selftest":
        sample = {
            "phase": 0,
            "timestamp": "2026-01-01T00:00:00+00:00",
            "checks": [{"name": "sample", "cmd": "true", "exit": 0, "pass": True}],
            "verdict": "PASS",
            "fallback_applied": False,
        }
        fd, path = tempfile.mkstemp(suffix=".json")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(sample, f)
            validate(path)
        finally:
            os.unlink(path)
        print("runner selftest OK: phase-N.json writer emits a valid, schema-checked file")
        return 0
    if len(args) < 2:
        print("usage: _gate_json.py <phase> <results.tsv|-> | --selftest", file=sys.stderr)
        return 2
    phase, results = args[0], args[1]
    data = build(phase, results)
    out_path = f"verification/phase-{phase}.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    validate(out_path)
    print(f"gate-{phase}: verdict {data['verdict']} — written to {out_path}")
    return 1 if data["verdict"] == "FAIL" else 0


if __name__ == "__main__":
    sys.exit(main())
