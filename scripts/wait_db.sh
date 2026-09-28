#!/usr/bin/env bash
# Wait until the compose `db` service answers pg_isready. Usage: wait_db.sh [seconds]
set -u
cd "$(dirname "$0")/.."
secs="${1:-60}"

for i in $(seq 1 "$secs"); do
  if docker compose exec -T db pg_isready -U senseheaven -d senseheaven >/dev/null 2>&1; then
    printf 'db ready after %ss\n' "$i"
    exit 0
  fi
  sleep 1
done
printf 'db not ready after %ss\n' "$secs" >&2
exit 1
