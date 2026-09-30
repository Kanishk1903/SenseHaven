"""Calm Index calibration (P3.5): grid anchor×slope on VALIDATION only, conditions then max."""
from __future__ import annotations

import json
import math

import joblib
import numpy as np
from sklearn.metrics import roc_auc_score

from src.config import ARTIFACTS_DIR, FEATURES_DIR, REPORTS_DIR

ANCHORS = (72, 75, 78)
SLOPES = (100, 120, 150, 180)
BASELINE_CLAMP = 0.25


def calm_index(p: float, anchor: int, slope: int, baseline: float) -> int:
    """ci = clamp(floor(anchor - slope*(p - baseline) + 0.5), 0, 100) — floor(x+0.5), never round()."""
    raw = math.floor(anchor - slope * (p - baseline) + 0.5)
    return max(0, min(100, raw))


def calibration_rates(p: np.ndarray, y: np.ndarray, anchor: int, slope: int, baseline: float) -> dict:
    ci = np.array([calm_index(float(value), anchor, slope, baseline) for value in p])
    distress, calm = y == 1, y == 0
    return {
        "p_ci_below_35_given_distress": float((ci[distress] < 35).mean()) if distress.any() else 0.0,
        "p_ci_at_least_70_given_calm": float((ci[calm] >= 70).mean()) if calm.any() else 0.0,
        "p_ci_below_35_given_calm": float((ci[calm] < 35).mean()) if calm.any() else 0.0,
    }


def calibrate() -> dict:
    bundle = joblib.load(ARTIFACTS_DIR / "model.pkl")
    val = np.load(FEATURES_DIR / "val.npz", allow_pickle=False)
    p_val = bundle["model"].predict_proba(bundle["scaler"].transform(val["X"].astype(np.float64)))[:, 1]
    y_val = val["y_bin"].astype(int)

    calm_ps = np.sort(p_val[y_val == 0])
    default_baseline = float(np.median(calm_ps)) if len(calm_ps) else 0.0

    best = None
    for anchor in ANCHORS:
        for slope in SLOPES:
            rates = calibration_rates(p_val, y_val, anchor, slope, default_baseline)
            if (rates["p_ci_below_35_given_distress"] >= 0.45
                    and rates["p_ci_at_least_70_given_calm"] >= 0.50
                    and rates["p_ci_below_35_given_calm"] <= 0.15):
                score = (rates["p_ci_below_35_given_distress"]
                         + rates["p_ci_at_least_70_given_calm"])
                if best is None or score > best["score"]:
                    best = {"anchor": anchor, "slope": slope, "score": score, "val": rates}

    chosen = best or {"anchor": 75, "slope": 120,
                      "val": calibration_rates(p_val, y_val, 75, 120, default_baseline)}
    report = {
        "default_baseline": default_baseline,
        "baseline_clamp": BASELINE_CLAMP,
        "chosen": {"anchor": chosen["anchor"], "slope": chosen["slope"]},
        "validation_rates": chosen["val"],
        "conditions_met": best is not None,
        "val_auc": float(roc_auc_score(y_val, p_val)),
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "calibration.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    print(json.dumps(calibrate(), indent=2))
