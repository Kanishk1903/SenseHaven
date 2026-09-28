#!/usr/bin/env bash
# G4 — no placeholder markers in the repo. Exit 1 on hits.
# Excluded: docs/spec (the spec text itself lists the markers), verification/ (evidence logs
# legitimately quote failing output that can contain marker strings), dependencies, build
# output, generated assets, lockfiles, and this script (it contains the marker strings).
set -u
cd "$(dirname "$0")/.."

hits="$(grep -RInE \
  --binary-files=without-match \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=venv \
  --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=.gradle \
  --exclude-dir=__pycache__ --exclude-dir=.pytest_cache --exclude-dir=.ruff_cache \
  --exclude-dir=spec --exclude-dir=generated --exclude-dir=data \
  --exclude-dir=verification \
  --exclude=no_placeholders.sh --exclude='*.lock' --exclude='*.task' \
  --exclude='package-lock.json' \
  -e 'TODO' -e 'FIXME' -e 'NotImplemented' -e 'lorem ipsum' -e 'pass  # later' \
  . 2>/dev/null || true)"

if [ -n "$hits" ]; then
  printf '%s\n' "$hits"
  printf 'no_placeholders: FAIL (hits above)\n'
  exit 1
fi
printf 'no_placeholders: clean\n'
