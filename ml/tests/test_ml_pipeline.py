"""P3.3–P3.6 — preprocessing, quality, forward-parity with sklearn, export, vectors.

All tests are data-independent (synthetic models/fixtures) so they run before FER2013 (H3).
"""
import json

import numpy as np
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from src.config import SEED
from src.export_json import build_model_json, canonical_bytes, validate_model
from src.forward_ref import forward
from src.make_vectors import _make_vectors
from src.preprocess import prepare
from src.quality_ref import light_score, quality, size_score
from src.train import augment_flips, flip_pairs, heuristic_scores


def test_prepare_output_shape_and_pad():
    img = np.full((48, 48), 200, dtype=np.uint8)
    out = prepare(img, pad_frac=0.25, size=256)
    assert out.shape == (256, 256, 3) and out.dtype == np.uint8
    assert out[0, 0, 0] == 0  # padded border is black
    inner = prepare(img, pad_frac=0.0, size=256)
    assert inner[128, 128, 0] == 200  # centre preserved without pad


def test_quality_boundaries():
    assert size_score(0.04, 1.0) == 0.0
    assert size_score(0.12, 1.0) == 1.0
    assert size_score(0.08, 1.0) == pytest.approx(0.5)
    assert size_score(0.5, 0.0) == 0.0  # degenerate frame
    assert light_score(39.9) == 0.3
    assert light_score(40.0) == 1.0
    assert light_score(220.0) == 1.0
    assert light_score(220.1) == 0.3
    assert quality(0.08, 1.0, 10.0) == 0.3  # min(size, light)
    assert quality(0.02, 1.0, 100.0) == 0.0


@pytest.fixture(scope="module")
def synthetic_model():
    rng = np.random.default_rng(SEED)
    names = [f"browDown{i}Left" if i % 2 == 0 else f"mouthSmile{i}Right" for i in range(12)]
    names[0], names[1] = "browDownLeft", "browDownRight"
    names[2], names[3] = "mouthSmileLeft", "mouthSmileRight"
    X = rng.uniform(0.0, 1.0, (240, 12))
    logits = 3.0 * X[:, 0] - 3.0 * X[:, 2] + rng.normal(0, 0.3, 240)
    y = (logits > 0).astype(int)
    scaler = StandardScaler().fit(X)
    model = LogisticRegression(max_iter=2000, random_state=SEED).fit(scaler.transform(X), y)
    return {"names": names, "X": X, "y": y, "scaler": scaler, "model": model}


def test_flip_pairs_swap_left_right():
    names = ["browDownLeft", "browDownRight", "mouthSmileLeft", "mouthSmileRight", "browInnerUp"]
    pairs = flip_pairs(names)
    assert pairs == [(0, 1), (2, 3)]
    X = np.arange(10, dtype=float).reshape(2, 5)
    y = np.array([0, 1])
    X_aug, y_aug = augment_flips(X, y, names)
    assert len(X_aug) == 4 and list(y_aug) == [0, 1, 0, 1]
    # row 2 is the mirror of row 0: pairs swapped, non-paired column kept
    assert X_aug[2][0] == X[0][1] and X_aug[2][1] == X[0][0]
    assert X_aug[2][2] == X[0][3] and X_aug[2][3] == X[0][2]
    assert X_aug[2][4] == X[0][4]


def test_heuristic_scores_sum_named_terms(synthetic_model):
    names, X = synthetic_model["names"], synthetic_model["X"]
    scores = heuristic_scores(X, names)
    expected = X[:, 0] + X[:, 1] - X[:, 2] - X[:, 3]  # browDown L+R minus mouthSmile L+R
    assert np.allclose(scores, expected)


def test_forward_matches_sklearn_to_1e5(synthetic_model):
    model = synthetic_model["model"]
    scaler = synthetic_model["scaler"]
    mean = scaler.mean_.astype(np.float32)
    std = scaler.scale_.astype(np.float32)
    weights = model.coef_[0].astype(np.float32)
    bias = float(model.intercept_[0])
    for row in synthetic_model["X"][:50]:
        p, _ci = forward(row, mean, std, weights, bias, 75, 120, 0.0)
        sklearn_p = model.predict_proba(scaler.transform(row.reshape(1, -1)))[:, 1][0]
        assert abs(p - float(sklearn_p)) <= 1e-5


def test_forward_ci_formula_and_clamps():
    n = 3
    mean, std, weights = [0.0] * n, [1.0] * n, [1.0, 0.0, 0.0]
    p, ci = forward([1.0, 0.5, 0.5], mean, std, weights, 0.0, 75, 120, 0.0)
    from src.calibrate_index import calm_index

    assert ci == calm_index(p, 75, 120, 0.0)
    # inputs clamped to [0, 1]: values outside are clipped, not rejected
    p_clipped, _ = forward([5.0, -3.0, 0.5], mean, std, weights, 0.0, 75, 120, 0.0)
    p_one, _ = forward([1.0, 0.0, 0.5], mean, std, weights, 0.0, 75, 120, 0.0)
    assert p_clipped == p_one
    # wrong length and NaN raise clear errors
    with pytest.raises(ValueError, match="wrong length"):
        forward([1.0, 1.0], mean, std, weights, 0.0, 75, 120, 0.0)
    with pytest.raises(ValueError, match="non-finite"):
        forward([1.0, float("nan"), 0.5], mean, std, weights, 0.0, 75, 120, 0.0)


def test_export_canonical_and_validator(tmp_path, monkeypatch, synthetic_model):
    from src import export_json as export_module

    out_path = tmp_path / "emotion_model.json"
    monkeypatch.setattr(export_module, "MODEL_JSON", out_path)
    scaler, model = synthetic_model["scaler"], synthetic_model["model"]
    payload = build_model_json(
        feature_names=synthetic_model["names"],
        mean=scaler.mean_, std=scaler.scale_, weights=model.coef_[0],
        bias=float(model.intercept_[0]), anchor=75, slope=120,
        default_baseline=0.2, baseline_clamp=0.25, tier="heuristic",
        mediapipe_version="test", task_sha256="deadbeef",
    )
    export_module.export_json(payload)
    written = out_path.read_bytes()
    assert written == canonical_bytes(payload)  # canonical: sorted keys, compact
    assert len(written) <= 20 * 1024
    import hashlib

    assert hashlib.sha256(written).hexdigest() == hashlib.sha256(canonical_bytes(payload)).hexdigest()

    tampered = json.loads(written)
    tampered["weights"] = tampered["weights"][:-1]
    with pytest.raises(ValueError, match="length"):
        validate_model(tampered)
    tampered2 = json.loads(written)
    tampered2["mean"][0] = None
    with pytest.raises((ValueError, TypeError)):
        validate_model(tampered2)


def test_vectors_generated_and_exact(tmp_path, monkeypatch, synthetic_model):

    scaler, model = synthetic_model["scaler"], synthetic_model["model"]
    payload_model = build_model_json(
        feature_names=synthetic_model["names"],
        mean=scaler.mean_, std=scaler.scale_, weights=model.coef_[0],
        bias=float(model.intercept_[0]), anchor=75, slope=120,
        default_baseline=0.2, baseline_clamp=0.25, tier="heuristic",
        mediapipe_version="test", task_sha256="deadbeef",
    )
    rng = np.random.default_rng(SEED)
    rows = rng.uniform(0.0, 1.0, (30, 12)).tolist()
    vectors = _make_vectors(payload_model, rows)
    assert len(vectors) >= 40  # 30 rows × 4 baselines, minus near-integer drops
    baselines = {round(v["baseline"], 2) for v in vectors}  # default_baseline is float32-rounded
    assert {0.2, 0.1, 0.3, 0.55} == baselines
    for vector in vectors:
        p, ci = forward(vector["features"], payload_model["mean"], payload_model["std"],
                        payload_model["weights"], payload_model["bias"], 75, 120,
                        vector["baseline"])
        assert abs(p - vector["expected_p"]) <= 1e-9
        assert ci == vector["expected_ci"]
        raw = 75 - 120 * (p - vector["baseline"]) + 0.5
        assert abs(raw - round(raw)) >= 0.01  # near-integer vectors were dropped
