# SENSEHEAVEN v2 — AUTONOMOUS BUILD PROMPT
## FILE 1 of 3 — MASTER RULES, ARCHITECTURE & CONTRACTS

**How to use this pack:** paste Files 01, 02, 03 in order as ONE message (or save them under `docs/spec/` and tell the agent to read all three first). Then send: `Begin at Phase 0.` The agent must re-read the relevant phase section in File 03 before starting each phase — it must not rely on memory of this text.

---

## A. MISSION

Build **SenseHeaven v2** from an empty directory to three shipped, verified deliverables:

| # | Deliverable | Where it lives |
|---|---|---|
| D1 | **Parent Web Dashboard** — production-grade React SPA with live status, analytics, controls | Served by the API at `https://<render-url>/` |
| D2 | **Child Android App** — native Kotlin app: pairing, countdown, lock overlay, emotion sensing, activity capture | Signed APK, downloadable from a GitHub Release |
| D3 | **API** — FastAPI + PostgreSQL, single Render web service, also serves D1 | `https://<render-url>/api/v1` |
| D4 | **ML artifacts** — trained emotion classifier exported as JSON weights + model card + evaluation | `ml/`, bundled into D2 |
| D5 | **Docs** — report skeleton, viva prep, demo script, device acceptance test | `docs/` |

### What "0% error" means here (read carefully)
No one can honestly *prove* software has zero defects. This project instead defines **ZERO KNOWN DEFECTS**, which is measurable and enforced by gates:
1. Every Verification Gate in File 03 exits green, re-run from a clean checkout in CI.
2. Zero console errors/page errors in every Playwright run; zero `Traceback`/`ERROR` lines in API logs during e2e; zero `FATAL EXCEPTION`/`ANR` lines in emulator logcat during e2e.
3. `KNOWN_ISSUES.md` contains no open item of severity ≥ medium.
4. Every user-visible flow is covered by an automated test **or** an explicit line in `docs/DEVICE_ACCEPTANCE_TEST.md` (things that physically need a real phone).
5. The post-deploy smoke test passes against the LIVE URL.

### Human-only steps (unavoidable — the agent must log each in `SETUP_REQUIRED.md` with exact commands, then keep building everything else)
| ID | Step | Why it cannot be automated |
|---|---|---|
| H1 | `gh auth login` (or provide `GITHUB_TOKEN`) | Identity |
| H2 | Provide `RENDER_API_KEY` (agent then creates services via Render REST API) — or connect repo to Render once in the dashboard | Identity / billing |
| H3 | Provide Kaggle credentials (`KAGGLE_USERNAME`, `KAGGLE_KEY`) or place FER2013 manually | Licence acceptance |
| H4 | On the child phone: allow "restricted settings", enable Accessibility service, grant Camera/Notifications/Device-admin/Battery exemption | Android security model — the in-app onboarding wizard guides and verifies each one |
| H5 | 10-minute real-device acceptance run (`docs/DEVICE_ACCEPTANCE_TEST.md`) | Camera + accessibility on real hardware |

---

## B. DECISION RECORD (already decided — do not re-litigate; record deviations in `DECISIONS.md`)

| ID | Decision | Reason |
|---|---|---|
| D-1 | Parent side = **web app**; child side = **native Android only** | Web hot-reloads and deploys with `git push`; removes half the APK rebuild loop; parent side is CRUD + charts. |
| D-2 | Child app = **Kotlin + Jetpack Compose** (not React Native/Expo) | Camera FGS, AccessibilityService, overlay, device admin, MediaPipe are all first-class native APIs. No JS↔native bridge bugs. |
| D-3 | **Drop Firebase entirely** (no FCM, no Firestore) | Removes service-account handling, security rules, token registration. Replaced by: device polling + parent SSE + in-dashboard alerts. |
| D-4 | **One deployable**: FastAPI serves `/api/v1/*` and the built SPA | No CORS, one URL, one Render service. |
| D-5 | Classifier shipped as **JSON weights + tiny Kotlin forward pass** (not TFLite) | Removes TFLite/LiteRT ops-conversion risk; parity is testable to 1e-5. |
| D-6 | Features = **MediaPipe Face Landmarker blendshapes** (same `.task` file in training and on device) | Eliminates train/serve skew. |
| D-7 | Output = **Calm Index 0–100** from a *binary* (calm vs distress) classifier + per-child baseline calibration | FER2013 has no real stress labels; 3-class remap was arbitrary. Honest framing: facial-affect proxy, not a diagnosis. |
| D-8 | **LSTM demoted to optional stretch.** Temporal behaviour = EMA smoothing + hysteresis + sustained-window rules | FER2013 is static images; a sequence model trained on it would be fabricated. Defensible in viva. |
| D-9 | Lock = **Accessibility overlay + foreground service**, best-effort uninstall guard via Device Admin + a11y | Real Android limits: apps cannot power off a phone; Device Owner needs factory-reset provisioning. |
| D-10 | **One device per child** in v1 | Removes multi-device session ownership bugs. |
| D-11 | Camera FGS starts **only from a visible Activity** ("tap-to-start") | Android 14 blocks starting while-in-use FGS from background. |
| D-12 | Rules engine is **device-authoritative**; Python reference implementation + golden vectors define behaviour | Must work offline; parity guaranteed by shared vectors. |

---

## C. GLOBAL AGENT RULES (non-negotiable)

**G1 Autonomy.** Never tell the human to run a command or create a file. Use your shell/browser/file tools. Only H1–H5 may be human-only.
**G2 Contracts first.** Rules vectors, error codes, design tokens and API schemas exist as files *before* any code that consumes them.
**G3 Phase discipline.** Work one phase at a time. Do not start phase N+1 until `make gate-N` exits 0. Never edit a gate to loosen it; gates may only be tightened (log in `GATES_CHANGELOG.md`).
**G4 No placeholders.** No `TODO`, `FIXME`, `NotImplemented`, `pass # later`, lorem ipsum, fake data in shipped paths, or hard-coded success responses. CI greps for these (`scripts/no_placeholders.sh`) and fails.
**G5 No mock success.** A check that passes because it was stubbed to pass is a FAIL. Integration tests hit the real API + real Postgres.
**G6 Real numbers.** Every gate has a numeric/boolean bar. If a bar cannot be met after 3 genuine fix attempts, do NOT lower it: apply the documented fallback (e.g., ship heuristic model) and log a `KNOWN_ISSUES.md` entry.
**G7 Idempotent.** Every script/migration/seed safe to run twice.
**G8 Secrets.** Only in env vars / `.env` (git-ignored) / GitHub & Render secrets. `.env.example` committed. Never log tokens, PINs, passwords, search queries, URLs. Mask to last 4 chars.
**G9 Pin everything.** Exact versions in lockfiles (`package-lock.json`, `requirements.lock`, Gradle version catalog + dependency locking). Never `latest`. Use latest *stable* at build time; commit the lockfile.
**G10 Small commits.** Conventional commits. Each phase ends with a commit whose message contains `Verified: phase N gate green` and a git tag `phase-N-verified`.
**G11 Single source of truth.** `PROGRESS.md` is the log; `contracts/` and `design/` are the specs. If code and spec disagree, the spec wins — fix the code or amend the spec in a commit that says why.
**G12 Log everything that failed.** Each gate failure → `verification/failure-<phase>-<timestamp>.md` (command, output tail, root cause, fix, re-run result).
**G13 Visual proof for UI.** For every UI page/screen, take screenshots (web: 390px and 1440px, light and dark; Android: emulator screenshots) and score them against the **UI Self-Review Rubric** (File 02 §7). Rubric score must be ≥ 90%. Fix and re-shoot until it is.
**G14 Error handling is a feature.** Every network call has: timeout, retry with backoff+jitter (idempotent calls only), user-facing error state with a next action, and a test.
**G15 Accessibility is a gate, not a wish.** axe-core zero serious/critical (web); TalkBack labels + ≥48dp targets (Android).
**G16 Privacy by design.** No camera frame ever leaves the device or touches disk. Only aggregated Calm Index values are uploaded. See §D9.
**G17 Time-box loops.** Max 3 *distinct* fix attempts per failing check, then apply fallback/escalate per §F.
**G18 Cold-start tolerance.** Render free tier sleeps. Child app and smoke tests must tolerate ≥ 60 s first-request latency.
**G19 Working method per phase:** (1) re-read the phase section → (2) write a 10-line plan into `PROGRESS.md` → (3) implement in small commits, running unit tests continuously → (4) run `make gate-N` → (5) UI phases: rubric review → (6) Independent Verifier report (§F.2) → (7) commit + tag.
**G20 Never fake a green.** Do not mark a phase complete, tag it, or start the next one while any check is red, skipped, or unverified.

---

## D. STACK LOCK (deviation requires an entry in `DECISIONS.md`)

| Layer | Choice | Notes |
|---|---|---|
| API | Python 3.11+, **FastAPI**, Pydantic v2, **SQLAlchemy 2.0 (sync)**, **psycopg 3**, **Alembic**, uvicorn (1 worker), `argon2-cffi`, `cryptography`, `sse-starlette`, `slowapi` or in-house limiter | Sync DB access on purpose (fewer footguns). Single worker because the SSE hub is in-memory. |
| DB | PostgreSQL 15+ (Render Postgres) | Normalize `postgres://` / `postgresql://` → `postgresql+psycopg://` in config (classic Render bug). |
| Web | **Vite 5 + React 18.3 + TypeScript (strict)**, **Tailwind CSS 3.4**, **shadcn/ui (Radix)**, TanStack Query v5, React Router 6, react-hook-form + zod, **Recharts**, `lucide-react`, `@fontsource-variable/inter`, `@fontsource-variable/fraunces` | Do NOT adopt Tailwind v4 / React 19 unless every dependency supports it and all gates pass. |
| Web tests | Vitest + Testing Library, **Playwright** (+ `@axe-core/playwright`), Lighthouse CI | |
| Android | **Kotlin 2.x**, **Jetpack Compose (Material 3)**, Gradle Kotlin DSL + version catalog, **CameraX**, **MediaPipe tasks-vision (Face Landmarker)**, Room (KSP), DataStore, OkHttp + Retrofit + kotlinx.serialization, Coroutines/Flow. **No Hilt** (manual DI in an `AppContainer`) | minSdk 26, targetSdk 34, compileSdk 34/35. `isMinifyEnabled = false` (R8 breaks MediaPipe reflection). |
| ML | Python 3.11, `mediapipe`, `scikit-learn`, `numpy`, `pandas`, `opencv-python-headless`, `joblib`, `matplotlib` | No TensorFlow needed. |
| Deploy | Docker multi-stage → Render (`render.yaml` Blueprint) | Free-tier limits (sleep, DB expiry) must be verified at build time and documented. |
| CI | GitHub Actions: `ci.yml` (api+web+ml), `android.yml` (build+test+release APK), `keepalive.yml` (optional) | Android build authority = GitHub Actions; local SDK is a bonus. |

### Repo layout (create exactly this in Phase 0)
```
senseheaven/
├─ PROGRESS.md  SETUP_REQUIRED.md  DECISIONS.md  KNOWN_ISSUES.md  GATES_CHANGELOG.md  README.md
├─ Makefile  Dockerfile  docker-compose.yml  render.yaml  .env.example  .editorconfig  .gitignore
├─ .github/workflows/{ci.yml,android.yml,keepalive.yml}
├─ contracts/        # rules_ref.py, gen_vectors.py, rules_vectors.json, classifier_vectors.json,
│                    # feature_spec.json, error_codes.md, README.md
├─ design/tokens.json
├─ api/{app/{main.py,config.py,db.py,deps.py,security/,models/,schemas/,routers/,services/,middleware/},
│       alembic/, tests/, requirements.in, requirements.lock, pyproject.toml}
├─ web/{src/{app/,components/,features/,lib/,styles/,test/},e2e/,index.html,vite.config.ts,tailwind.config.ts,package.json}
├─ android/{app/,gradle/libs.versions.toml,settings.gradle.kts,build.gradle.kts}
├─ ml/{requirements.txt,src/,data/(git-ignored),artifacts/,reports/,MODEL_CARD.md}
├─ scripts/{doctor.sh,gate.sh,no_placeholders.sh,gen_tokens.py,check_contrast.py,virtual_child.py,
│           seed_demo.py,smoke_prod.sh,db_backup.sh,db_restore.sh,render_deploy.py}
├─ verification/     # phase-N.json + failure reports (committed)
└─ docs/{spec/,architecture.md,DEPLOYMENT.md,DEVICE_ACCEPTANCE_TEST.md,DEMO_SCRIPT.md,report/,viva_prep.md}
```

---

## E. CONTRACTS

### E1. Data model (PostgreSQL; UTC everywhere; UUID PKs generated in Python `uuid4`, NOT DB defaults)
| Table | Columns (all NOT NULL unless `?`) |
|---|---|
| `parents` | id, email (stored lower-case, unique index on it), password_hash (argon2id), display_name, timezone (IANA), pin_salt?, pin_hash?, pin_iterations?, created_at |
| `auth_sessions` | id, parent_id FK, token_hash (sha256), csrf_token, created_at, last_used_at, expires_at, user_agent? |
| `children` | id, parent_id FK, name, birth_year?, avatar_key, created_at, deleted_at? |
| `child_settings` (1:1) | child_id PK/FK, daily_limit_min?, bedtime_start? (HH:MM), bedtime_end?, good_bonus_min=10, stress_penalty_min=5, cooldown_min=5, max_bonus_per_session_min=30, calm_threshold=70, stress_threshold=35, sustained_stress_s=300, sustained_calm_s=900, child_nudge_after_s=120, penalty_lockout_s=900, monitoring_enabled=true, activity_log_enabled=true, search_capture_enabled=true, show_mood_to_child=false, blocked_packages text[], allowed_packages text[] (default includes dialer/emergency), blocked_keywords text[], retention_days=30, config_version int |
| `pairing_codes` | id, child_id FK, code_hash, expires_at, used_at?, attempts=0 |
| `devices` | id, child_id FK unique-while-active, token_hash, name, android_version, app_version, paired_at, last_seen_at?, revoked_at?, permissions jsonb, battery_pct? |
| `screen_sessions` | id, child_id FK, device_id FK, status (`active`\|`cooldown`\|`expired`\|`ended`), granted_s, bonus_s=0, penalty_s=0, used_s=0, started_at, ended_at?, end_reason?, pause_until?, source (`parent_web`\|`device_pin`\|`schedule`) |
| `emotion_events` | id, session_id FK, child_id FK, client_uuid, ts, calm_index smallint, label (`calm`\|`neutral`\|`stressed`), face_present bool, quality real · **UNIQUE(child_id, client_uuid)** |
| `ledger_events` | id, session_id FK, child_id FK, client_uuid, ts, kind (`bonus`\|`penalty`\|`cooldown_start`\|`cooldown_end`\|`manual_add`\|`manual_remove`\|`nudge_shown`\|`stress_alert`\|`low_time`\|`locked`\|`unlocked`), seconds, reason · UNIQUE(child_id, client_uuid) |
| `app_usage` | id, session_id FK, child_id FK, client_uuid, package, label, started_at, ended_at, duration_s, blocked bool · UNIQUE(child_id, client_uuid) |
| `search_events` | id, session_id FK, child_id FK, client_uuid, ts, source_package, query_enc (text `v1:` AES-GCM), url_enc?, flagged bool, flag_keyword? · UNIQUE(child_id, client_uuid) |
| `alerts` | id, parent_id FK, child_id FK, kind, severity (`info`\|`warning`\|`critical`), title, body, payload jsonb, created_at, read_at?, dedupe_key? unique |
| `commands` | id bigserial, child_id FK, device_id FK, kind (`start_session`\|`end_session`\|`add_time`\|`remove_time`\|`lock_now`\|`refresh_config`), payload jsonb, created_at, expires_at, delivered_at?, acked_at? |
| `audit_log` | id, parent_id FK, action, target, ts, ip? |

Indexes: `(child_id, ts DESC)` on every event table; `(child_id, started_at DESC)` on `screen_sessions`; partial unique index on `devices(child_id) WHERE revoked_at IS NULL`.

### E2. API surface (`/api/v1`, JSON, RFC 7807 problem+json errors with a stable `code` from `contracts/error_codes.md`)
**Parent (cookie `sh_session` + `X-CSRF-Token` on mutating requests)**
| Method & path | Purpose |
|---|---|
| `POST /auth/register` `POST /auth/login` `POST /auth/logout` `GET /auth/me` | Account |
| `PUT /parents/me/pin` (needs password) · `PUT /parents/me/password` · `DELETE /parents/me` | Account mgmt |
| `GET/POST /children` · `GET/PATCH/DELETE /children/{id}` · `GET/PATCH /children/{id}/settings` | Children + settings (PATCH bumps `config_version`) |
| `POST /children/{id}/pairing-code` | 409 `PIN_REQUIRED` if parent PIN unset |
| `GET /children/{id}/devices` · `DELETE /devices/{id}` | List / revoke |
| `GET /children/{id}/live` | Current session, last calm index, device freshness |
| `POST /children/{id}/sessions` `{duration_min}` → enqueues `start_session` command | Remote start |
| `POST /sessions/{id}/end` · `/lock` · `/adjust {delta_seconds, reason}` | Controls (each enqueues a command) |
| `GET /children/{id}/analytics/overview?range=today\|7d\|30d` | KPIs |
| `GET /children/{id}/analytics/emotion-timeline?date=YYYY-MM-DD` | 1-min buckets |
| `GET /children/{id}/analytics/emotion-heatmap?range=` | dow×hour mean, min 3 samples |
| `GET /children/{id}/analytics/app-usage?range=` · `/searches?range=&flagged=` · `/sessions?range=` · `GET /sessions/{id}` | Detail |
| `GET /alerts` · `POST /alerts/{id}/read` · `POST /alerts/read-all` | Inbox |
| `GET /stream` (SSE: `live`, `alert`, `device_status`; heartbeat comment every 15 s) | Live updates |
| `GET /children/{id}/export?range=` (CSV zip) · `DELETE /children/{id}/data` | Privacy |

**Device (header `Authorization: Bearer <device_token>`)**
| Method & path | Purpose |
|---|---|
| `POST /device/pair {code, device_name, android_version, app_version}` | Returns `device_token`, child summary, full config, PIN verifier `{algo:"pbkdf2-sha256", iterations:210000, salt_b64, hash_b64}` |
| `GET /device/sync?config_version=N` | Returns `server_time`, `session`, `config` (only if changed), `commands[]`, `pin` (only if changed). Supports `If-None-Match`. |
| `POST /device/events` (batch ≤ 200; every item has `client_uuid`) | Idempotent; returns `{accepted, duplicates}` |
| `POST /device/commands/{id}/ack` | Command consumed |
| `POST /device/heartbeat {used_s, remaining_s, battery_pct, camera_ok, permissions{}}` | Also piggy-backed inside `events` |
Unauthorised/revoked device → `401` `DEVICE_REVOKED` → device wipes local state and shows "unpaired".
**Ops:** `GET /healthz` (process up) · `GET /readyz` (DB reachable + migrations at head).

### E3. Auth, pairing & security requirements
- Passwords: argon2id, min length 10. Login throttle 5 fails / 15 min per (IP,email) → `429` + `Retry-After`.
- Cookies: `HttpOnly; SameSite=Strict; Secure` (Secure in production), 14-day sliding expiry; CSRF double-submit (`sh_csrf` cookie + `X-CSRF-Token` header) on POST/PUT/PATCH/DELETE.
- Headers on all responses: CSP `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`, HSTS (prod), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Fonts are self-hosted (no Google Fonts CDN).
- Pairing code: 6 digits from `secrets`, stored as sha256(code+pepper), 10-min TTL, single-use, ≤ 5 attempts per code, ≤ 10 pair attempts/hour/IP.
- Device token: 32 random bytes urlsafe, stored sha256 only. Scope: a device can only read/write its own child's data.
- **Tenant isolation:** every query that takes an `{id}` filters by `parent_id`. Cross-tenant access returns **404** (not 403). A test auto-enumerates every parent route with a path id and asserts this (the "IDOR matrix").
- Field encryption: `query_enc`/`url_enc` = `v1:` + base64(nonce12 ‖ AES-256-GCM ciphertext+tag); per-parent key via HKDF-SHA256(`APP_MASTER_KEY`, salt=parent_id, info=`senseheaven-v1`). Nonce random per encryption. Decrypt only in the request that returns it.
- Retention: background task deletes events older than `retention_days` nightly (and once at startup).
- Dependency audit in CI: `pip-audit` and `npm audit --omit=dev` fail on high/critical.

### E4. Time accounting & rules engine (device-authoritative; Python reference in `contracts/rules_ref.py` defines exact behaviour)
**Session statuses:** `active`, `cooldown`, `expired`, `ended`. Device is **locked** whenever there is no session in `active|cooldown`, or during bedtime.
**Remaining:** `remaining_s = granted_s + bonus_s − penalty_s − used_s`. `expired` when ≤ 0.
**Tick (1 Hz using `SystemClock.elapsedRealtime` deltas, never wall clock):** `used_s += Δ` only when status = `active` AND screen interactive AND foreground package ∉ `allowed_packages`. Per-tick Δ capped at 5 s. Persist state every 5 s and on every state change. After reboot: restore persisted state; time while powered off is not counted.
**Calm Index → label (per second, only when `face_present` and `quality ≥ 0.5`):**
`ema = 0.2·ci + 0.8·ema` · label uses hysteresis: enter `stressed` at `ema < stress_threshold(35)`, leave at `≥ 40`; enter `calm` at `≥ calm_threshold(70)`, leave at `< 65`; otherwise `neutral`.
**Runs:** `stress_run_s` / `calm_run_s` advance each valid second in that label; reset to 0 after 10 consecutive seconds *not* in that label. No-signal seconds freeze both runs; if no-signal lasts > 120 s both reset.
**Rules (evaluated each second, in this order):**
1. `stress_run_s ≥ child_nudge_after_s (120)` and nudge not yet shown this run → emit `nudge_shown` (gentle child message).
2. `stress_run_s ≥ sustained_stress_s (300)` and `now − last_penalty_ts ≥ penalty_lockout_s (900)` → emit `stress_alert`, add `penalty` (`stress_penalty_min·60` s, capped so remaining ≥ 0), emit `cooldown_start` → status `cooldown` for `cooldown_min` (timer NOT consumed, breathing screen, apps blocked) → `cooldown_end` → `active`; reset `stress_run_s`, set `last_penalty_ts`.
3. `calm_run_s ≥ sustained_calm_s (900)` and `bonus_total + good_bonus ≤ max_bonus_per_session` → emit `bonus`, `bonus_s += good_bonus_min·60`, reset `calm_run_s`.
4. Low-time notices at `remaining_s == 300` and `== 60` (emit `low_time` once each).
5. Command `add_time/remove_time` (idempotent by command id) changes `granted_s`, ledger `manual_add/manual_remove`. `lock_now` → `ended`. `end_session` → `ended`.
6. Bedtime window start → session `expired` with `end_reason = bedtime`; sessions cannot start inside the window.
**Calm Index mapping:** `p = P(distress)` from the classifier; `ci = clamp(round(anchor − slope·(p − b)), 0, 100)` with `anchor=75`, `slope=120` (tuned in Phase 3, stored in model JSON), `b` = per-child baseline median of `p` measured during a 60-second calibration at pairing (default `b` = `default_baseline` from model JSON).
**Golden vectors:** `contracts/rules_vectors.json` (≥ 80 scenarios) generated from the Python reference; the Kotlin engine and the `virtual_child.py` simulator must reproduce them exactly (same events, same seconds).

### E5. Sync & idempotency
- Device polls `GET /device/sync`: every 10 s while a session is active, 15 s while locked, 60 s when the app has no network-availability callback; on failure exponential backoff with jitter up to 5 min. Network-available callback triggers an immediate sync.
- Events go to a Room **outbox**; uploader sends ≤ 200 per POST every 10 s; rows deleted only after a 2xx. Server dedupes via `UNIQUE(child_id, client_uuid)` + `ON CONFLICT DO NOTHING`.
- Server session `used_s` = `max(existing, reported)` (monotonic). Config is server-authoritative; `used_s`, bonuses and penalties are device-authoritative. Commands expire after 24 h.
- Staleness: dashboard shows "Last seen N min ago" after 90 s without sync; creates `device_offline` alert if a session is `active` and the device is silent > 10 min (dedupe per session).

### E6. Edge-case matrix (each row needs a test — unit, integration, or a line in the device acceptance test)
| # | Situation | Required behaviour |
|---|---|---|
| 1 | Device offline mid-session | Local countdown + lock continue; outbox drains on reconnect |
| 2 | Server cold start (30–60 s) | Timeouts 30 s connect / 60 s read; retry with backoff; UI shows "Connecting…" never an error |
| 3 | Wall-clock changed by child | No effect (monotonic clock only) |
| 4 | Reboot mid-session | State restored; boot receiver restarts services; no time counted while off |
| 5 | Camera taken by another app | `camera_ok=false`, runs freeze, retry w/ backoff, never punish |
| 6 | Camera permission revoked | Session paused-by-policy overlay "Camera needed", alert `permission_revoked` |
| 7 | Accessibility service killed/disabled | Foreground service detects within 10 s → full-screen "Turn SenseHeaven back on" overlay via activity; alert `tamper_attempt` |
| 8 | Force-stop of the app | Next launch reconciles; server raises `device_offline` alert |
| 9 | Duplicate/replayed batch | No duplicate rows (idempotent) |
| 10 | Device token revoked | 401 `DEVICE_REVOKED` → wipe, show unpaired, lock is released |
| 11 | Parent changes limits mid-session | New rules apply on next sync; remaining recalculated; ledger entry written |
| 12 | Time-zone/DST change | Bedtime evaluated in parent's IANA zone; tests for DST boundaries |
| 13 | Low battery ≤ 10 % | Camera sampling drops to 0.5 Hz; battery reported |
| 14 | Emergency | Dialer + emergency calls are always allowed and never blocked or counted |
| 15 | Wrong PIN ×5 | 15-min local lockout, exponential thereafter |
| 16 | Uninstall/Settings tamper | a11y guard intercepts pages for SenseHeaven's app-info, uninstall dialog, device-admin, accessibility settings → PIN overlay |
| 17 | Parent deletes child data | Cascade delete; device receives `refresh_config`; dashboard shows empty states |
| 18 | Two parents, same email | Register → 409 `EMAIL_TAKEN` (constant-time; no enumeration on login) |
| 19 | SSE proxy buffering / drop | Client auto-reconnect + polling fallback every 10 s |
| 20 | Storage full / Room failure | App shows blocking error state and stays locked-safe (never unlocks by accident) |

### E7. Analytics definitions (SQL semantics, parent timezone)
- `screen_time_s` = Σ `used_s` deltas of sessions overlapping the range. · `avg_calm` = mean `calm_index` where `face_present`. · `stress_episodes` = count of `stress_alert` ledger events. · `bonus_s`/`penalty_s` = Σ ledger. · `top_apps` = Σ `duration_s` grouped by package (top 10, rest = "Other"). · `timeline` = 1-min mean buckets, gaps stay `null` (never interpolate). · `heatmap` = mean by (weekday, hour), cell `null` if < 3 samples. · Trend = value vs previous equal-length period (± %).

### E8. Privacy & wellbeing requirements
No image/frame stored or transmitted · only aggregated Calm Index (1 per 10 s) leaves the device · persistent notification while monitoring · Android camera indicator is left visible · child-facing consent screen ("What SenseHeaven can see") reachable any time · child-facing language never says "angry/stressed" (say "Let's take a calm moment") · parent-facing wording is "elevated stress signals" with a visible note: *facial-expression estimates are approximate and not a medical or psychological assessment* · export + delete controls · retention default 30 days · search capture only if enabled and disclosed to the child.

---

## F. TESTING MATRIX & GATE CONTRACT

| Layer | Tools | Minimum bar |
|---|---|---|
| API unit+integration | pytest, real Postgres (docker service), httpx | coverage ≥ 85 % overall, ≥ 90 % on `security/`, `services/crypto`, `services/analytics`, device routers; IDOR matrix; alembic up→down→up |
| API property tests | hypothesis | idempotent ingest; monotonic `used_s`; never negative remaining |
| Contract | OpenAPI snapshot diff | `make contract-check` fails on drift; web types regenerated from it |
| Rules parity | shared JSON vectors | Python ref = Kotlin engine = simulator on 100 % of vectors |
| ML | pytest + eval scripts | see Phase 3 thresholds; JSON-vs-sklearn parity ≤ 1e-5 |
| Web unit | Vitest + RTL | ≥ 70 % lines in `features/`; all forms validated |
| Web e2e | Playwright | full parent journey; **0 console/page errors**; axe: 0 serious/critical |
| Web perf/a11y | Lighthouse CI (Overview page, mobile emulation) | Perf ≥ 85, A11y ≥ 95, Best-practices ≥ 95; initial JS ≤ 350 KB gzip |
| Android unit | JUnit + Turbine | rules parity, time keeper, PIN verifier, MLP parity, search extraction, outbox, backoff |
| Android UI | Compose UI tests (emulator API 34) | onboarding gating, PIN pad, lock screens |
| Android e2e | emulator + `adb` + real docker backend | pair → remote start → tap-to-start → inject score → penalty/cooldown → lock; **no `FATAL EXCEPTION`/ANR in logcat** |
| Android static | Android lint, APK inspection (`aapt2 dump badging`) | 0 lint errors; permission list == allowlist; minSdk 26; APK ≤ 120 MB |
| System | docker compose + `virtual_child.py` + Playwright | live dashboard reflects simulated child within 5 s |
| Load | Locust/k6 (or asyncio script) | 50 virtual devices + 20 SSE clients × 10 min: p95 < 400 ms, 0 × 5xx, RSS < 400 MB |
| Post-deploy | `scripts/smoke_prod.sh` | all steps pass against the LIVE URL, then cleans up its test account |
| Hygiene | ruff, mypy, eslint (0 warnings), tsc, ktlint/detekt optional, `no_placeholders.sh`, secret scan (gitleaks) | 0 findings |

**Gate contract:** `make gate-N` runs every check for phase N, prints `PASS/FAIL <name>` per check, and writes `verification/phase-N.json` `{phase, timestamp, checks:[{name, cmd, exit, pass}], verdict}`. `make gate-all` runs 0..N sequentially and stops at the first red. Gates may be tightened, never loosened.

---

## G. FAILURE RECOVERY PROTOCOL (when any check is red)

1. **Isolate** — re-run only that check verbosely (`pytest -vv -x`, `./gradlew --stacktrace`, `docker build --progress=plain`, `playwright test --trace on`). Capture the error tail.
2. **Classify** — pick one: *config/env* · *dependency/version* · *schema/migration drift* · *contract drift* · *async/timing* · *platform-specific (Android/OEM/API level)* · *test defect* · *genuine logic bug*. Check them in that order.
3. **Fix the root cause** — never catch-and-ignore, never weaken an assertion, never `sleep()` to hide a race (poll with timeout instead).
4. **Regression sweep** — re-run the **entire** current gate, then `make gate-all` up to the previous phase.
5. **Log** — write `verification/failure-<phase>-<ts>.md` and a `PROGRESS.md` line `⚠ phase N · <check> · cause · fix · re-verified <ts>`.
6. **Bisect regressions** — if an older gate turns red: `git bisect run make gate-<k>`.
7. **Retry limit** — after 3 *distinct* genuine fix attempts on one check: apply the documented fallback (e.g., ship heuristic scorer, drop optional feature), write `KNOWN_ISSUES.md` (severity + workaround), tell the human in `SETUP_REQUIRED.md` only if human action is needed, and keep building unrelated work.
8. **Never** mark green, tag, or advance with a red/skipped check.

### G.2 Independent Verifier Mode (run after every gate; you are now an auditor, not the builder)
Produce `verification/report-phase-N.md` with, using **real pasted output**: (1) Definition of Done restated; (2) existence check of every artifact; (3) execution check — exit codes; (4) output correctness — expected vs observed values; (5) **negative check** — break something realistically (no auth token → 401; wrong CSRF → 403; malformed batch → 422; empty input file → clear error; unpaired device → locked-safe) and confirm it fails *safely*; (6) regression re-run of the previous phase gate; (7) verdict ✅/❌. A check you could not execute is `UNVERIFIED`, which blocks the phase exactly like a failure. Do not accept "it worked earlier" as evidence.

---

## H. FINAL ACCEPTANCE CHECKLIST (all must be true to call the project complete)
- [ ] `make gate-all` green from a **clean clone** in CI · `verification/phase-0..9.json` all `PASS`
- [ ] Live URL: `/healthz` and `/readyz` OK · SPA loads · `smoke_prod.sh` green
- [ ] Signed APK in a GitHub Release; `aapt2` shows expected package/permissions; the dashboard's Download page links to it
- [ ] Model card + evaluation reports committed; deployed classifier is the one evaluated
- [ ] Web Lighthouse/axe thresholds met on light+dark, mobile+desktop screenshots reviewed (rubric ≥ 90 %)
- [ ] `KNOWN_ISSUES.md` has no severity ≥ medium open · `SETUP_REQUIRED.md` lists only H1–H5
- [ ] Docs complete: report skeleton, viva prep, demo script, device acceptance test, DEPLOYMENT.md
- [ ] Git tags `phase-0-verified` … `phase-9-verified` and `v1.0.0`