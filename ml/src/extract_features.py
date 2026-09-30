"""Blendshape feature extraction with MediaPipe Face Landmarker (P3.3): helpers + driver."""
from __future__ import annotations

import json
import random
from pathlib import Path

import cv2
import numpy as np

from src.config import (
    FEATURE_SPEC,
    FEATURES_DIR,
    REPORTS_DIR,
    SEED,
    TASK_PATH,
)
from src.dataset_index import build_index, write_report
from src.preprocess import prepare

CHECKPOINT_EVERY = 1000
PILOT_N = 300
VAL_FRACTION = 0.15


# ---------------------------------------------------------------- landmarker helpers


def make_landmarker(task_path: Path = TASK_PATH):
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    options = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(task_path)),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        output_face_blendshapes=True,
        min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3,
    )
    return vision.FaceLandmarker.create_from_options(options)


def detect(lm, rgb: np.ndarray):
    """Run the landmarker on an RGB uint8 image; returns the raw result (or None)."""
    import mediapipe as mp

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    try:
        return lm.detect(mp_image)
    except Exception:  # noqa: BLE001 — any landmarker failure simply means "no detection"
        return None


def blendshape_names(result) -> list[str] | None:
    if not result or not result.face_blendshapes:
        return None
    names = [cat.category_name for cat in result.face_blendshapes[0]]
    return [name for name in names if name != "_neutral"]


def blendshape_scores(result, names: list[str] | None = None) -> np.ndarray | None:
    if not result or not result.face_blendshapes:
        return None
    scores = {cat.category_name: cat.score for cat in result.face_blendshapes[0]}
    if names is None:
        ordered = [score for name, score in scores.items() if name != "_neutral"]
        return np.asarray(ordered, dtype=np.float32)
    return np.asarray([scores.get(name, 0.0) for name in names], dtype=np.float32)


def extract_one(lm, rgb: np.ndarray, names: list[str] | None):
    """Returns (feature_vector, names); the name order is learned from the first success."""
    result = detect(lm, rgb)
    if result is None:
        return None, names
    if names is None:
        names = blendshape_names(result)
        if names is None:
            return None, names
    return blendshape_scores(result, names), names


# ---------------------------------------------------------------- driver


def run_pilot(lm, entries, rng) -> dict:
    """Grid-search pad_frac × size on a random train sample; keep the best detection rate."""
    from src.config import PAD_FRAC_GRID, SIZE_GRID

    train_pool = [entry for entry in entries if entry.source_split == "train"]
    sample = rng.sample(train_pool, min(PILOT_N, len(train_pool)))
    results = {}
    for pad_frac in PAD_FRAC_GRID:
        for size in SIZE_GRID:
            detected = 0
            for entry in sample:
                img = cv2.imread(entry.path_or_row)
                if img is None:
                    continue
                rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                result = detect(lm, prepare(rgb, pad_frac, size))
                if result is not None and result.face_blendshapes:
                    detected += 1
            results[f"pad{pad_frac}_size{size}"] = {
                "pad_frac": pad_frac, "size": size,
                "detection_rate": round(detected / max(len(sample), 1), 4),
            }
    winner = max(results.values(), key=lambda r: r["detection_rate"])
    report = {"n_sample": len(sample), "grid": results, "winner": winner}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "preprocess_pilot.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def extract_split(lm, entries, names, split: str, pad_frac: float, size: int) -> tuple[dict, list[str]]:
    X, y_bin, y7, detected, md5s = [], [], [], [], []
    for index, entry in enumerate(entries):
        img = cv2.imread(entry.path_or_row)
        vector = None
        if img is not None:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            vector, names = extract_one(lm, prepare(rgb, pad_frac, size), names)
        X.append(vector if vector is not None else np.zeros(len(names or []), dtype=np.float32))
        y_bin.append(1 if entry.binary == "distress" else 0)
        y7.append(entry.label7)
        detected.append(vector is not None)
        md5s.append(entry.md5)
        if (index + 1) % CHECKPOINT_EVERY == 0:
            print(f"  {split}: {index + 1}/{len(entries)}", flush=True)
    data = {
        "X": np.asarray(X, dtype=np.float32),
        "y_bin": np.asarray(y_bin, dtype=np.int64),
        "y7": np.asarray(y7),
        "detected": np.asarray(detected, dtype=bool),
        "md5": np.asarray(md5s),
        "names": np.asarray(names or []),
    }
    return data, (names or [])


def main() -> int:
    import mediapipe

    entries, index_report = build_index()
    write_report(index_report)
    print(f"dataset index: {index_report['after_sampling']}")

    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    lm = make_landmarker()
    pilot = run_pilot(lm, entries, random.Random(SEED))
    pad_frac, size = pilot["winner"]["pad_frac"], int(pilot["winner"]["size"])
    print(f"pilot winner: pad={pad_frac} size={size} rate={pilot['winner']['detection_rate']:.3f}")

    train_pool = [entry for entry in entries if entry.source_split == "train"]
    test_pool = [entry for entry in entries if entry.source_split == "test"]
    shuffled = train_pool[:]
    random.Random(SEED).shuffle(shuffled)
    cut = int(len(shuffled) * (1 - VAL_FRACTION))
    splits = {"train": shuffled[:cut], "val": shuffled[cut:], "test": test_pool}

    names = None
    detection: dict = {}
    for split, pool in splits.items():
        data, names = extract_split(lm, pool, names, split, pad_frac, size)
        np.savez(FEATURES_DIR / f"{split}.npz", **data)
        rate = float(data["detected"].mean()) if len(data["detected"]) else 0.0
        detection[split] = {"rate": round(rate, 4), "n": len(data["detected"]),
                            "n_detected": int(data["detected"].sum())}

    total_n = sum(d["n"] for d in detection.values())
    detection["overall_rate"] = round(
        sum(d["n_detected"] for d in detection.values()) / max(total_n, 1), 4)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "detection.json").write_text(json.dumps(detection, indent=2) + "\n")

    spec = json.loads(FEATURE_SPEC.read_text())
    spec["feature_names"] = names
    spec["n_features"] = len(names)
    spec["mediapipe_version"] = mediapipe.__version__
    spec["preprocess"] = {"pad_frac": pad_frac, "size": size}
    FEATURE_SPEC.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    print(f"features: names={len(names)} overall detection rate={detection['overall_rate']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
