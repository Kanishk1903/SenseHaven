#!/usr/bin/env bash
# Gate runner (docs/spec/03-phases-and-gates-lean.md §X "Gate runner contract").
# Usage: scripts/gate.sh N
#
# Sources scripts/gates/gate-N.sh, which may call:
#   check "<name>" "<shell command>"   -> PASS/FAIL line; last 40 lines captured on failure
#   blocked "<H-id>" "<name>" "<why>"  -> human-blocked check (verdict BLOCKED_ON_<H-id>)
# Afterwards writes verification/phase-N.json (via scripts/_gate_json.py, which validates the
# file it wrote) and exits 1 iff any check failed. A check whose command prints a fake success
# is still a FAIL if the command itself exits non-zero — never edit a gate to loosen it.
set -u
cd "$(dirname "$0")/.."

N="${1:-}"
if [ -z "$N" ] || ! printf '%s' "$N" | grep -qE '^[0-9]+$'; then
  echo "usage: scripts/gate.sh N" >&2
  exit 2
fi
GATE="scripts/gates/gate-$N.sh"
if [ ! -f "$GATE" ]; then
  echo "gate-$N: gate script not found: $GATE" >&2
  exit 2
fi

mkdir -p verification
RESULTS="$(mktemp)"
trap 'rm -f "$RESULTS"' EXIT

check() {
  local name="$1"; shift
  local cmd="$*"
  local out rc safe
  out="$(mktemp)"
  if bash -c "$cmd" >"$out" 2>&1; then rc=0; else rc=$?; fi
  if [ "$rc" -eq 0 ]; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s (exit %s) — last lines:\n' "$name" "$rc"
    tail -n 40 "$out" | sed 's/^/    /'
    safe="$(printf '%s' "$name" | tr -c 'A-Za-z0-9_.-' '_')"
    tail -n 40 "$out" > "verification/fail-phase-$N-$safe.log"
  fi
  # TSV row: check \t name \t cmd \t exit
  printf 'check\t%s\t%s\t%s\n' "$name" "$cmd" "$rc" >> "$RESULTS"
  rm -f "$out"
  return 0
}

blocked() {
  # blocked <H-id> <name> <why> — records a human-blocked check; does not fail the gate.
  local hid="$1" name="$2" why="$3"
  printf 'BLOCKED_ON_%s %s — %s\n' "$hid" "$name" "$why"
  printf 'blocked\t%s\t%s\t%s\n' "$name" "$hid" "$why" >> "$RESULTS"
}

# shellcheck source=/dev/null
source "$GATE"

python3 scripts/_gate_json.py "$N" "$RESULTS"
