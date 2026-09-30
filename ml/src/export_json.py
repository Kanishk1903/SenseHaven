"""Canonical JSON export of the emotion model + strict loader/validator (P3.6)."""
from __future__ import annotations

import hashlib
import json

import numpy as np

from src.config import FEATURE_SPEC, MODEL_JSON, TASK_PATH

SCHEMA_VERSION = 1


def _f32(value: float) -> float:
    return float(np.float32(value))


def build_model_json(feature_names: list[str], mean, std, weights, bias: float,
                     anchor: int, slope: int, default_baseline: float,
                     baseline_clamp: float, tier: str, mediapipe_version: str,
                     task_sha256: str) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "model_id": "emotion-calm-v1",
        "tier": tier,
        "feature_names": list(feature_names),
        "mean": [_f32(v) for v in mean],
        "std": [_f32(v) for v in std],
        "weights": [_f32(v) for v in weights],
        "bias": _f32(bias),
        "calm_index": {
            "anchor": int(anchor),
            "slope": int(slope),
            "default_baseline": _f32(default_baseline),
            "baseline_clamp": _f32(baseline_clamp),
        },
        "training": {
            "dataset": "FER2013",
            "label_map": {"distress": ["angry", "fear", "sad"], "calm": ["happy", "neutral"]},
            "seed": 20260928,
            "mediapipe_version": mediapipe_version,
            "task_sha256": task_sha256,
        },
    }


def canonical_bytes(model: dict) -> bytes:
    return json.dumps(model, sort_keys=True, separators=(",", ":")).encode()


def export_json(model: dict) -> dict:
    validate_model(model)
    MODEL_JSON.parent.mkdir(parents=True, exist_ok=True)
    MODEL_JSON.write_bytes(canonical_bytes(model))
    return model


def validate_model(model: dict, feature_spec_path=FEATURE_SPEC) -> None:
    """Reject wrong shapes, non-finite numbers, and feature names off the contract."""
    names = model["feature_names"]
    for key in ("mean", "std", "weights"):
        values = model[key]
        if len(values) != len(names):
            raise ValueError(f"{key} has length {len(values)}, expected {len(names)}")
        if not all(np.isfinite(values)):
            raise ValueError(f"{key} contains non-finite values")
    if not np.isfinite(model["bias"]):
        raise ValueError("bias is not finite")
    if feature_spec_path.exists():
        spec = json.loads(feature_spec_path.read_text())
        if spec.get("feature_names") and spec["feature_names"] != names:
            raise ValueError("feature_names differ from contracts/feature_spec.json")
    if model["tier"] not in ("normal", "limited", "heuristic"):
        raise ValueError(f"invalid tier: {model['tier']}")
    calm = model["calm_index"]
    if not (0 <= calm["baseline_clamp"] <= 1) or not (0 <= calm["default_baseline"] <= 1):
        raise ValueError("calm_index baselines must be probabilities in [0, 1]")


def model_sha256() -> str:
    return hashlib.sha256(MODEL_JSON.read_bytes()).hexdigest()


if __name__ == "__main__":
    import mediapipe

    model = build_model_json(
        feature_names=json.loads(FEATURE_SPEC.read_text())["feature_names"],
        mean=[0.0] * len(json.loads(FEATURE_SPEC.read_text())["feature_names"]),
        std=[1.0] * len(json.loads(FEATURE_SPEC.read_text())["feature_names"]),
        weights=[0.0] * len(json.loads(FEATURE_SPEC.read_text())["feature_names"]),
        bias=0.0, anchor=75, slope=120, default_baseline=0.0, baseline_clamp=0.25,
        tier="heuristic", mediapipe_version=mediapipe.__version__,
        task_sha256=hashlib.sha256(TASK_PATH.read_bytes()).hexdigest(),
    )
    export_json(model)
    print(f"wrote {MODEL_JSON} ({len(canonical_bytes(model))} bytes)")
