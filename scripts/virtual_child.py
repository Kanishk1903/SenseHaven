#!/usr/bin/env python3
"""virtual_child.py (P2.8) — a test device that exercises ONLY the real API (no mocks).

Pairs with a 6-digit code, then syncs / posts events / obeys commands like the Android app
would. Runs against any reachable backend:  api/.venv/bin/python scripts/virtual_child.py \
    --base-url http://localhost:8000 --code 123456 --scenario stress --fast
"""
import argparse
import json
import random
import time
import uuid
from datetime import datetime, timezone

import httpx

TICK_S = 10.0  # one emotion event per 10 s (File 01 §E8)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulated child device against the real API")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--code", required=True, help="6-digit pairing code from the dashboard")
    parser.add_argument("--scenario", choices=["calm", "stress", "mixed"], default="calm")
    parser.add_argument("--fast", action="store_true", help="20x faster ticks (still posts every tick)")
    parser.add_argument("--ticks", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    rng = random.Random(args.seed)
    speed = 20 if args.fast else 1
    base = args.base_url.rstrip("/")

    with httpx.Client(base_url=base, timeout=30.0) as client:
        response = client.post(
            "/api/v1/device/pair",
            json={"code": args.code, "device_name": "Virtual Child", "android_version": "14",
                  "app_version": "1.0.0"},
        )
        if response.status_code != 201:
            print(json.dumps({"error": "pair failed", "status": response.status_code, "body": response.json()}))
            return 1
        paired = response.json()
        headers = {"Authorization": f"Bearer {paired['device_token']}"}
        config = paired["config"]
        cfg_version = paired["config_version"]
        print(json.dumps({"event": "paired", "child": paired["child"]["name"]}))

        session_id = None
        status = "none"  # none|active|cooldown|ended
        granted = bonus = penalty = used = 0
        stress_run = calm_run = 0
        bonus_total_s = 0
        last_penalty_tick = -10_000
        cooldown_until_tick = -1
        low_time_flags: set[int] = set()
        tick = 0

        while tick < args.ticks and status in ("none", "active", "cooldown"):
            server = client.get("/api/v1/device/sync", params={"config_version": cfg_version}, headers=headers).json()
            if server["config"] is not None:
                config = server["config"]
                cfg_version = server["config_version"]

            for command in server["commands"]:
                kind, payload = command["kind"], command.get("payload", {})
                if kind == "start_session":
                    session_id, status = payload["session_id"], "active"
                    granted, used, bonus, penalty = payload["duration_s"], 0, 0, 0
                    stress_run = calm_run = 0
                elif kind in ("end_session", "lock_now"):
                    status, session_id = "ended", (session_id or payload.get("session_id"))
                elif kind in ("add_time", "remove_time") and session_id:
                    delta = payload.get("delta_s", 0)
                    if kind == "add_time":
                        granted += delta
                    else:
                        granted = max(0, granted - delta)
                client.post(f"/api/v1/device/commands/{command['id']}/ack", headers=headers)

            events: dict = {"sent_at": now_iso(), "emotion": [], "ledger": [], "sessions": [], "app_usage": []}
            label = "neutral"
            if status == "active":
                used += int(TICK_S)
                remaining = granted + bonus - penalty - used
                in_stress_window = (
                    args.scenario == "stress"
                    or (args.scenario == "mixed" and (tick // 6) % 2 == 1)
                )
                calm_index = rng.randint(12, 28) if in_stress_window else rng.randint(72, 92)
                label = "stressed" if calm_index < 35 else ("calm" if calm_index >= 70 else "neutral")
                events["emotion"].append({
                    "client_uuid": f"vc-emo-{uuid.uuid4()}", "session_id": session_id,
                    "ts": now_iso(), "calm_index": calm_index, "label": label,
                    "face_present": True, "quality": 0.9,
                })

                if label == "stressed":
                    stress_run += int(TICK_S)
                    calm_run = 0
                elif label == "calm":
                    calm_run += int(TICK_S)
                    stress_run = 0

                lockout_ok = (tick - last_penalty_tick) * TICK_S >= config.get("penalty_lockout_s", 900)
                if in_stress_window and stress_run >= config.get("sustained_stress_s", 300) and lockout_ok:
                    # sustained stress reached: alert + penalty + cooldown (time not consumed)
                    pen = min(config.get("stress_penalty_min", 5) * 60, max(remaining, 0))
                    penalty += pen
                    last_penalty_tick = tick
                    cooldown_until_tick = tick + int(config.get("cooldown_min", 5) * 60 / TICK_S)
                    stress_run = 0
                    status = "cooldown"
                    events["ledger"].append({
                        "client_uuid": f"vc-led-{uuid.uuid4()}", "session_id": session_id,
                        "ts": now_iso(), "kind": "stress_alert",
                        "seconds": config.get("sustained_stress_s", 300), "reason": "Sustained stress",
                    })
                    events["ledger"].append({
                        "client_uuid": f"vc-led-{uuid.uuid4()}", "session_id": session_id,
                        "ts": now_iso(), "kind": "penalty", "seconds": pen, "reason": "Stress breather",
                    })
                elif label == "calm" and calm_run >= config.get("sustained_calm_s", 900) \
                        and bonus_total_s + config.get("good_bonus_min", 10) * 60 <= config.get("max_bonus_per_session_min", 30) * 60:
                    gain = config.get("good_bonus_min", 10) * 60
                    bonus += gain
                    bonus_total_s += gain
                    calm_run = 0
                    events["ledger"].append({
                        "client_uuid": f"vc-led-{uuid.uuid4()}", "session_id": session_id,
                        "ts": now_iso(), "kind": "bonus", "seconds": gain, "reason": "Sustained calm",
                    })

                if status == "active":
                    remaining = granted + bonus - penalty - used
                    for threshold in (300, 60):
                        if remaining <= threshold and threshold not in low_time_flags:
                            low_time_flags.add(threshold)
                            events["ledger"].append({
                                "client_uuid": f"vc-led-{uuid.uuid4()}", "session_id": session_id,
                                "ts": now_iso(), "kind": "low_time", "seconds": threshold,
                                "reason": "Time is running low",
                            })
                    if remaining <= 0:
                        status = "expired"

            if status == "cooldown" and tick >= cooldown_until_tick:
                status = "active"
                events["ledger"].append({
                    "client_uuid": f"vc-led-{uuid.uuid4()}", "session_id": session_id,
                    "ts": now_iso(), "kind": "cooldown_end", "seconds": 0, "reason": "Breather finished",
                })

            if session_id and status != "none":
                events["sessions"].append({
                    "id": session_id, "status": status, "granted_s": granted, "bonus_s": bonus,
                    "penalty_s": penalty, "used_s": used,
                    "started_at": events["sent_at"] if status != "none" else None,
                    "ended_at": events["sent_at"] if status in ("ended", "expired") else None,
                    "end_reason": "expired" if status == "expired" else None,
                    "source": "parent_web",
                })
                events["heartbeat"] = {
                    "used_s": used, "remaining_s": max(granted + bonus - penalty - used, 0),
                    "battery_pct": 80, "camera_ok": True,
                    "permissions": {"camera": True, "notifications": True,
                                    "usage_access": True, "overlay": True},
                }
            else:
                events["heartbeat"] = {
                    "used_s": 0, "remaining_s": 0, "battery_pct": 80, "camera_ok": False,
                    "permissions": {"camera": True, "notifications": True,
                                    "usage_access": True, "overlay": True},
                }

            response = client.post("/api/v1/device/events", json=events, headers=headers)
            if response.status_code != 200:
                print(json.dumps({"error": "events rejected", "status": response.status_code}))
            print(json.dumps({"tick": tick, "status": status, "label": label,
                              "used_s": used, "remaining_s": max(granted + bonus - penalty - used, 0)}))

            tick += 1
            time.sleep(TICK_S / speed)

    print(json.dumps({"event": "done", "ticks": tick}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
