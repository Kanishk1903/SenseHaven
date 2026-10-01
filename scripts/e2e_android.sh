#!/usr/bin/env bash
# P5.9: scripted Android e2e (boot API -> provision -> drive emulator via debug hooks -> assert).
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

SERIAL="${1:-}"
# validate the requested serial is actually attached; otherwise self-heal
if [ -n "$SERIAL" ] && ! adb devices | grep -qw "$SERIAL"; then
  echo "e2e_android: requested serial '$SERIAL' not attached — falling back to autodetect"
  SERIAL=""
fi
if [ -z "$SERIAL" ]; then
  SERIAL="$(adb devices | grep -w device | head -1 | awk '{print $1}')"
fi
if [ -z "$SERIAL" ]; then
  # self-heal: boot the headless AVD (the emulator can die under long chained gate runs)
  echo "e2e_android: no device attached — booting headless AVD"
  if ! "$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null | grep -q sh_test; then
    echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n sh_test \
      -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_5 || {
      echo "e2e_android: cannot create AVD" >&2; exit 1; }
  fi
  nohup "$ANDROID_HOME/emulator/emulator" -avd sh_test -no-window -no-audio -no-boot-anim \
    -gpu swiftshader_indirect -no-snapshot -memory 3072 -no-metrics > /tmp/sh-e2e-emu.log 2>&1 &
  for _ in $(seq 1 120); do
    SERIAL="$(adb devices | grep -w device | head -1 | awk '{print $1}')"
    [ -n "$SERIAL" ] && [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 3
  done
  sleep 10
fi
if [ -z "$SERIAL" ]; then
  echo "e2e_android: emulator did not boot" >&2
  exit 1
fi
echo "== e2e on $SERIAL =="

# fresh build + install
(cd android && JAVA_HOME=$JAVA_HOME ./gradlew assembleDebug --no-daemon -x fetchModels)
adb -s "$SERIAL" install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s "$SERIAL" logcat -c
adb -s "$SERIAL" shell pm grant app.senseheaven.child android.permission.CAMERA 2>/dev/null || true
adb -s "$SERIAL" shell pm grant app.senseheaven.child android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb -s "$SERIAL" shell appops set app.senseheaven.child GET_USAGE_STATS allow
adb -s "$SERIAL" shell appops set app.senseheaven.child SYSTEM_ALERT_WINDOW allow
adb -s "$SERIAL" shell svc power stayon true
# launch once so the app leaves the stopped state (fresh installs drop broadcasts)
adb -s "$SERIAL" shell am start -n app.senseheaven.child/.ui.MainActivity >/dev/null
sleep 4

# kill any stale API, then boot fresh
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
if true; then
  docker compose up -d db
  bash scripts/wait_db.sh 60
  export ENV=development  # Secure cookies only travel over https; e2e runs on http
  export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven}"
  export APP_SECRET="${APP_SECRET:-e2e-only-secret-not-for-production}"
  export PAIRING_PEPPER="${PAIRING_PEPPER:-e2e-only-pepper-not-for-production}"
  (cd api && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/sh-android-e2e-api.log 2>&1 & echo $! > /tmp/sh-android-e2e-api.pid)
  trap 'kill $(cat /tmp/sh-android-e2e-api.pid) 2>/dev/null || true' EXIT
  bash scripts/warm.sh http://localhost:8000
fi

# the emulator reaches the host loopback via 10.0.2.2
# the host-side assertions use localhost; the app itself reaches the host via 10.0.2.2
api/.venv/bin/python scripts/e2e_android.py --serial "$SERIAL" --base-url http://localhost:8000
echo "e2e_android: PASS"
