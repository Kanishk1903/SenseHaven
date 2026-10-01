#!/usr/bin/env bash
# Gate-7 "no dev leaks": the production image must not contain .env, ml/data or the .task file.
set -uo pipefail
cd "$(dirname "$0")/.."
FAILED=0

CID=sh-leaks
docker rm -f "$CID" >/dev/null 2>&1 || true
docker create --name "$CID" senseheaven:gate7 true >/dev/null 2>&1 \
  || docker build -q -t senseheaven:gate7 . >/dev/null 2>&1 \
  && docker create --name "$CID" senseheaven:gate7 true >/dev/null 2>&1

for path in "^\.env$" "ml/data" "face_landmarker.task"; do
  if docker export "$CID" | tar -tf - 2>/dev/null | grep -Eq "$path"; then
    echo "LEAK: $path present in the image"
    FAILED=1
  fi
done
docker rm -f "$CID" >/dev/null 2>&1 || true
[ "$FAILED" = "0" ] && echo "no dev leaks: OK"
exit $FAILED
