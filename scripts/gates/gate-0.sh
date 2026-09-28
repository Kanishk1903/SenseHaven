# GATE 0 — scaffold, tooling, CI (docs/spec/03-phases-and-gates-lean.md §GATE 0).
#
# Note on the "runner" check: the spec's row validates that `scripts/gate.sh 0` writes a valid
# verification/phase-0.json. Running gate 0 from inside gate 0 would recurse forever, so the
# check validates the JSON writer directly (--selftest); gate.sh additionally validates the
# real phase-0.json it writes after this gate file returns.

check "layout" "bash scripts/check_layout.sh"
check "doctor" "bash scripts/doctor.sh"
check "db" "docker compose up -d db && bash scripts/wait_db.sh 60"
check "placeholders" "bash scripts/no_placeholders.sh"
check "gitignore" "git check-ignore -q .env && git check-ignore -q ml/data/x && git check-ignore -q node_modules/x && echo '.env, ml/data/*, node_modules/* are all ignored'"
check "runner" "python3 scripts/_gate_json.py --selftest"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  check "ci" "gh run list --workflow=ci.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -qx success"
else
  blocked "H1" "ci" "gh not authenticated or no origin remote — complete H1 (gh auth login + push), then re-run make gate-0"
fi
