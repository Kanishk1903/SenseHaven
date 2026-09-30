"""Gate-3 helper: reproduce every classifier vector exactly with the reference forward pass."""
from __future__ import annotations

import hashlib
import json
import sys

from src.config import CLASSIFIER_VECTORS, MODEL_JSON
from src.forward_ref import forward


def main() -> int:
    model_bytes = MODEL_JSON.read_bytes()
    model = json.loads(model_bytes)
    payload = json.loads(CLASSIFIER_VECTORS.read_text())

    if payload["model_sha256"] != hashlib.sha256(model_bytes).hexdigest():
        print("check_vectors: FAIL — vectors were generated from a different emotion_model.json", file=sys.stderr)
        return 1
    anchor = model["calm_index"]["anchor"]
    slope = model["calm_index"]["slope"]
    for index, vector in enumerate(payload["vectors"]):
        p, ci = forward(vector["features"], model["mean"], model["std"], model["weights"],
                        model["bias"], anchor, slope, vector["baseline"])
        if abs(p - vector["expected_p"]) > payload["tolerance_p"] or ci != vector["expected_ci"]:
            print(f"check_vectors: FAIL vector {index}: p={p} ci={ci} vs "
                  f"expected p={vector['expected_p']} ci={vector['expected_ci']}", file=sys.stderr)
            return 1
    print(f"check_vectors: all {len(payload['vectors'])} vectors reproduced exactly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
