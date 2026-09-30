#!/usr/bin/env bash
# Gate-4 check: the API in production mode serves the built SPA + API on one port (D-4).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=8023
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true

echo "== building web (if dist missing) =="
test -f web/dist/index.html || (cd web && npm run build)

export ENV=production
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven}"
export APP_SECRET="${APP_SECRET:-gate-only-secret-not-for-production}"
export PAIRING_PEPPER="${PAIRING_PEPPER:-gate-only-pepper-not-for-production}"

(cd api && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" > /tmp/sh-prod-serve.log 2>&1 & echo $! > /tmp/sh-prod-serve.pid)
API_PID="$(cat /tmp/sh-prod-serve.pid)"
cleanup() { kill "$API_PID" 2>/dev/null || true; sleep 1; lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  curl -sf "http://localhost:$PORT/api/v1/healthz" >/dev/null 2>&1 && break
  sleep 1
done

echo "== checks =="
curl -sf "http://localhost:$PORT/api/v1/healthz" | grep -q '"ok"' && echo "PASS /api/v1/healthz"
curl -sf "http://localhost:$PORT/" | grep -q "<div id=\"root\">" && echo "PASS / serves SPA"
curl -sf "http://localhost:$PORT/children/any-id" | grep -q "<div id=\"root\">" && echo "PASS /children/x SPA fallback"
curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/docs" | grep -q 404 && echo "PASS /docs disabled in production"
curl -sI "http://localhost:$PORT/" | grep -qi "content-security-policy" && echo "PASS security headers on SPA"
