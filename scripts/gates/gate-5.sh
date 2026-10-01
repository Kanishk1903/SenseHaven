#!/usr/bin/env bash
# GATE 5 — child Android app (docs/spec/03-phases-and-gates-lean.md §GATE 5).
# e2e/screenshots rows need an emulator: BLOCKED_ON_EMU when none can run (per P5.9 fallback).
set -u
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
EMU_OK=0
if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -qw device; then
  EMU_OK=1
fi

check "unit" "cd android && JAVA_HOME=$JAVA_HOME ./gradlew testDebugUnitTest --no-daemon -x fetchModels"
check "lint" "cd android && JAVA_HOME=$JAVA_HOME ./gradlew lintDebug --no-daemon -x fetchModels"
check "build" "cd android && JAVA_HOME=$JAVA_HOME ./gradlew assembleDebug --no-daemon -x fetchModels && ls -la app/build/outputs/apk/debug/app-debug.apk"
check "static checks" "bash scripts/check_android.sh"

if [ "$EMU_OK" = "1" ]; then
  check "e2e" "bash scripts/e2e_android.sh"
  check "screenshots" "ls verification/screenshots/android/*.png >/dev/null 2>&1"
elif [ -x "$ANDROID_HOME/emulator/emulator" ] && "$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null | grep -q .; then
  # an AVD exists but no live device: e2e_android.sh boots it itself
  check "e2e" "bash scripts/e2e_android.sh"
  check "screenshots" "ls verification/screenshots/android/*.png >/dev/null 2>&1"
else
  blocked "EMULATOR" "e2e" "no emulator attachable — recorded PASS in phase-5.json; re-run with an emulator or in CI (P5.9 fallback)"
  blocked "EMULATOR" "screenshots" "needs a running emulator or device (8 committed screenshots exist)"
fi

check "privacy static" "grep -rn 'Bitmap.compress' android/app/src/main/java/app/senseheaven/child/services/ --include='*.kt' >/dev/null 2>&1 && exit 1 || echo 'no frame persistence'"
check "regression: previous gate" "bash scripts/gate.sh 4"
