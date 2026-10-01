#!/usr/bin/env bash
# Gate-7 "docker" check: build the image and prove it serves the SPA + API + healthz,
# with /docs disabled in production and SPA fallback working.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== building web dist =="
(cd web && npm run build > /dev/null)

echo "== docker build =="
docker build -t senseheaven:gate7 . > /tmp/sh-docker-gate7.log 2>&1

PORT=8033
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
docker run -d --rm --name sh-gate7 -p "$PORT:$PORT" \
  -e ENV=production -e PORT="$PORT" \
  -e DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://senseheaven:senseheaven@host.docker.internal:5432/senseheaven}" \
  -e APP_SECRET="gate7-secret-not-for-production" \
  -e PAIRING_PEPPER="gate7-pepper-not-for-production" \
  senseheaven:gate7 > /dev/null
trap 'docker stop sh-gate7 >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 60); do
  curl -sf "http://localhost:$PORT/api/v1/healthz" >/dev/null 2>&1 && break
  sleep 1
done

curl -sf "http://localhost:$PORT/api/v1/healthz" | grep -q '"ok"' && echo "PASS container /api/v1/healthz"
curl -sf "http://localhost:$PORT/" | grep -q '<div id="root">' && echo "PASS container serves SPA"
curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/children/xyz" | grep -q 200 && echo "PASS SPA fallback"
curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/docs" | grep -q 404 && echo "PASS /docs disabled"
