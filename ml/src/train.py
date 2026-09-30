"""Training (P3.4): StandardScaler + LogisticRegression with flip augmentation + heuristic H."""
from __future__ import annotations

import json

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

from src.config import ARTIFACTS_DIR, FEATURES_DIR, REPORTS_DIR, SEED

C_GRID = (0.01, 0.1, 1.0, 10.0)
HEURISTIC_TERMS = {  # + distress shapes, − calm shapes (LEAN §6.5 heuristic H)
    "browDownLeft": 1.0, "browDownRight": 1.0, "browInnerUp": 0.5,
    "mouthFrownLeft": 1.0, "mouthFrownRight": 1.0,
    "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
    "mouthSmileLeft": -1.0, "mouthSmileRight": -1.0,
}


def flip_pairs(names: list[str]) -> list[tuple[int, int]]:
    """Index pairs (left, right) whose names end in Left/Right."""
    right_of = {name[:-5]: i for i, name in enumerate(names) if name.endswith("Right")}
    pairs = []
    for i, name in enumerate(names):
        if name.endswith("Left") and name[:-4] in right_of:
            pairs.append((i, right_of[name[:-4]]))
    return pairs


def augment_flips(X: np.ndarray, y: np.ndarray, names: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """TRAIN-ONLY augmentation: mirror each row by swapping every Left/Right feature pair."""
    pairs = flip_pairs(names)
    if not pairs:
        return X, y
    mirrored = X.copy()
    for left, right in pairs:
        mirrored[:, [left, right]] = X[:, [right, left]]
    return np.vstack([X, mirrored]), np.concatenate([y, y])


def heuristic_scores(X: np.ndarray, names: list[str]) -> np.ndarray:
    """Fixed weighted sum of distress-minus-calm blendshapes, min-max scaled on train later."""
    raw = np.zeros(len(X), dtype=np.float64)
    for term, weight in HEURISTIC_TERMS.items():
        if term in names:
            raw += weight * X[:, names.index(term)]
    return raw


def fit_heuristic_scaler(raw: np.ndarray) -> tuple[float, float]:
    return float(raw.min()), float(raw.max())


def load_features():
    data = np.load(FEATURES_DIR / "train.npz", allow_pickle=False)
    val = np.load(FEATURES_DIR / "val.npz", allow_pickle=False)
    return data, val


def train() -> dict:
    """Fit scaler + LR (C by validation ROC-AUC) and the heuristic baseline."""
    train_npz, val_npz = load_features()
    names = [str(n) for n in train_npz["names"].tolist()]
    X_train, y_train = train_npz["X"].astype(np.float64), train_npz["y_bin"].astype(int)
    X_val, y_val = val_npz["X"].astype(np.float64), val_npz["y_bin"].astype(int)

    X_aug, y_aug = augment_flips(X_train, y_train, names)
    scaler = StandardScaler().fit(X_aug)
    Z_train, Z_val = scaler.transform(X_aug), scaler.transform(X_val)

    best = {"C": None, "auc": -1.0, "model": None}
    for c_value in C_GRID:
        model = LogisticRegression(C=c_value, class_weight="balanced", max_iter=2000, random_state=SEED)
        model.fit(Z_train, y_aug)
        auc = roc_auc_score(y_val, model.predict_proba(Z_val)[:, 1])
        if auc > best["auc"]:
            best = {"C": c_value, "auc": float(auc), "model": model}

    raw_train = heuristic_scores(X_train, names)
    lo, hi = fit_heuristic_scaler(raw_train)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"scaler": scaler, "model": best["model"], "names": names,
                 "heuristic": {"terms": HEURISTIC_TERMS, "min": lo, "max": hi}},
                ARTIFACTS_DIR / "model.pkl")
    report = {"chosen_C": best["C"], "val_auc": best["auc"], "n_features": len(names),
              "n_train_rows_after_flips": len(X_aug)}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "train_report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
