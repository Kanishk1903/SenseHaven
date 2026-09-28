#!/usr/bin/env bash
# Warm a sleeping service: GET /healthz until 200, up to 90 s (G18 cold-start tolerance).
# Usage: warm.sh [base-url]  (default: DEVICE_BASE_URL env or http://localhost:8000)
set -u
base="${1:-${DEVICE_BASE_URL:-http://localhost:8000}}"
code="000"

for i in $(seq 1 90); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$base/healthz" || true)"
  if [ "$code" = "200" ]; then
    printf 'warm after %ss: %s/healthz -> 200\n' "$i" "$base"
    exit 0
  fi
  sleep 1
done
printf 'not warm after 90s (last status %s)\n' "$code" >&2
exit 1
