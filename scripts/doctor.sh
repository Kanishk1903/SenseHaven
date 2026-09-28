#!/usr/bin/env bash
# Environment doctor (P0.2). Idempotent, read-only. FAIL (exit 1) only for:
# python >= 3.11, node >= 20, docker + compose, git. Everything else is WARN.
set -u
fail=0

pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; }
fail_() { printf 'FAIL  %s\n' "$*"; fail=1; }

# python >= 3.11 (required)
if command -v python3 >/dev/null 2>&1; then
  v="$(python3 -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])' 2>/dev/null || echo '?')"
  if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    pass "python3 ${v} (>= 3.11)"
  else
    fail_ "python3 >= 3.11 required, found ${v}"
  fi
else
  fail_ "python3 not found"
fi

# node >= 20 (required)
if command -v node >/dev/null 2>&1; then
  v="$(node -p 'process.versions.node' 2>/dev/null || echo '?')"
  major="$(printf '%s' "$v" | cut -d. -f1)"
  if [ "${major:-0}" -ge 20 ] 2>/dev/null; then
    pass "node ${v} (>= 20)"
  else
    fail_ "node >= 20 required, found ${v}"
  fi
else
  fail_ "node not found"
fi

# npm (warn only)
if command -v npm >/dev/null 2>&1; then
  pass "npm $(npm --version 2>/dev/null)"
else
  warn "npm not found (needed from Phase 4)"
fi

# docker + compose (required)
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    pass "docker $(docker --version 2>/dev/null | cut -d, -f1) — daemon up"
    if docker compose version >/dev/null 2>&1; then
      pass "docker compose $(docker compose version --short 2>/dev/null)"
    else
      fail_ "docker compose plugin not available"
    fi
  else
    fail_ "docker daemon not reachable (run: colima start — or open Docker Desktop)"
  fi
else
  fail_ "docker not found"
fi

# git (required)
if command -v git >/dev/null 2>&1; then
  pass "git $(git --version 2>/dev/null | awk '{print $3}')"
else
  fail_ "git not found"
fi

# java >= 17 (warn; needed for Android builds from Phase 5)
if command -v java >/dev/null 2>&1; then
  v="$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)\..*"/\1/')"
  if [ "${v:-0}" -ge 17 ] 2>/dev/null; then
    pass "java ${v} (>= 17)"
  else
    warn "java >= 17 recommended for Android builds, found: $(java -version 2>&1 | head -1)"
  fi
else
  warn "java not found (needed for Android builds from Phase 5)"
fi

# gh auth (warn; human step H1)
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    pass "gh authenticated"
  else
    warn "gh not authenticated (SETUP_REQUIRED.md H1)"
  fi
else
  warn "gh not found (SETUP_REQUIRED.md H1)"
fi

# disk >= 10 GB (warn)
avail_kb="$(df -k . 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$avail_kb" ] && [ "$avail_kb" -ge $((10 * 1024 * 1024)) ] 2>/dev/null; then
  pass "disk free $((avail_kb / 1024 / 1024)) GB (>= 10 GB)"
else
  warn "disk free below 10 GB (${avail_kb:-unknown} KB free)"
fi

# adb (warn)
if command -v adb >/dev/null 2>&1; then
  pass "adb present"
else
  warn "adb not found (Android e2e from Phase 5)"
fi

# Android SDK (warn)
if [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}" ]; then
  pass "Android SDK at ${ANDROID_HOME}"
elif [ -d "$HOME/Library/Android/sdk" ]; then
  pass "Android SDK at ~/Library/Android/sdk"
else
  warn "Android SDK not found (ANDROID_HOME unset) — needed from Phase 5; GitHub Actions is the build authority"
fi

if [ "$fail" -eq 0 ]; then
  printf 'doctor: environment OK\n'
  exit 0
fi
printf 'doctor: environment has FAIL items (see above)\n'
exit 1
