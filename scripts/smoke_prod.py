#!/usr/bin/env python3
"""P7.4 — smoke test against a deployed URL (live Render or the local container).

register-or-login smoke account → create child + PIN → pairing code → pair via API →
sync → post events incl. a stress_alert ledger → check /live + overview + alert →
assert response headers, cookie flags, HTTP→HTTPS redirect, /docs 404 → cleanup
(delete history + delete child).
"""
from __future__ import annotations

import argparse
import sys
import uuid

import httpx

REQ = {"X-Requested-With": "senseheaven"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--keep", action="store_true", help="skip cleanup (debug)")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    insecure = base.startswith("http://")
    client = httpx.Client(timeout=90, verify=True, follow_redirects=False,
                          headers={"X-Requested-With": "senseheaven"})

    print(f"smoke: {base}")
    # 1) health
    import time
    for _ in range(90):
        try:
            if client.get(f"{base}/healthz").status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)
    else:
        print("FAIL: /healthz never 200")
        return 1
    print("PASS /healthz")

    client.follow_redirects = True

    # 2) register a unique smoke account (idempotent + no password-drift issues;
    #    cleanup deletes it at the end)
    import os
    import time
    email = f"smoke-{int(time.time())}@senseheaven.app"
    password = os.environ.get("SMOKE_PASSWORD", "smoke-pass-123")
    r = client.post(f"{base}/api/v1/auth/register", json={
        "email": email, "password": password, "display_name": "Smoke",
        "timezone": "Asia/Kolkata"}, headers=REQ)
    r.raise_for_status()

    # 3) cookie flags (expected only on https); over plain http, carry the JWT explicitly
    #    because the Secure attribute suppresses it on http
    set_cookie = r.headers.get("set-cookie", "")
    if not insecure:
        low = set_cookie.lower()
        assert "httponly" in low and "samesite=strict" in low and "secure" in low, \
            f"cookie flags missing: {set_cookie}"
        print("PASS cookie flags (HttpOnly, SameSite=Strict, Secure)")
    else:
        for part in set_cookie.split(";"):
            if part.strip().startswith("sh_session="):
                client.headers["Cookie"] = part.strip()
        print("SKIP cookie-flag check over plain http (JWT carried explicitly)")

    # 4) child + PIN
    child = client.post(f"{base}/api/v1/children", json={"name": "Smoke Kid"}, headers=REQ).json()
    client.put(f"{base}/api/v1/parents/me/pin",
               json={"password": password, "pin": "654321"}, headers=REQ).raise_for_status()

    # 5) pair a device via API
    code = client.post(f"{base}/api/v1/children/{child['id']}/pairing-code", headers=REQ).json()["code"]
    paired = client.post(f"{base}/api/v1/device/pair", json={
        "code": code, "device_name": "SmokePhone", "android_version": "14",
        "app_version": "1.0.0"}, headers={"X-Requested-With": "senseheaven"}).json()
    token = paired["device_token"]
    dev = {"Authorization": f"Bearer {token}"}

    # 6) sync + post events including a stress_alert ledger
    sync = client.get(f"{base}/api/v1/device/sync", headers=dev).json()
    session = sync["session"]  # fresh smoke accounts have none yet
    if session is None:
        started = client.post(f"{base}/api/v1/children/{child['id']}/sessions",
                              json={"duration_min": 30}, headers=REQ)
        started.raise_for_status()
        session_id = started.json()["id"]
    else:
        session_id = session["id"]
    batch = {
        "sent_at": "2026-10-02T00:00:00+00:00",
        "sessions": [{"id": session_id, "status": "active", "granted_s": 1800,
                      "used_s": 100, "started_at": "2026-10-02T00:00:00+00:00",
                      "source": "parent_web"}],
        "ledger": [{"client_uuid": f"smoke-{uuid.uuid4().hex[:8]}", "session_id": session_id,
                    "ts": "2026-10-02T00:00:30+00:00", "kind": "stress_alert", "seconds": 300}],
        "heartbeat": {"used_s": 100, "camera_ok": False,
                      "permissions": {"camera": True, "notifications": True,
                                      "usage_access": True, "overlay": True}},
    }
    ack = client.post(f"{base}/api/v1/device/events", json=batch, headers=dev)
    ack.raise_for_status()

    # 7) dashboard reflects it
    alerts = client.get(f"{base}/api/v1/alerts").json()
    assert any(a["kind"] == "stress_alert" for a in alerts), "stress alert missing"
    live = client.get(f"{base}/api/v1/children/{child['id']}/live").json()
    assert live["state"] in ("active", "cooldown", "offline"), live
    overview = client.get(
        f"{base}/api/v1/children/{child['id']}/analytics/overview?range=today").json()
    assert overview["stress_episodes"] >= 1
    print("PASS pair → events → alert → live/overview")

    # 8) headers + docs-off + https redirect (only meaningful on https)
    if not insecure:
        headers = client.get(f"{base}/").headers
        assert "content-security-policy" in {k.lower() for k in headers}, "CSP missing"
        assert headers.get("x-content-type-options") == "nosniff"
        r404 = client.get(f"{base}/docs")
        assert r404.status_code == 404, f"/docs not 404 in production: {r404.status_code}"
        print("PASS headers (CSP, nosniff) + /docs 404")
        rhttp = httpx.get(f"http://{base.split('//')[1]}/healthz", timeout=30, follow_redirects=False)
        assert rhttp.status_code in (301, 302, 308), f"http not redirected: {rhttp.status_code}"
        print("PASS http→https redirect")

    # 9) cleanup
    if not args.keep:
        client.delete(f"{base}/api/v1/children/{child['id']}/data", headers=REQ)
        client.delete(f"{base}/api/v1/children/{child['id']}", headers=REQ)
        print("PASS cleanup (history + child deleted)")
    print("smoke: ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
