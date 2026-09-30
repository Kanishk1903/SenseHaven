#!/usr/bin/env bash
# Gate-4 helper: run vitest and assert the passed-test count is >= 40.
set -uo pipefail
cd "$(dirname "$0")/../web"

npm run test -- run > /tmp/sh-vitest.out 2>&1
vitest_exit=$?
passed="$(grep -E '^ *Tests ' /tmp/sh-vitest.out | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+')"
if [ -z "$passed" ]; then
  tail -n 20 /tmp/sh-vitest.out
  echo "check_unit_count: could not parse vitest output"
  exit 1
fi
if [ "$passed" -lt 40 ]; then
  tail -n 20 /tmp/sh-vitest.out
  echo "check_unit_count: only $passed tests passed (bar: >= 40)"
  exit 1
fi
echo "unit tests: $passed passed (>= 40)"
exit "$vitest_exit"
