#!/usr/bin/env bash
# Fetch the MediaPipe Face Landmarker task bundle used by BOTH training and the Android app
# (File 01 D-6: same .task file in training and on device). Idempotent: verifies the stored
# SHA-256 on every run and fails on mismatch.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
OUT="ml/artifacts/face_landmarker.task"
SPEC="contracts/feature_spec.json"

mkdir -p ml/artifacts

if [ ! -s "$OUT" ]; then
  # Verify the URL is live before downloading; if it moved, stop and log the new URL.
  code="$(curl -sIL -o /dev/null -w '%{http_code}' "$URL")"
  if [ "$code" != "200" ]; then
    echo "fetch_models: model URL returned HTTP $code — look up the current MediaPipe Face Landmarker" >&2
    echo "  URL, record it in DECISIONS.md, update this script, and re-run." >&2
    exit 1
  fi
  curl -sL "$URL" -o "$OUT"
  echo "fetch_models: downloaded $OUT"
else
  echo "fetch_models: $OUT already present"
fi

actual="$(shasum -a 256 "$OUT" | awk '{print $1}')"
python3 - "$SPEC" "$actual" << 'PYEOF'
import json
import sys
import pathlib

spec_path, sha = pathlib.Path(sys.argv[1]), sys.argv[2]
spec = json.loads(spec_path.read_text()) if spec_path.exists() else {}
if spec.get("task_sha256") not in (None, sha):
    sys.exit(
        f"fetch_models: SHA-256 mismatch — expected {spec.get('task_sha256')}, got {sha}. "
        "The task bundle changed; investigate before continuing."
    )
spec["task_sha256"] = sha
spec_path.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
print(f"fetch_models: hash OK ({sha[:16]}…)")
PYEOF
