# GATE 8 — documentation, report, viva, final acceptance (docs/spec/03-phases-and-gates-lean.md §GATE 8).
# The clean-clone row is the CI job (final.yml) — locally we run the full gate chain via
# `make gate-all` semantics; here we assert docs, results determinism, checklist, tags.
set -u
cd "$(dirname "$0")/.."

check "docs exist" "python3 scripts/check_gate8_docs.py"
check "results" "api/.venv/bin/python scripts/collect_results.py >/dev/null && cp docs/report/results.md /tmp/r1.md && api/.venv/bin/python scripts/collect_results.py >/dev/null && diff /tmp/r1.md docs/report/results.md && echo 'results deterministic'"
check "checklist" "python3 scripts/check_gate8_docs.py checklist"
check "known issues" "python3 scripts/check_gate6_docs.py known"
check "tags" "git tag -l | grep -q phase-0-verified && git tag -l | grep -q phase-5-verified && echo 'phase tags present'"
check "regression: previous gate" "bash scripts/gate.sh 7"
