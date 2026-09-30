#!/usr/bin/env python3
"""Gate-2 integration check (P2.8): boot the real API, pair a virtual child, run the stress
scenario, and assert the parent API shows the alert, emotion buckets and session snapshot.

Also asserts the server log has no Traceback/ERROR lines (gate-2 "logs" row).
Run from the repo root:  api/.venv/bin/python scripts/check_virtual_child.py
"""
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api"
VENV_PY = API / ".venv" / "bin" / "python"
PORT = 8017
BASE = f"http://localhost:{PORT}"
REQ = {"X-Requested-With": "senseheaven"}


def wait_health(client: httpx.Client, seconds: int = 90) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if client.get(f"{BASE}/healthz").status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(1)
    raise SystemExit("server did not become healthy in time")


def main() -> int:
    env = dict(
        os.environ,
        ENV="development",
        DATABASE_URL=os.environ.get(
            "DATABASE_URL", "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven"
        ),
        APP_SECRET="gate-only-secret-not-for-production",
        PAIRING_PEPPER="gate-only-pepper-not-for-production",
        PYTHONPATH=str(API),
    )
    server = subprocess.Popen(
        [str(VENV_PY), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=str(API), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    server_log: list[str] = []
    try:
        with httpx.Client(timeout=30.0) as client:
            wait_health(client)

            email = f"gate-{uuid.uuid4().hex[:8]}@example.com"  # .test TLD is rejected by email-validator
            response = client.post(
                f"{BASE}/api/v1/auth/register",
                json={"email": email, "password": "gate-password-123", "display_name": "Gate",
                      "timezone": "Asia/Kolkata"},
                headers=REQ,
            )
            response.raise_for_status()

            child = client.post(f"{BASE}/api/v1/children", json={"name": "Virtual Kid"}, headers=REQ).json()
            client.put(
                f"{BASE}/api/v1/parents/me/pin",
                json={"password": "gate-password-123", "pin": "123456"}, headers=REQ,
            )
            code = client.post(f"{BASE}/api/v1/children/{child['id']}/pairing-code", headers=REQ).json()["code"]

            # The virtual child pairs itself, then obeys the remote start command.
            virtual = subprocess.Popen(
                [str(VENV_PY), str(ROOT / "scripts" / "virtual_child.py"),
                 "--base-url", BASE, "--code", code, "--scenario", "stress", "--fast", "--ticks", "40"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            try:
                deadline = time.monotonic() + 60
                devices = []
                while time.monotonic() < deadline:
                    devices = client.get(f"{BASE}/api/v1/children/{child['id']}/devices").json()
                    if devices:
                        break
                    time.sleep(1)
                assert devices, "virtual child did not pair within 60 s"

                # Remote start once the device exists: it picks up start_session on its next sync.
                started = client.post(
                    f"{BASE}/api/v1/children/{child['id']}/sessions",
                    json={"duration_min": 30}, headers=REQ,
                )
                started.raise_for_status()

                out, _ = virtual.communicate(timeout=180)
            except Exception:
                virtual.kill()
                raise
            if virtual.returncode != 0:
                print("virtual_child failed:\n", (out or "")[-2000:])
                return 1

            alerts = client.get(f"{BASE}/api/v1/alerts").json()
            stress_alerts = [a for a in alerts if a["kind"] == "stress_alert"]
            assert stress_alerts, f"expected a stress_alert alert, got kinds: {[a['kind'] for a in alerts]}"

            overview = client.get(f"{BASE}/api/v1/children/{child['id']}/analytics/overview?range=today").json()
            assert overview["stress_episodes"] >= 1, overview

            timeline = client.get(
                f"{BASE}/api/v1/children/{child['id']}/analytics/emotion-timeline?date="
                + time.strftime("%Y-%m-%d")
            ).json()
            non_empty = [b for b in timeline["buckets"] if b["n"] > 0]
            assert non_empty, "timeline has no emotion buckets"

            sessions = client.get(f"{BASE}/api/v1/children/{child['id']}/analytics/sessions?range=today").json()
            assert sessions and sessions[0]["ledger"], "session snapshot with ledger missing"

            print(json.dumps({
                "check": "virtual_child", "stress_alerts": len(stress_alerts),
                "timeline_points": len(non_empty), "sessions": len(sessions),
                "overview": {k: overview[k] for k in ("stress_episodes", "screen_time_s", "sessions_count")},
            }))
        return 0
    except AssertionError as error:
        print(f"virtual_child check FAILED: {error}")
        return 1
    finally:
        server.send_signal(signal.SIGINT)
        try:
            out, _ = server.communicate(timeout=15)
            server_log = out.splitlines() if out else []
        except subprocess.TimeoutExpired:
            server.kill()
        bad = [line for line in server_log if "Traceback" in line or " ERROR " in line or line.startswith("ERROR")]
        if bad:
            print("server log contains errors:")
            print("\n".join(bad[:10]))
            sys.exit(1)


if __name__ == "__main__":
    raise SystemExit(main())
