# GATE 6 — integration, edge cases, device acceptance (docs/spec/03-phases-and-gates-lean.md §GATE 6).
check "system test" "api/.venv/bin/python scripts/system_test.py"
check "edge coverage" "python3 scripts/check_gate6_docs.py edge"
check "acceptance doc" "python3 scripts/check_gate6_docs.py acceptance"
check "known issues" "python3 scripts/check_gate6_docs.py known"
check "regression: previous gate" "bash scripts/gate.sh 5"
