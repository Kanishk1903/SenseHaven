"""Float32 numpy forward reference (P3.6) — the exact maths the Kotlin port must reproduce.

p  = sigmoid((clamp01(x) - mean)/max(std, 1e-3) · w + b)
ci = clamp(floor(anchor - slope*(p - baseline) + 0.5), 0, 100)
"""
from __future__ import annotations

import math

import numpy as np


def forward(x, mean, std, weights, bias: float, anchor: int, slope: int, baseline: float) -> tuple[float, int]:
    x = np.asarray(x, dtype=np.float32)
    mean = np.asarray(mean, dtype=np.float32)
    std = np.asarray(std, dtype=np.float32)
    weights = np.asarray(weights, dtype=np.float32)
    if x.shape != (weights.shape[0],):
        raise ValueError(
            f"feature vector has wrong length: expected {weights.shape[0]}, got {x.shape[0]}"
        )
    if not np.all(np.isfinite(x)):
        raise ValueError("feature vector contains non-finite values (NaN/Inf)")

    z = (np.clip(x, np.float32(0.0), np.float32(1.0)) - mean) / np.maximum(std, np.float32(1e-3))
    logit = float(z @ weights + np.float32(bias))
    # numerically stable sigmoid
    if logit >= 0:
        p = 1.0 / (1.0 + math.exp(-logit))
    else:
        e = math.exp(logit)
        p = e / (1.0 + e)
    ci = max(0, min(100, math.floor(anchor - slope * (p - baseline) + 0.5)))
    return p, ci
