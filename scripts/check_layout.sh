#!/usr/bin/env bash
# Layout check for gate-0: every path in the P0.1 repo tree must exist.
set -u
cd "$(dirname "$0")/.."

missing=0
require() { if [ ! -e "$1" ]; then printf 'missing: %s\n' "$1"; missing=1; fi; }

# Root files (P0.1)
for f in \
  README.md Makefile Dockerfile docker-compose.yml render.yaml .env.example .editorconfig .gitignore \
  PROGRESS.md DECISIONS.md KNOWN_ISSUES.md SETUP_REQUIRED.md GATES_CHANGELOG.md \
  .github/workflows/ci.yml .github/workflows/android.yml \
  scripts/doctor.sh scripts/gate.sh scripts/no_placeholders.sh scripts/wait_db.sh scripts/warm.sh \
  docs/architecture.md docs/DEPLOYMENT.md docs/DEVICE_ACCEPTANCE_TEST.md docs/DEMO_SCRIPT.md docs/viva_prep.md docs/future_work.md \
  docs/spec/01-master-rules-architecture-contracts.md docs/spec/02-design-system-ux.md \
  docs/spec/lean-edition-overrides.md docs/spec/03-phases-and-gates-lean.md; do
  require "$f"
done

# Later-phase scripts named in the P0.1 tree — honest stubs at Phase 0 (DECISIONS.md D-13)
for f in scripts/gen_tokens.py scripts/check_contrast.py scripts/seed_demo.py \
         scripts/virtual_child.py scripts/smoke_prod.py; do
  require "$f"
done

# Directories (P0.1)
for d in contracts design api web android ml verification docs/spec docs/report scripts scripts/gates; do
  if [ ! -d "$d" ]; then printf 'missing dir: %s\n' "$d"; missing=1; fi
done

if [ "$missing" -eq 0 ]; then
  printf 'layout OK: all P0.1 paths exist\n'
fi
exit "$missing"
