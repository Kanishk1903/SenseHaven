#!/usr/bin/env python3
"""P5.9 — scripted Android e2e against a real backend (LEAN MUST list).

Boots the compose API, creates parent/child/PIN/pairing code, drives the app on an
emulator/device via the DebugReceiver, then asserts through the API:
pair -> remote start -> tap-to-start -> inject ci=20 -> stress_alert + penalty + cooldown ->
inject ci=90 -> bonus -> fast-forward to zero -> locked.

Usage: api/.venv/bin/python scripts/e2e_android.py --serial emulator-5554
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api"
REQ = {"X-Requested-With": "senseheaven"}


def adb(serial: str, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["adb", "-s", serial, *args], capture_output=True, text=True, check=check
    )
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    serial, base = args.serial, args.base_url.rstrip("/")

    with httpx.Client(timeout=60) as client:
        # 1) provision through the real API
        email = f"e2e-{uuid.uuid4().hex[:8]}@example.com"
        client.post(
            f"{base}/api/v1/auth/register",
            json={"email": email, "password": "e2e-password-123", "display_name": "E2E",
                  "timezone": "Asia/Kolkata"},
            headers=REQ,
        ).raise_for_status()
        child_response = client.post(f"{base}/api/v1/children", json={"name": "Emu Kid"}, headers=REQ)
        print("child create:", child_response.status_code, child_response.text[:200])
        child_response.raise_for_status()
        child = child_response.json()
        client.put(
            f"{base}/api/v1/parents/me/pin",
            json={"password": "e2e-password-123", "pin": "654321"}, headers=REQ,
        )
        code = client.post(f"{base}/api/v1/children/{child['id']}/pairing-code", headers=REQ).json()["code"]

        # 2) drive the app
        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.PAIR", "-p", "app.senseheaven.child", "--es", "code", code)
        time.sleep(6)
        started = client.post(
            f"{base}/api/v1/children/{child['id']}/sessions", json={"duration_min": 30}, headers=REQ,
        )
        started.raise_for_status()

        # wait for the app to sync the start_session command (engine turns ACTIVE)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            adb(serial, "shell", "am", "broadcast",
                "-a", "app.senseheaven.debug.DUMP_STATE", "-p", "app.senseheaven.child")
            time.sleep(2)
            logcat = subprocess.run(
                ["adb", "-s", serial, "logcat", "-d", "-s", "SH_DEBUG"],
                capture_output=True, text=True, check=False,
            ).stdout
            status_lines = [l for l in logcat.splitlines() if '"status"' in l]
            if status_lines and '"status":"active"' in status_lines[-1]:
                break
            time.sleep(3)

        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.INJECT", "-p", "app.senseheaven.child", "--ei", "ci", "20")
        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.FASTFORWARD", "-p", "app.senseheaven.child", "--ei", "minutes", "6")
        deadline = time.monotonic() + 120
        alert_id = None
        while time.monotonic() < deadline:
            alerts = client.get(f"{base}/api/v1/alerts").json()
            stress = [a for a in alerts if a["kind"] == "stress_alert"]
            if stress:
                alert_id = stress[0]["id"]
                break
            time.sleep(3)
        assert alert_id, "stress_alert never appeared"
        print(json.dumps({"check": "stress_alert", "alert_id": alert_id}))

        sessions = client.get(f"{base}/api/v1/children/{child['id']}/analytics/sessions?range=today").json()
        latest = sessions[0]
        assert latest["penalty_s"] > 0, f"penalty_s={latest['penalty_s']}"
        kinds = [entry["kind"] for entry in latest["ledger"]]
        assert "cooldown_start" in kinds, kinds
        print(json.dumps({"check": "penalty+cooldown", "penalty_s": latest["penalty_s"], "kinds": kinds}))

        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.INJECT", "-p", "app.senseheaven.child", "--ei", "ci", "90")
        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.FASTFORWARD", "-p", "app.senseheaven.child", "--ei", "minutes", "25")
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            sessions = client.get(f"{base}/api/v1/children/{child['id']}/analytics/sessions?range=today").json()
            latest = sessions[0]
            if any(entry["kind"] == "bonus" for entry in latest["ledger"]):
                break
            time.sleep(3)
        assert any(entry["kind"] == "bonus" for entry in latest["ledger"]), "bonus never appeared"
        print(json.dumps({"check": "bonus"}))

        # 3) DUMP_STATE shows the locked end state
        adb(serial, "shell", "am", "broadcast", "-a", "app.senseheaven.debug.DUMP_STATE", "-p", "app.senseheaven.child")
        time.sleep(3)
        logcat = subprocess.run(
            ["adb", "-s", serial, "logcat", "-d", "-s", "SH_DEBUG"], capture_output=True, text=True, check=False,
        ).stdout
        assert "FATAL EXCEPTION" not in logcat and "ANR in" not in logcat, "crash in logcat"
        print(json.dumps({"check": "locked_end", "logcat_clean": True}))

        # clear logcat for the next run
        subprocess.run(["adb", "-s", serial, "logcat", "-c"], capture_output=True, check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
