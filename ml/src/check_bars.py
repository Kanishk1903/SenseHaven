"""Gate-3 helper: assert the frozen evaluation bars against ml/reports/*.json (LEAN §6.5–6.6)."""
from __future__ import annotations

import json
import sys

from src.config import REPORTS_DIR

BARS = {
    "roc_auc": (">=", 0.75),
    "balanced_accuracy": (">=", 0.68),
    "distress_recall": (">=", 0.60),
    "calm_false_alarm": ("<=", 0.35),
}
TEST_INDEX_BARS = {
    "p_ci_below_35_given_distress": (">=", 0.40),
    "p_ci_at_least_70_given_calm": (">=", 0.45),
    "p_ci_below_35_given_calm": ("<=", 0.20),
}


def _compare(value: float, op: str, bar: float) -> bool:
    return value >= bar if op == ">=" else value <= bar


def main() -> int:
    evaluation_path = REPORTS_DIR / "evaluation.json"
    calibration_path = REPORTS_DIR / "calibration.json"
    if not evaluation_path.exists() or not calibration_path.exists():
        print("evaluation/calibration reports missing — run make ml-eval && make ml-export first", file=sys.stderr)
        return 1
    evaluation = json.loads(evaluation_path.read_text())
    calibration = json.loads(calibration_path.read_text())

    failed = False
    for key, (op, bar) in BARS.items():
        value = evaluation[key]
        ok = _compare(value, op, bar)
        failed |= not ok
        print(f"{'PASS' if ok else 'FAIL'} {key}: {value:.4f} {op} {bar}")
    test_rates = calibration.get("test_rates", calibration["chosen"].get("test_rates", {}))
    if not test_rates:
        print("FAIL calibration.json has no test_rates (run once on TEST after freezing)")
        return 1
    for key, (op, bar) in TEST_INDEX_BARS.items():
        value = test_rates[key]
        ok = _compare(value, op, bar)
        failed |= not ok
        print(f"{'PASS' if ok else 'FAIL'} {key}: {value:.4f} {op} {bar}")

    if failed:
        print("check_bars: FAIL — per LEAN §6.5 apply the documented fallback ladder, never lower bars")
        return 1
    print("check_bars: all bars met")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
