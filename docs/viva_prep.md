# Viva Prep — ≥ 40 likely questions with grounded answers

All answers are grounded in this repo. File/spec references in brackets.

## Problem & product

**1. What exactly does SenseHeaven do?**
Gives parents calm screen-time control: the child's phone counts session time on-device,
estimates a wellbeing score from face expression, and adapts — calm stretches earn bonus
minutes; sustained stress starts a short breathing break instead of a punishment.

**2. Why "calm" and not "screentime blocker"?** [File 02 §1]
Adaptive, child-respecting framing: bonuses for calm, breathing breaks instead of
punishment, honest data. A hard blocker is adversarial; this is cooperative.

**3. Who is the customer?**
Parents of school-age children (demo child age ~11); the child is a user, the parent is the
account owner.

## ML

**4. Why blendshapes and not a CNN on the camera frame?** [synopsis_delta.md]
Blendshapes are 52 semantic face-geometry values from MediaPipe — far smaller input, runs
in real time on a phone, no raw-pixel privacy exposure, and identical features in training
and on device (same `.task` file — no skew).

**5. Why binary (calm vs distress) and not 7 classes?** [D-7, LEAN §6.1]
FER2013 has no real "stress" labels. Mapping angry/fear/sad → distress and happy/neutral →
calm is defensible; a 7-class remap would be arbitrary. Excluded surprise/disgust entirely.

**6. What is the Calm Index exactly?** [File 01 §E4, ml/src/calibrate_index.py]
`ci = clamp(floor(anchor − slope·(p − baseline) + 0.5), 0, 100)` — p is P(distress);
anchor/slope grid-tuned on validation; baseline is per-child (30 s calibration, clamped
±0.25) so the index is relative to the child's own resting face.

**7. How do you avoid flicker between labels?** [E4 hysteresis]
EMA smoothing (α=0.2) plus hysteresis: enter stressed below 35 but leave only at ≥40; enter
calm at ≥70, leave below 65. Unit-tested (`hysteresisDoesNotFlap`).

**8. What makes a penalty fire?** [E4 rule 2]
300 s (configurable) of *continuous* stressed label → penalty of 5 min (capped so remaining
never goes negative) → 5-min breathing cooldown where time is not consumed → then back to
active. A 900 s lockout prevents penalty-storms.

**9. How do you handle no face / bad lighting?** [Quality, E6-5]
Quality = min(size_score, light_score); samples below 0.5 are ignored, runs freeze; >120 s
without a signal resets runs. Never punishes on missing data.

**10. What are the model's known limitations?** [MODEL_CARD.md]
Adult web-image training vs children on phone cameras; grayscale low-res training; label
noise (acted expressions); demographic bias; detected-face selection bias. This is why the
output is framed as a proxy and the rules require sustained windows.

**11. Why logistic regression and not a big model?** [LEAN §6.1]
52 inputs, linear — explainable weights, tiny (≤ 20 KB), fast on device, and meets the bars
(AUC ≥ 0.75 target with fallback ladder defined). Bigger models would add risk, not value.

**12. How is the model evaluated?** [ml/src/evaluate.py]
Once, on FER2013's own test split: ROC-AUC with 500-sample bootstrap CI, balanced accuracy,
distress recall, calm false-alarm, Brier, ECE(10), per-original-class table, LR vs heuristic
baseline. Bars fixed in advance; fallback ladder defined (never lowered).

**13. Is this a medical or psychological assessment?**
No — stated in the child consent, the parent dashboard footer, and the model card.

## Security & privacy

**14. How are passwords stored?** [P2.3]
argon2id via argon2-cffi. Unknown emails still run a dummy verify so login timing doesn't
reveal account existence.

**15. How does the phone authenticate?** [P2.5]
Pairing code (6 digits, peppered SHA-256, 10-min TTL, single-use, ≤5 attempts, ≤10 pair
attempts/hour/IP) → 32-byte urlsafe token, stored hashed. Bearer token scoped to its own
child only; revocation returns 401 DEVICE_REVOKED and the app wipes itself.

**16. How do you prevent IDOR between parents?** [E3]
Every child-scoped query goes through `get_child_or_404` (filters by parent, 404 not 403);
`test_idor_matrix` auto-enumerates every parent route with a path id from the OpenAPI spec
and asserts parent B gets 404 for parent A's ids.

**17. What replaces CSRF protection without session tables?** [LEAN §1.2]
JWT in HttpOnly SameSite=Strict Secure cookie + `X-Requested-With: senseheaven` required on
every mutating parent call (403 otherwise). Tested.

**18. What data leaves the phone?** [E8]
Only: aggregated Calm Index (1/10 s), daily per-app totals, ledger events, heartbeat
(battery/permissions). Never frames. No photos anywhere in the app (grep-enforced).

**19. Why no search capture?** [LEAN §1.1, synopsis_delta]
Needs AccessibilityService (keylogger-grade privilege); monitoring a minor's searches
conflicts with data-minimisation under DPDP 2023. Deliberate cut, documented.

**20. Rate limiting?** [P2.3/P2.5]
Login: 5 failures/15 min per (IP,email) → 429 with Retry-After. Pairing: 10 attempts/hour/IP.
In-memory sliding window (single-worker deploy).

## Engineering

**21. Why is time counted on the device and not the server?** [E4, D-12]
Offline-first: the child's limit must work with no network. Server session state is
eventually consistent from device snapshots (used_s monotonic max).

**22. How does the tick loop work?** [GuardService]
1 Hz Handler on monotonic `SystemClock.elapsedRealtime` deltas, per-tick delta capped at
5 s, state persisted every change; reboot restores from the JSON snapshot (BootReceiver
restarts the service). Wall-clock changes are irrelevant (`clockJumpHasNoEffect`).

**23. Why a partial wake lock?** [D-20]
Cooldown/sync must progress with the screen off; without it Android sleeps the CPU and the
countdown stalls (observed on the emulator). 6-hour hard cap; documented deviation.

**24. How is offline handled?** [E6-1]
Everything local keeps working; events queue in a JSON file (cap 2000, drop-oldest-emotion);
uploader drains after reconnect, only 2xx deletes. Tested at unit level and in acceptance A16.

**25. Why polling instead of push?** [LEAN §1.2]
FCM-free: 5 s polling when the tab is visible, 15 s otherwise, 10/15 s device sync — near-
live at zero infra cost. Poll pauses when the tab is hidden.

**26. How do uploads stay idempotent?** [E5]
Every event carries client_uuid; server `UNIQUE(child_id, client_uuid)` + `ON CONFLICT DO
NOTHING`; replay test asserts duplicates counted, zero new rows.

**27. Why Neon and not Render Postgres?** [LEAN §2]
Render's free Postgres expires 30 days after creation. Neon free persists; pooled
connection string, PgBouncer-safe engine flags, 60 s first-connect retry.

**28. Why is there no Alembic?** [LEAN §1.2]
Schema frozen at Phase 2; `create_all()` at startup + dev reset script. Simpler for a
single-release project; migrations are future work.

**29. How do the web and Android share behaviour contracts?**
`contracts/error_codes.md` (problem+json codes → copy in both UIs), settings JSON Schema →
Pydantic parity test, OpenAPI → TypeScript types, classifier vectors → Kotlin parity test.

**30. What happens when the parent changes limits mid-session?** [E6-11]
PATCH bumps config_version; next device sync (≤10 s) returns the new config; rules apply
immediately. Tested.

**31. What is the demo/debug panel and why is it mandatory?** [LEAN §1.1]
DebugReceiver (debug builds only): inject Calm Index, fast-forward, force cooldown, dump
state — lets us prove the adaptive rules in minutes instead of waiting real time.

**32. How do you know the whole loop works?** [P6.1]
`scripts/system_test.py`: boots the real API, runs the virtual child (stress scenario) →
stress alert + timeline + ledger on the dashboard; calm scenario → bonus, zero alerts.

**33. CI?** [.github/workflows/ci.yml]
api job (Postgres service, ruff, pytest) + web job (eslint, tsc, vitest, build) on every
push; android job placeholder pending the Phase-7 release pipeline.

## Honesty & limits

**34. What doesn't work yet?** [KNOWN_ISSUES/future_work]
Model training blocked on FER2013 licence acceptance (H3) — heuristic-tier model ships
until then; bedtime schedules, uninstall guard, SSE push, dark mode — all documented cuts.

**35. Why "zero known defects" and not "zero bugs"?** [File 01 §A]
No one can prove zero bugs. We define and enforce *zero known defects*: every gate green,
no console errors, no open medium+ issues, every flow tested or in the acceptance doc.

**36. What would you build next?** [future_work]
Device-Owner provisioning (uninstall guard), on-device model fine-tuning with consented
in-family data, bedtime schedules, SSE/FCM, dark mode, breathing orb animation.

**37. How is the child's consent handled?** [File 02 §4]
First-launch consent cards (what it sees, who sees it), re-readable any time; parent-facing
wording says "estimates, not assessment"; child wording never uses blame words.

**38. What if the parent's JWT is stolen?**
HttpOnly+SameSite=Strict+Secure mitigates XSS exfiltration; 14-day expiry; account PIN
required for device-touching actions; production HSTS.

**39. What's the load story?** [File 01 F]
Single uvicorn worker (in-memory limiter + sync SQLAlchemy by design for the free tier);
polling at 5–15 s per client is the intended scale (one family per deployment).

**40. Why is screen-time counting paused during cooldown?**
The breathing break is a reset, not extra punishment — time is frozen so the child doesn't
lose paid time for the pause. Time only counts while interactive on non-allowed apps.

**41. What data survives an uninstall?** [E8]
Nothing on-device (we keep no backups); server data is deletable from Settings → Privacy
(delete history / delete child) — no retention jobs in the lean build.

**42. Show me the tests.**
321+ automated checks across gates 0–5 (API 81, web 41, Android 32, contract/tooling checks
per gate); every gate writes verification/phase-N.json with per-check exit codes.
