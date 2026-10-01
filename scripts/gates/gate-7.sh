# GATE 7 — deploy (docs/spec/03-phases-and-gates-lean.md §GATE 7).
# Live rows (live smoke, GitHub Release) are BLOCKED_ON_H2/H1 until the human steps land;
# the container and no-dev-leak checks run for real here.
set -u
cd "$(dirname "$0")/.."

check "docker" "bash scripts/check_docker.sh"
check "no dev leaks" "bash scripts/check_no_dev_leaks.sh"
LIVE_OK=0
if [ -n "${SMOKE_BASE_URL:-}" ]; then LIVE_OK=1; fi
if [ "$LIVE_OK" = "1" ]; then
  check "live smoke" "api/.venv/bin/python scripts/smoke_prod.py --base-url $SMOKE_BASE_URL"
  check "release" "gh release view --json assets -q '.assets[].name' | grep -q apk"
else
  blocked "H2" "live smoke" "no live URL — deploy via Render (SETUP_REQUIRED.md H2+H2b), then SMOKE_BASE_URL=https://<url> make gate-7"
  blocked "H1" "release" "no GitHub auth — push a v* tag with gh auth (H1); android.yml release job publishes the APK + apk.json"
fi
check "regression: previous gate" "bash scripts/gate.sh 6"
