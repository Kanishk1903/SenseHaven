"""Evaluation on the held-out test split (P3.4) — run once, after the model is frozen."""
from __future__ import annotations

import json

import joblib
import numpy as np
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, roc_auc_score

from src.config import ARTIFACTS_DIR, FEATURES_DIR, REPORTS_DIR, SEED

BOOTSTRAP_SAMPLES = 500


def ece(scores: np.ndarray, labels: np.ndarray, bins: int = 10) -> float:
    """Expected Calibration Error with equal-width bins on p(distress)."""
    edges = np.linspace(0.0, 1.0, bins + 1)
    total = len(scores)
    error = 0.0
    for i in range(bins):
        mask = (scores > edges[i]) & (scores <= edges[i + 1]) if i else (scores >= 0) & (scores <= edges[1])
        if not mask.any():
            continue
        error += (mask.sum() / total) * abs(scores[mask].mean() - labels[mask].mean())
    return float(error)


def bootstrap_auc_ci(scores: np.ndarray, labels: np.ndarray, samples: int = BOOTSTRAP_SAMPLES) -> tuple[float, float]:
    rng = np.random.default_rng(SEED)
    aucs = []
    n = len(labels)
    for _ in range(samples):
        idx = rng.integers(0, n, n)
        if len(set(labels[idx])) < 2:
            continue
        aucs.append(roc_auc_score(labels[idx], scores[idx]))
    return float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))


def evaluate() -> dict:
    bundle = joblib.load(ARTIFACTS_DIR / "model.pkl")
    test = np.load(FEATURES_DIR / "test.npz", allow_pickle=False)
    X, y = test["X"].astype(np.float64), test["y_bin"].astype(int)
    y7 = test["y7"].astype(str)

    scores = bundle["model"].predict_proba(bundle["scaler"].transform(X))[:, 1]
    raw_heuristic = bundle["heuristic"]["terms"]
    names = bundle["names"]
    h_raw = np.zeros(len(X))
    for term, weight in raw_heuristic.items():
        if term in names:
            h_raw += weight * X[:, names.index(term)]
    lo, hi = bundle["heuristic"]["min"], bundle["heuristic"]["max"]
    h_scores = (h_raw - lo) / (hi - lo) if hi > lo else np.zeros_like(h_raw)

    auc = float(roc_auc_score(y, scores))
    ci_low, ci_high = bootstrap_auc_ci(scores, y)
    predicted = (scores > 0.5).astype(int)
    report = {
        "roc_auc": auc,
        "roc_auc_ci95": [ci_low, ci_high],
        "balanced_accuracy": float(balanced_accuracy_score(y, predicted)),
        "distress_recall": float((scores[y == 1] > 0.5).mean()),
        "calm_false_alarm": float((scores[y == 0] > 0.5).mean()),
        "brier": float(np.mean((scores - y) ** 2)),
        "ece_10bin": ece(scores, y),
        "heuristic": {
            "roc_auc": float(roc_auc_score(y, h_scores)) if len(set(y)) > 1 else None,
            "balanced_accuracy": float(balanced_accuracy_score(y, (h_scores > 0.5).astype(int))),
        },
        "n_test": len(y),
        "confusion": confusion_matrix(y, predicted).tolist(),
    }
    per_class = {}
    for label7 in sorted(set(y7.tolist())):
        mask = y7 == label7
        binary = "distress" if label7 in ("angry", "fear", "sad") else "calm"
        per_class[label7] = {"n": int(mask.sum()), "binary": binary,
                             "mean_p": float(scores[mask].mean())}
    report["per_original_class"] = per_class

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "evaluation.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
