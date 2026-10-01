#!/usr/bin/env bash
# Static checks for gate-5: permissions allowlist, privacy greps, cleartext, APK size.
set -uo pipefail
cd "$(dirname "$0")/.."
FAILED=0

APK="android/app/build/outputs/apk/debug/app-debug.apk"
AAPT2="/opt/homebrew/share/android-commandlinetools/build-tools/34.0.0/aapt2"
[ -x "$AAPT2" ] || AAPT2="aapt2"

# 1) permissions ⊆ allowlist
ALLOWED="android.permission.INTERNET android.permission.ACCESS_NETWORK_STATE android.permission.CAMERA android.permission.POST_NOTIFICATIONS android.permission.FOREGROUND_SERVICE android.permission.FOREGROUND_SERVICE_CAMERA android.permission.PACKAGE_USAGE_STATS android.permission.SYSTEM_ALERT_WINDOW android.permission.RECEIVE_BOOT_COMPLETED android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS android.permission.VIBRATE android.permission.WAKE_LOCK app.senseheaven.child.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
"$AAPT2" dump badging "$APK" | grep "^uses-permission" | sed -E "s/.*name='([^']+)'.*/\1/" | while read -r perm; do
  echo "$ALLOWED" | grep -q "$perm" || { echo "UNEXPECTED PERMISSION: $perm"; exit 1; }
done || FAILED=1
echo "permissions ⊆ allowlist: OK"

# 2) no QUERY_ALL_PACKAGES, no ACCESSIBILITY binding
"$AAPT2" dump badging "$APK" | grep -q "QUERY_ALL_PACKAGES" && { echo "QUERY_ALL_PACKAGES present"; FAILED=1; } || true
grep -rq "AccessibilityService" android/app/src/main --include="*.kt" --include="*.xml" && { echo "accessibility binding found"; FAILED=1; } || true
echo "no QUERY_ALL_PACKAGES / accessibility: OK"

# 3) privacy static: no bitmap leaves the device, no camera-dir writes
if grep -rn "Bitmap.compress\|FileOutputStream\|openFileOutput" android/app/src/main/java/app/senseheaven/child/services/ --include="*.kt" 2>/dev/null | grep -v "^Binary"; then
  echo "privacy static: bitmap/file writes inside services package"; FAILED=1
else
  echo "privacy static: no frame persistence in services: OK"
fi
if grep -rn "Log\." android/app/src/main/java/app/senseheaven/child/services/GuardService.kt | grep -iE "pin|token"; then
  echo "privacy static: PIN/token logging found"; FAILED=1
else
  echo "privacy static: no token/PIN logging: OK"
fi

# 4) release manifest: no cleartext
grep -q "usesCleartextTraffic=\"true\"" android/app/src/main/AndroidManifest.xml && { echo "cleartext in MAIN manifest"; FAILED=1; } || true
grep -q "usesCleartextTraffic=\"true\"" android/app/src/debug/AndroidManifest.xml && echo "cleartext debug overlay only: OK"

# 5) minSdk 26 + APK size
"$AAPT2" dump badging "$APK" | grep -E "^sdkVersion:'26'" > /dev/null && echo "minSdk 26: OK" || { echo "minSdk != 26"; FAILED=1; }
SIZE_MB=$(( $(stat -f %z "$APK") / 1024 / 1024 ))
if [ "$SIZE_MB" -le 120 ]; then echo "APK size ${SIZE_MB} MB <= 120 MB: OK"; else echo "APK ${SIZE_MB} MB too big"; FAILED=1; fi

exit $FAILED
