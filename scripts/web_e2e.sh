#!/usr/bin/env bash
# Playwright e2e (P4.7): builds the SPA, boots the API in production mode serving it,
# seeds demo data, then runs the Playwright suite (3 e2e flows + axe + screenshots).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== building web =="
(cd web && npm run build)

export ENV=production
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven}"
export APP_SECRET="${APP_SECRET:-e2e-only-secret-not-for-production}"
export PAIRING_PEPPER="${PAIRING_PEPPER:-e2e-only-pepper-not-for-production}"

PORT="${E2E_PORT:-8021}"
echo "== clearing stale listeners on $PORT =="
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true

echo "== starting API (production, port $PORT) =="
(cd api && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" > /tmp/sh-e2e-api.log 2>&1 & echo $! > /tmp/sh-e2e-api.pid)
API_PID="$(cat /tmp/sh-e2e-api.pid)"
cleanup() { kill "$API_PID" 2>/dev/null || true; sleep 1; lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true; }
trap cleanup EXIT

bash scripts/warm.sh "http://localhost:$PORT"

echo "== seeding demo data =="
api/.venv/bin/python scripts/seed_demo.py | grep -v WARNING || true

echo "== running playwright =="
cd web
export E2E_BASE_URL="http://localhost:$PORT"
npx playwright install chromium --with-deps >/dev/null 2>&1 || npx playwright install chromium
npx playwright test
