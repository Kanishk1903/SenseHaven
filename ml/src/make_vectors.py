"""Classifier vectors for the Kotlin parity test (P3.6) — ≥ 60, ci exact, near-integers dropped."""
from __future__ import annotations

import hashlib
import json

import numpy as np

from src.config import CLASSIFIER_VECTORS, MODEL_JSON, REPORTS_DIR, SEED
from src.forward_ref import forward

BASELINES = (None, 0.10, 0.30, 0.55)  # None = model default_baseline
NEAR_INTEGER_EPSILON = 0.01


def _make_vectors(model: dict, rows: list[list[float]]) -> list[dict]:
    anchor = model["calm_index"]["anchor"]
    slope = model["calm_index"]["slope"]
    default_baseline = model["calm_index"]["default_baseline"]
    vectors = []
    for row in rows:
        for baseline in BASELINES:
            b = default_baseline if baseline is None else baseline
            p, ci = forward(row, model["mean"], model["std"], model["weights"],
                            model["bias"], anchor, slope, b)
            raw = anchor - slope * (p - b) + 0.5
            if abs(raw - round(raw)) < NEAR_INTEGER_EPSILON:
                continue  # a 1-ULP difference would flip floor() — drop ambiguous vectors
            vectors.append({
                "features": [float(np.float32(v)) for v in row],
                "baseline": b,
                "expected_p": p,
                "expected_ci": ci,
            })
    return vectors


def make_vectors(test_rows: list[list[float]] | None = None) -> dict:
    model_bytes = MODEL_JSON.read_bytes()
    model = json.loads(model_bytes)
    n = len(model["feature_names"])
    rng = np.random.default_rng(SEED)

    rows: list[list[float]] = []
    if test_rows:
        rows.extend(test_rows[:30])  # 30 real TEST feature rows (numbers only, no images)
    while len(rows) < 30:
        rows.append(rng.uniform(0.0, 1.0, n).tolist())
    extremes: list[list[float]] = [([0.0] * n), ([1.0] * n)]
    extremes += [rng.uniform(0.0, 1.0, n).tolist() for _ in range(8)]  # 10 extremes total
    rows.extend(extremes)

    vectors = _make_vectors(model, rows)
    # top up to >= 60 vectors with baseline variety if near-integer dropping thinned them out
    extra = 0
    while len(vectors) < 60:
        rows.append(rng.uniform(0.0, 1.0, n).tolist())
        vectors = _make_vectors(model, rows)
        extra += 1
        if extra > 500:
            raise RuntimeError("could not generate 60 clean vectors — inspect the model")

    payload = {
        "model_sha256": hashlib.sha256(model_bytes).hexdigest(),
        "tolerance_p": 1e-4,
        "ci_exact": True,
        "vectors": vectors,
    }
    CLASSIFIER_VECTORS.write_text(json.dumps(payload, indent=2) + "\n")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "vectors_report.json").write_text(
        json.dumps({"n_vectors": len(vectors)}, indent=2) + "\n")
    return payload


if __name__ == "__main__":
    payload = make_vectors()
    print(f"wrote {CLASSIFIER_VECTORS} with {len(payload['vectors'])} vectors")
