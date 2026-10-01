#!/usr/bin/env python3
"""P6.1 — full-stack system test: real API + virtual child, both scenarios.

Boots the production-mode API, provisions a parent/child, then runs scripts/virtual_child.py
with scenario stress and asserts the dashboard API reflects everything; repeats with calm
and asserts bonus + no alerts. This is the "live dashboard reflects the child" gate.
"""
from __future__ import annotations

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
PORT = 8029
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
    raise SystemExit("server not healthy")


def run_scenario(client: httpx.Client, label: str, scenario: str) -> dict:
    email = f"sys-{label}-{uuid.uuid4().hex[:6]}@example.com"
    client.post(
        f"{BASE}/api/v1/auth/register",
        json={"email": email, "password": "sys-password-123", "display_name": "Sys",
              "timezone": "Asia/Kolkata"},
        headers=REQ,
    ).raise_for_status()
    child = client.post(f"{BASE}/api/v1/children", json={"name": f"Kid {label}"}, headers=REQ).json()
    client.put(f"{BASE}/api/v1/parents/me/pin",
               json={"password": "sys-password-123", "pin": "123456"}, headers=REQ)
    code = client.post(f"{BASE}/api/v1/children/{child['id']}/pairing-code", headers=REQ).json()["code"]

    # the child pairs itself in the background; the parent remote-starts once the device lands
    virtual = subprocess.Popen(
        [str(API / ".venv" / "bin" / "python"), str(ROOT / "scripts" / "virtual_child.py"),
         "--base-url", BASE, "--code", code, "--scenario", scenario, "--fast", "--ticks", "110"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if client.get(f"{BASE}/api/v1/children/{child['id']}/devices").json():
                break
            time.sleep(1)
        else:
            virtual.kill()
            raise SystemExit(f"virtual child ({scenario}) never paired")
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
        print(f"virtual_child ({scenario}) failed:\n", (out or "")[-1500:])
        raise SystemExit(1)
    print(f"vc[{scenario}] tail:", " | ".join((out or "").strip().splitlines()[-2:]))
    return {"child": child, "email": email}


def main() -> int:
    env = dict(
        os.environ,
        ENV="development",
        DATABASE_URL=os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven",
        ),
        APP_SECRET="sys-secret-not-for-production",
        PAIRING_PEPPER="sys-pepper-not-for-production",
        PYTHONPATH=str(API),
    )
    lsof = subprocess.run(["lsof", "-ti", f":{PORT}"], capture_output=True, text=True, check=False)
    for pid in lsof.stdout.split():
        subprocess.run(["kill", "-9", pid], capture_output=True, check=False)
    server = subprocess.Popen(
        [str(API / ".venv" / "bin" / "python"), "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=str(API), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        with httpx.Client(timeout=30) as client:
            wait_health(client)

            # ---- scenario: stress (fresh account per scenario so alerts are attributable) ----
            ctx = run_scenario(client, "stress", "stress")
            child_id = ctx["child"]["id"]
            # debug: dump what the virtual child printed
            # (run_scenario captured stdout; on failure we already print)
            deadline = time.monotonic() + 60
            stress_alerts = []
            while time.monotonic() < deadline:
                alerts = client.get(f"{BASE}/api/v1/alerts").json()
                stress_alerts = [a for a in alerts if a["kind"] == "stress_alert"
                                 and a["child_id"] == child_id]
                if stress_alerts:
                    break
                time.sleep(3)
            assert stress_alerts, "stress scenario produced no stress_alert"
            overview = client.get(
                f"{BASE}/api/v1/children/{child_id}/analytics/overview?range=today").json()
            timeline = client.get(
                f"{BASE}/api/v1/children/{child_id}/analytics/emotion-timeline?date="
                + time.strftime("%Y-%m-%d")).json()
            timeline_points = [b for b in timeline["buckets"] if b["n"] > 0]
            sessions = client.get(
                f"{BASE}/api/v1/children/{child_id}/analytics/sessions?range=today").json()
            assert sessions and sessions[0]["ledger"], "session ledger missing"
            print(json.dumps({"scenario": "stress", "stress_alerts": len(stress_alerts),
                              "timeline_points": len(timeline_points),
                              "overview": {k: overview[k] for k in
                                           ("stress_episodes", "screen_time_s")}}))

            # ---- scenario: calm ----
            ctx2 = run_scenario(client, "calm", "calm")
            child2 = ctx2["child"]["id"]
            deadline = time.monotonic() + 60
            bonus_seen = False
            while time.monotonic() < deadline:
                sessions2 = client.get(
                    f"{BASE}/api/v1/children/{child2}/analytics/sessions?range=today").json()
                if sessions2 and any(e["kind"] == "bonus" for e in sessions2[0]["ledger"]):
                    bonus_seen = True
                    break
                time.sleep(3)
            assert bonus_seen, "calm scenario produced no bonus"
            alerts2 = client.get(f"{BASE}/api/v1/alerts").json()
            kid2_stress = [a for a in alerts2 if a["kind"] == "stress_alert"
                           and a["child_id"] == child2]
            assert not kid2_stress, "calm scenario should not raise stress alerts"
            print(json.dumps({"scenario": "calm", "bonus": True, "stress_alerts": 0}))
        return 0
    finally:
        server.send_signal(signal.SIGINT)
        try:
            server.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    sys.exit(main())
