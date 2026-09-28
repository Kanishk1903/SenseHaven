# SENSEHEAVEN v2 — FILE 03 of 03 (LEAN) — PHASES 0–8 AND GATE DEFINITIONS

**Paste order:** File 01 → File 02 → LEAN EDITION → **this file** → then send: `Begin at Phase 0.`
**Precedence:** LEAN EDITION overrides Files 01–02. This file overrides nothing; where it adds detail (API payloads, gates) it is binding. Phase 3 lives in **LEAN EDITION §6** (slices P3.1–P3.7); this file only defines where it sits and its gate.

---

## X. START PROTOCOL (what the agent does on `Begin at Phase 0`)
1. Read Files 01, 02, LEAN and this file completely. Copy them to `docs/spec/` (Phase 0 slice 0.1 does this).
2. Reply with a ≤ 25-line understanding: the MUST list, human steps H1–H5 (+H2b, H6 below), the phase map, and the first 3 slices. Then start slice 0.1 without waiting.
3. Each phase: (a) re-read that phase's section, (b) write a ≤ 10-line plan in `PROGRESS.md`, (c) run slices in order, one commit each, (d) `make gate-N`, (e) UI phases: rubric, (f) Independent Verifier report (File 01 §G.2), (g) commit + tag `phase-N-verified`.
4. Never start the next phase while `make gate-N` is red, skipped or UNVERIFIED. Never edit a gate to loosen it (tighten only, log in `GATES_CHANGELOG.md`).
5. Two-strikes rule (LEAN §4.3) applies to every feature: two failed distinct fix attempts or 4 working hours → cut/simplify, log in `DECISIONS.md`, add to `docs/future_work.md`, continue.

### Human-only steps (lean version — log each in `SETUP_REQUIRED.md` with exact commands; keep building everything else)
| ID | Step |
|---|---|
| H1 | `gh auth login` (or `GITHUB_TOKEN`) |
| H2 | Render: provide `RENDER_API_KEY`, **or** connect the repo once in the Render dashboard |
| **H2b** | **Neon**: create a free Neon project, copy the **pooled** connection string as `DATABASE_URL` (Render's own free Postgres expires after 30 days — do not use it) |
| H3 | Kaggle credentials or FER2013 placed in `ml/data/fer2013/` |
| H4 | On the child phone: grant Camera, Notifications, Usage access, Display over other apps (+ battery exemption) — the in-app wizard guides each |
| H5 | 10–15 minute real-device run of `docs/DEVICE_ACCEPTANCE_TEST.md` |
| **H6** | Optional: create the Android project from Android Studio's "Empty Activity (Compose)" template if `assembleDebug` is not green after two agent attempts in slice 5.0 |

### Gate runner contract (built in Phase 0, used by every phase)
- `scripts/gate.sh N` sources `scripts/gates/gate-N.sh`, which calls `check "<name>" "<shell command>"` for each check. `check` runs the command, prints `PASS <name>` / `FAIL <name>`, captures the last 40 lines on failure, and at the end writes `verification/phase-N.json`: `{phase, timestamp, checks:[{name,cmd,exit,pass}], verdict:"PASS|FAIL|PASS_WITH_FALLBACK|BLOCKED_ON_Hx", fallback_applied}`; exit code 1 if any check failed.
- `make gate-N`, `make gate-upto N=k` (runs 0..k, stops at first red), `make gate-all`.
- Every gate ends with the check `regression: previous gate` (re-run of gate N-1).
- `PROGRESS.md` format: one line per event `YYYY-MM-DD HH:MM · phase N · slice X · ✅|⚠|❌ · note`.

### Lean edge-case coverage (File 01 §E6 rows that remain)
Rows **1, 2, 3, 4, 5, 6, 9, 10, 11, 14, 15, 17, 18, 20** (offline · cold start · clock changed · reboot · camera busy · camera permission revoked · duplicate batch · revoked token · settings change mid-session · emergency dialer · wrong PIN ×5 · delete child data · email taken · storage failure stays locked). Rows 7, 8, 12, 13, 16, 19 are cut. Phase 6 requires `docs/edge_case_coverage.md` mapping each remaining row to a test name or a device-acceptance step ID.

---

## PHASE 0 — SCAFFOLD, TOOLING, CI

**Goal:** an empty-but-verified skeleton where every later gate can run.

### P0.1 Repo, docs, spec copies
```
Create the repo layout below. Copy the four prompt files to docs/spec/. Create PROGRESS.md, DECISIONS.md,
KNOWN_ISSUES.md, SETUP_REQUIRED.md, GATES_CHANGELOG.md, docs/future_work.md with a one-line header each.
senseheaven/: README.md Makefile Dockerfile docker-compose.yml render.yaml .env.example .editorconfig .gitignore
  .github/workflows/{ci.yml,android.yml}  contracts/  design/  api/  web/  android/  ml/
  scripts/{doctor.sh,gate.sh,gates/,no_placeholders.sh,gen_tokens.py,check_contrast.py,seed_demo.py,virtual_child.py,smoke_prod.py,warm.sh}
  verification/  docs/{spec/,architecture.md,DEPLOYMENT.md,DEVICE_ACCEPTANCE_TEST.md,DEMO_SCRIPT.md,viva_prep.md,report/}
.gitignore must cover: .env, *.keystore, node_modules, dist, __pycache__, .venv, ml/data/, ml/artifacts/*.task, android/**/build, .gradle, *.apk (except none), local.properties.
Initialise git, first commit "chore: scaffold". If `gh auth status` fails, add H1 to SETUP_REQUIRED.md and continue locally.
```
**Accept:** `git log --oneline | head -1`; `ls docs/spec` shows 4 files.

### P0.2 Doctor script
```
scripts/doctor.sh (idempotent, no side effects) prints PASS/WARN/FAIL for: python3.11+, node>=20, npm, docker + compose,
git, java 17, gh auth, disk >= 10 GB, `adb` (WARN if missing), Android SDK (WARN if missing). FAIL (exit 1) only for python, node,
docker, git. Add `make doctor`.
```
### P0.3 Local database and env
```
docker-compose.yml: service `db` = postgres:16, port 5432, user/pass/db senseheaven, volume, healthcheck (pg_isready).
.env.example with: DATABASE_URL, APP_SECRET, PAIRING_PEPPER, ENV=development, ALLOWED_ORIGINS, DEVICE_BASE_URL. Never commit real .env.
```
### P0.4 Gate runner, placeholder check, CI
```
Implement scripts/gate.sh + scripts/gates/gate-0.sh per the gate runner contract. scripts/no_placeholders.sh greps
(excluding docs/spec, node_modules, .venv, build dirs) for: TODO, FIXME, NotImplemented, "lorem ipsum", "pass  # later" and fails on hits.
Makefile targets: doctor, gate-%, gate-upto, gate-all, api-test, web-test, web-build, up, down.
.github/workflows/ci.yml: on push/PR — job api (postgres service, install, ruff, pytest) and job web (npm ci, eslint, tsc, vitest, build);
both skip gracefully with a clear message while api/ or web/ are still empty. android.yml: placeholder workflow that only runs
`echo android pending` until Phase 5 replaces it.
```
### GATE 0 — `make gate-0`
| Check | Command / bar |
|---|---|
| layout | every path in P0.1 exists |
| doctor | `scripts/doctor.sh` exit 0 |
| db | `docker compose up -d db` then `pg_isready` healthy within 60 s |
| placeholders | `scripts/no_placeholders.sh` exit 0 |
| gitignore | `git check-ignore .env ml/data/x node_modules/x` all ignored |
| runner | `scripts/gate.sh 0` writes valid `verification/phase-0.json` |
| ci (if H1) | latest GitHub Actions run of `ci.yml` is green; otherwise recorded as `BLOCKED_ON_H1` for this check only |
**Verifier negative checks:** run gate with `.env.example` deleted → fails; commit a file containing `TODO` → placeholders check fails (then revert).
Tag `phase-0-verified`.

---

## PHASE 1 — CONTRACTS AND DESIGN TOKENS

**Goal:** the specs that code will consume exist first (File 01 G2).

### P1.1 Error codes
```
contracts/error_codes.md: table code | HTTP | meaning | user-facing copy (follow File 02 §5 copy guide). Codes:
UNAUTHENTICATED 401, INVALID_CREDENTIALS 401, EMAIL_TAKEN 409, VALIDATION_ERROR 422, NOT_FOUND 404, RATE_LIMITED 429 (Retry-After),
CSRF_HEADER_MISSING 403, PIN_REQUIRED 409, PIN_INVALID 422, PAIRING_CODE_INVALID 422, PAIRING_CODE_EXPIRED 410,
DEVICE_TOKEN_INVALID 401, DEVICE_REVOKED 401, SESSION_NOT_ACTIVE 409, BATCH_TOO_LARGE 413, COMMAND_EXPIRED 410, INTERNAL_ERROR 500.
Error body is RFC 7807 problem+json plus: code, request_id.
```
### P1.2 Settings contract
```
contracts/settings_schema.json (JSON Schema draft 2020-12) for children.settings with defaults and ranges:
good_bonus_min 10 [1,60]; stress_penalty_min 5 [1,30]; cooldown_min 5 [1,15]; max_bonus_per_session_min 30 [0,120];
calm_threshold 70 [50,95]; stress_threshold 35 [5,60] (must be < calm_threshold - 10); sustained_stress_s 300 [60,900];
sustained_calm_s 900 [300,3600]; penalty_lockout_s 900 [300,3600]; monitoring_enabled true; activity_log_enabled true;
show_mood_to_child false; blocked_packages [] (each matches ^[a-zA-Z][\w.]*$); allowed_packages default ["com.android.dialer","com.google.android.dialer","com.android.emergency"]; config_version integer (server-managed).
```
### P1.3 Design tokens (light theme only, per LEAN §1.3)
```
design/tokens.json from File 02 §2.1 (light), §2.3 type (Inter only), §2.4 space/radii/shadows/motion.
scripts/gen_tokens.py (idempotent) emits design/generated/tokens.css (CSS variables), design/generated/tailwind.tokens.cjs
(theme extension) and design/generated/Tokens.kt (Compose Colors + dimensions). Generated files are committed; never hand-edit.
scripts/check_contrast.py: WCAG ratios for every text/background pair in File 02 (text/bg, text-muted/bg, text-subtle/bg,
on-primary/primary, calm-fg/calm-soft, neutral-fg/neutral-soft, stress-fg/stress-soft, primary/bg for links). Body >= 4.5,
large >= 3, UI boundaries >= 3. On failure adjust the token, re-run, log in GATES_CHANGELOG.md.
contracts/README.md explains that OpenAPI (exported in Phase 2) and contracts/feature_spec.json (Phase 3) are the other contract sources.
```
### GATE 1 — `make gate-1`
| Check | Bar |
|---|---|
| error codes | file parses; every listed code has HTTP + copy; no duplicates |
| settings schema | validates as JSON Schema; defaults validate against it; constraint `stress < calm − 10` tested with 3 bad and 3 good samples |
| tokens generated | run `gen_tokens.py` twice → `git diff --exit-code design/generated` clean |
| contrast | `check_contrast.py` exit 0 |
| placeholders | clean |
| regression | `make gate-0` |
Tag `phase-1-verified`.

---

## PHASE 2 — API CORE

**Goal:** the complete backend for File 01 §E2 as trimmed by LEAN §1.2, tested against real Postgres.

### Binding payload shapes (parent and device)
**Common:** UTC ISO-8601 timestamps; UUIDs; problem+json errors. **Parent auth:** cookie `sh_session` (HS256 JWT, 14 days, HttpOnly, SameSite=Strict, Secure in production) + header `X-Requested-With: senseheaven` on every POST/PUT/PATCH/DELETE (else 403 `CSRF_HEADER_MISSING`).
- `POST /auth/register {email, password(min 10), display_name, timezone(IANA, validated)}` → 201 parent.
- `PUT /parents/me/pin {password, pin(^\d{6}$)}` → 204; stores PBKDF2-HMAC-SHA256, 210 000 iterations, 16-byte salt; increments `parents.pin_version` (**deviation from File 01: new column `pin_version`, log in DECISIONS.md**).
- **Device pair** `POST /device/pair {code, device_name, android_version, app_version}` → `{device_token, child:{id,name}, config_version, config, pin:{algo:"pbkdf2-sha256",iterations,salt_b64,hash_b64}, pin_version}`. Pairing again for a child **revokes the previous device** (log in DECISIONS.md).
- **Device sync** `GET /device/sync?config_version=N&pin_version=M` → `{server_time, config_version, config|null, pin|null, pin_version, session:{id,status,granted_s,bonus_s,penalty_s,used_s}|null, commands:[{id,kind,payload,created_at}]}`.
- **Device events** `POST /device/events` (≤ 200 items total, else 413 `BATCH_TOO_LARGE`):
```
{ "sent_at": iso,
  "emotion":  [{client_uuid, session_id|null, ts, calm_index(0-100), label(calm|neutral|stressed), face_present, quality(0-1)}],
  "ledger":   [{client_uuid, session_id, ts, kind(bonus|penalty|cooldown_start|cooldown_end|manual_add|manual_remove|stress_alert|low_time|locked|unlocked), seconds, reason}],
  "app_usage":[{date:"YYYY-MM-DD", package, label, seconds}],            // upsert on (child,date,package) with max(seconds)
  "sessions": [{id, status, granted_s, bonus_s, penalty_s, used_s, started_at, ended_at|null, end_reason|null, source}],
  "heartbeat": {used_s, remaining_s, battery_pct, camera_ok, permissions:{camera,notifications,usage_access,overlay}} }
→ {accepted:{emotion,ledger,app_usage,sessions}, duplicates:n}
```
  Server rules: `UNIQUE(child_id, client_uuid)` + `ON CONFLICT DO NOTHING`; session snapshot upserts by id with `used_s/bonus_s/penalty_s = max(existing, reported)`; a session in `ended|expired` never returns to `active`; a `stress_alert` ledger event creates an `alerts` row (kind `stress_alert`, severity `warning`, dedupe_key `stress:{session_id}:{ts truncated to 10 min}`); `heartbeat.permissions` losing a grant creates one `permission_revoked` alert per device per day.
- **Sessions/commands (parent):** `POST /children/{id}/sessions {duration_min(5..480)}` creates a session with status **`pending`** (added to File 01's enum, log it) + command `start_session {session_id,duration_s}`; `POST /sessions/{id}/end|lock` → command `end_session|lock_now`; `POST /sessions/{id}/adjust {delta_seconds(nonzero), reason}` → `add_time|remove_time`. Commands expire after 24 h; device acks with `POST /device/commands/{id}/ack` (idempotent).
- **Parent reads:**
  - `GET /children/{id}/live` → `{state:"unpaired|offline|active|cooldown|locked", device:{id,name,last_seen_at,stale,battery_pct,camera_ok,permissions}|null, session|null, calm_index:{value,label,ts}|null, remaining_s|null}` (`stale` = last seen > 90 s; `offline` state when stale).
  - `GET /children/{id}/analytics/overview?range=today|7d|30d` → `{screen_time_s, avg_calm|null, avg_calm_trend_pct|null, stress_episodes, bonus_s, penalty_s, sessions_count}` (definitions per File 01 §E7, parent's timezone).
  - `GET .../analytics/emotion-timeline?date=YYYY-MM-DD` → `{date, tz, buckets:[{t, value|null, n}]}` one bucket per minute; gaps stay `null`.
  - `GET .../analytics/app-usage?range=` → `{items:[{package,label,seconds,blocked}], other_seconds}` (top 10).
  - `GET .../analytics/sessions?range=` → sessions each with `ledger:[…]` inline and `avg_calm`.
  - Alerts, devices, children/settings, `DELETE /children/{id}/data` (events, usage, ledger, sessions, alerts) exactly as File 01 §E2 minus cut endpoints.
- `ENV=production` disables `/docs`, `/redoc`, `/openapi.json`. `GET /healthz`, `GET /readyz` (SELECT 1).

### P2.1 Skeleton
```
FastAPI app factory in api/app/main.py. config.py reads env (fail fast with a clear message if a required var is missing).
db.py: SQLAlchemy 2.0 sync engine; normalise postgres:// and postgresql:// to postgresql+psycopg://; pool_pre_ping=True,
pool_recycle=300, connect_args={"prepare_threshold": None}. create_all() on startup. scripts/reset_db.py (dev only, refuses if ENV=production).
Middleware: request-id, security headers (LEAN §1.2), in-memory limiter (login 5 failures/15 min per (ip,email); pairing 10/hour per ip),
problem+json exception handlers using contracts/error_codes.md. Logging never prints tokens, PINs, passwords or full pairing codes (mask to last 4).
Routes: /healthz, /readyz. Tests: readyz true with DB, false (503) when DB is down; error body shape; headers present.
```
### P2.2 Models
```
SQLAlchemy models for the 10 lean tables (LEAN §1.2) with UUID pk generated in Python (uuid4), timezone-aware UTC datetimes,
unique indexes: parents.email(lower), (child_id,client_uuid) on emotion_events and ledger_events, (child_id,date,package) on
app_usage_daily, partial unique on devices(child_id) WHERE revoked_at IS NULL, alerts.dedupe_key. Indexes (child_id, ts DESC) on event tables.
children.settings is JSONB validated by a Pydantic model generated from contracts/settings_schema.json.
Tests: constraints actually reject duplicates; cascade delete of a child removes its data.
```
### P2.3 Auth and PIN
```
Implement register/login/logout/me; argon2id (argon2-cffi); login for unknown email runs a dummy hash so timing matches;
email stored lower-case; EMAIL_TAKEN on duplicate; throttle -> 429 with Retry-After; cookie flags as specified;
X-Requested-With enforcement dependency on mutating parent routes. PUT /parents/me/pin per binding shape.
Tests: wrong password 401 INVALID_CREDENTIALS; 6th attempt 429; cookie has HttpOnly + SameSite=Strict (+Secure when ENV=production);
mutating call without header 403; expired/tampered JWT 401; logout clears cookie; PIN must be 6 digits; PIN requires correct password.
```
### P2.4 Children and settings
```
CRUD children (soft delete via deleted_at); PATCH settings validates with the Pydantic model, applies deep merge, increments config_version.
Central helper get_child_or_404(parent, child_id) used everywhere — cross-tenant returns 404, never 403.
Tests: invalid settings 422 VALIDATION_ERROR with field details; stress_threshold >= calm_threshold - 10 rejected; config_version increments once per PATCH.
```
### P2.5 Pairing and device auth
```
POST /children/{id}/pairing-code: 409 PIN_REQUIRED if parent PIN unset; 6-digit code from `secrets`, stored as sha256(code+PAIRING_PEPPER),
10-minute TTL, single use, max 5 attempts per code; response returns the plain code once.
POST /device/pair per binding shape; issues a 32-byte urlsafe token stored as sha256; revokes previous device for that child.
Device auth dependency: Authorization: Bearer; revoked/unknown token -> 401 DEVICE_REVOKED / DEVICE_TOKEN_INVALID; device sees only its own child.
Tests: code works once; wrong code increments attempts; expired -> 410; 6th attempt blocked; pairing again revokes the old device;
device token cannot call parent routes; parent cookie cannot call device routes.
```
### P2.6 Device sync, events, commands
```
Implement /device/sync, /device/events, /device/commands/{id}/ack, heartbeat handling per binding shapes and server rules.
Batch limit 200 total items. All writes in one transaction. Idempotency via ON CONFLICT DO NOTHING.
Tests: replaying the same batch twice creates no duplicates and reports duplicates>0; used_s never decreases; ended session cannot become active;
stress_alert ledger creates exactly one alert (dedupe); permission_revoked once per day; commands returned until acked, then not; expired command not returned;
config unchanged -> config:null; pin unchanged -> pin:null.
```
### P2.7 Parent reads and controls
```
Implement live, sessions create/end/lock/adjust, analytics (overview, emotion-timeline, app-usage, sessions), alerts (list, read, read-all),
devices (list, revoke), DELETE /children/{id}/data, DELETE /children/{id}. SessionState derivation as in the binding live shape.
Timezone: bucket/range boundaries use parents.timezone (zoneinfo). Tests: a DST-transition day returns correct 1-min buckets; empty data returns
empty arrays and nulls (never 500); adjust with delta 0 -> 422; starting a session when device unpaired -> 409 SESSION_NOT_ACTIVE-style error with clear copy code.
```
### P2.8 Security tests, IDOR matrix, seed, virtual child, OpenAPI
```
tests/test_idor_matrix.py: create two parents with children/devices/sessions/alerts; auto-enumerate every parent route that has a path id
(from app.routes) and assert parent B gets 404 for parent A's ids. tests/test_security.py: everything listed in P2.3/P2.5 plus security headers
and /docs disabled when ENV=production.
scripts/seed_demo.py (idempotent): creates demo parent (email/password from env), one child "Aarav", 7 days of realistic emotion/ledger/app_usage data.
scripts/virtual_child.py: CLI (`--base-url --code --scenario calm|stress|mixed --fast`) that pairs with a code, syncs, posts events at 1 event/10 s
(or 20x faster with --fast), obeys start/end/lock/add/remove commands and acks them, keeps its own remaining_s counter, and emits stress_alert
ledger events when the scenario dictates. It is a test tool, not a mock: it exercises the real API only.
Makefile: `make contract-export` writes contracts/openapi.json (from app.openapi()) — commit it.
```
### GATE 2 — `make gate-2`
| Check | Bar |
|---|---|
| tests | `pytest` all pass against real Postgres (compose `db`), no skips |
| coverage | ≥ 60 % overall; `security/`, auth and device routers 100 % of the tests listed above present |
| idor | matrix covers every parent route with a path id; 0 leaks |
| security | cookie flags, throttle, CSRF header, headers, docs-off-in-prod all asserted |
| openapi | `contracts/openapi.json` regenerated → `git diff --exit-code` clean |
| virtual child | integration test: pair, run `--scenario stress --fast` for 90 s, then API shows ≥ 1 `stress_alert` alert, emotion buckets, app usage, session snapshot |
| logs | no `Traceback` or `ERROR` lines during the whole test run except from tests that deliberately trigger errors (assert by request_id) |
| lint | `ruff check` clean |
| placeholders | clean |
| regression | `make gate-1` |
**Verifier negative checks:** no cookie → 401; wrong CSRF header → 403; malformed batch → 422; 201-item batch → 413; revoked device → 401 and dashboard live shows `unpaired`.
Tag `phase-2-verified`.

---

## PHASE 3 — EMOTION MODEL (ML)
**Follow LEAN EDITION §6 exactly** (slices P3.1 → P3.7). Preconditions: `make gate-2` green; H3 or `BLOCKED_ON_H3`.
**Gate 3** = the checks in LEAN §6.8 (ml tests, dataset, detection ≥ 0.50, AUC ≥ 0.75, balanced accuracy ≥ 0.68, calibration/index bars, parity ≤ 1e-5, vectors reproduced exactly, JSON ≤ 20 KB, model card sections, no dataset/`.task` in git, `regression: make gate-2`).
Tag `phase-3-verified` (with `PASS_WITH_FALLBACK` allowed only as defined in LEAN §6.5).

---

## PHASE 4 — PARENT WEB DASHBOARD

**Goal:** the D1 deliverable at File 02 quality, lean scope (LEAN §1.3). Re-read File 02 §1–§3, §5–§7 first.

### P4.1 Scaffold, API client, serving
```
web/: Vite 5 + React 18.3 + TypeScript strict + Tailwind 3.4 + shadcn/ui (Radix) + TanStack Query v5 + React Router 6 + react-hook-form + zod
+ Recharts + lucide-react + sonner + @fontsource-variable/inter (self-hosted). Copy design/generated tokens into src/styles; extend Tailwind with the tokens.
`make web-types`: openapi-typescript from contracts/openapi.json -> src/lib/api-types.ts.
src/lib/api.ts: fetch wrapper with credentials:'include', X-Requested-With header, problem+json parsing into ApiError{code,status,requestId},
timeout 60 s, one retry with backoff+jitter for GET only, error-code -> friendly copy map from contracts/error_codes.md.
Vite dev proxy /api -> http://localhost:8000. API serves web/dist in production: StaticFiles + SPA fallback for non-/api paths
(cache: assets immutable, index.html no-cache). Tests: api.ts maps 401/409/422/429/network errors; production route /children/xyz returns index.html.
```
### P4.2 Shell and component kit
```
Layout per File 02 §3 (lean): sidebar 248 px, collapses to a top bar + sheet menu below 900 px; top bar has ChildSwitcher, alerts bell with unread count, account menu.
Build once with Vitest tests: Logo/OrbMark (SVG), StatusChip (icon+text), Kpi, Ring, Sparkline, EmptyState, ErrorState (message+Retry+copyable request id),
PageHeader, ConfirmDialog (type-to-confirm), PinInput (6 digits), DurationPicker, DataTable (sort, sticky header, card mode <640 px), Skeletons matching final layouts.
Assets in design/assets/: logo, 8 avatar orbs, empty-state and 404 SVGs (each < 8 KB), favicon set, manifest.
```
### P4.3 Auth and onboarding
```
/login, /register (timezone auto-detected via Intl, editable), split layout, blur validation with zod, strength meter, correct autocomplete attributes,
API error codes mapped to copy, RATE_LIMITED shows a live countdown from Retry-After. /onboarding (3 steps, resumable): add child -> set device PIN ->
pairing code (big 6 digits, 10-min countdown, "Generate new code", APK download button, install tips) with live polling until the device appears, then success state.
```
### P4.4 Overview
```
/ per File 02 §3.3 with lean scope: Live status card (state chip, remaining-time Ring, Calm Index gauge + 30-min sparkline, "Updated N s ago" turning amber when stale,
actions: Add time popover 5/10/15/30/custom, Lock now, End session, Start session with duration chips and disabled-with-reason states), Today KPIs, Calm timeline (area chart with
band shading and gaps as gaps), Alerts feed (latest 5), Top apps today. Data via TanStack Query with refetchInterval 5000 for /live and 15000 for the rest, paused when the tab is hidden.
Every card has loading, empty, error, stale variants. Alert badge also updates document.title.
```
### P4.5 Analytics
```
/children/:id/analytics with tabs: Emotion (day prev/next, timeline area chart with bands and session boundaries, distribution stacked bar of % time per label, stress episodes table),
Screen time (daily bars 7d/30d, per-app sortable table with blocked badge), Sessions (table; row expands inline to show ledger events with icons). Table view toggle for the main chart (accessibility).
Persistent non-scary disclaimer: "Facial-expression estimates are approximate and are not a medical or psychological assessment."
```
### P4.6 Alerts, settings, account, download, 404
```
/alerts inbox grouped by day, filters All/Unread/Critical, bulk mark read, humanised titles ("Aarav had a stressful stretch — a 5-minute breather was started").
/children/:id/settings per File 02 §3.5 minus cut items: Screen time is replaced by "Session defaults"; Rewards & cooldown with live "What this means" sentences; Sensitivity
(dual-handle slider with band preview, "Reset to recommended"); Monitoring toggles with plain-English consequences; Blocked apps (from reported apps); Device (permission health, Revoke);
Privacy (Delete history, Delete child with type-name confirm). Sticky save bar with unsaved-state. /account: profile, change device PIN (needs password). /download reads
web/public/apk.json {version,url,sha256,size} and shows install steps (Usage access + Display over other apps + camera; no restricted-settings steps). 404 page with orb illustration.
```
### P4.7 Tests and visual review
```
Vitest + Testing Library for components and forms (>= 40 tests). Playwright (against docker-compose API + seeded data, `make web-e2e`), exactly 3 tests:
(1) register -> onboarding shows a 6-digit pairing code; (2) login as demo -> Overview shows live status, KPIs and timeline; (3) alerts: unread badge -> open -> mark read -> badge clears.
Fail on any console error or page error. Run @axe-core/playwright on those 3 pages. Take screenshots at 390 px and 1440 px for Overview, Analytics/Emotion, Alerts, Settings, Onboarding
into verification/screenshots/web/. Score them with the File 02 §7 rubric into verification/ui-rubric-web.md (item, 0/1, note); fix and re-shoot until >= 80 %.
```
### GATE 4 — `make gate-4`
| Check | Bar |
|---|---|
| types | `tsc --noEmit` 0 errors; `make web-types` produces no diff |
| lint | eslint 0 warnings |
| unit | vitest all pass, ≥ 40 tests |
| build | `npm run build` ok; initial JS ≤ 400 KB gzip |
| e2e | 3 Playwright tests pass; 0 console/page errors |
| a11y | axe 0 critical/serious on the 3 pages |
| screenshots | ≥ 10 files present at both widths |
| rubric | `verification/ui-rubric-web.md` ≥ 80 % |
| contrast | `check_contrast.py` still passes |
| production serve | run the API with `ENV=production` and built dist; `curl /` returns HTML, `/api/v1/healthz`… OK, `/children/x` returns HTML |
| regression | `make gate-3` (or gate-2 if Phase 3 is `BLOCKED_ON_H3`) |
Tag `phase-4-verified`.

---

## PHASE 5 — CHILD ANDROID APP (Kotlin + Compose)

**Goal:** the D2 deliverable, in layers; **each layer works on a real phone before the next starts.** Re-read File 02 §4 and LEAN §1.1/§4 first.

### P5.0 Project scaffold (two-strikes applies)
```
Create android/ (package app.senseheaven.child, minSdk 26, targetSdk 34, compileSdk 34 or the latest stable that the chosen AGP supports).
Use the newest stable AGP + Kotlin 2.x + Compose BOM combination that the official Android release notes list as compatible; Gradle Kotlin DSL + version catalog.
isMinifyEnabled=false. Verify `./gradlew assembleDebug` is green BEFORE adding any feature dependency, then freeze versions. If not green after two distinct attempts: add H6 to SETUP_REQUIRED.md
(human creates the project from Android Studio's Empty Activity (Compose) template) and continue on Phase 6 docs while waiting.
Add build variant config: debug BASE_URL = http://<LAN-IP>:8000 (usesCleartextTraffic only in the debug manifest), release BASE_URL = https://<render-url> (from gradle property).
Gradle task `fetchModels` runs scripts/fetch_models.sh and copies face_landmarker.task + ml/artifacts/emotion_model.json to app/src/main/assets before assemble.
```
### 5a — Pairing, countdown, lock screen
```
Screens (Compose, tokens from design/generated/Tokens.kt, system font): Welcome & consent (3 cards, reachable later), Pair (custom 6-digit keypad, shake+haptic on error,
"Waking things up…" copy for cold start up to 90 s), Setup wizard (checklist: Camera, Notifications, Usage access, Display over other apps, optional battery exemption; re-check on ON_RESUME;
Continue disabled until required grants are green), Home (Locked = dusk gradient + sleeping orb + "Ask a parent" + "Call for help"; Active = daylight + big remaining-time ring; "Tap to begin" state when a start command is waiting).
Networking: Retrofit + OkHttp + kotlinx.serialization; timeouts 30 s connect / 60 s read; exponential backoff with jitter capped at 5 min; 401 DEVICE_REVOKED -> wipe local state -> unpaired screen.
SecureStore: device token and PIN verifier encrypted with an Android Keystore AES-GCM key; if that fails twice, fall back to DataStore and add a low-severity KNOWN_ISSUES entry.
PIN: verify locally with PBKDF2WithHmacSHA256 (iterations from the verifier), MessageDigest.isEqual, lockout after 5 wrong tries (15 min, doubling), never log the PIN.
GuardService (foreground, type camera, notification "SenseHeaven is keeping screen time healthy"): countdown via SystemClock.elapsedRealtime deltas (per-tick delta capped at 5 s), persisted every 5 s.
LockActivity: singleInstance, excludeFromRecents, showWhenLocked, turnScreenOn, back disabled, immersive; "Ask a parent" opens PIN sheet; "Call for help" fires ACTION_DIAL.
When status is not active/cooldown, GuardService polls every 1 s and brings LockActivity to front unless the foreground app is ours or the default dialer/emergency (needs Display over other apps to start from background).
```
**Layer accept (real phone + backend):** create code in web or via API → pair → `POST /children/{id}/sessions` (or `virtual` not applicable) → phone shows "Tap to begin" → countdown ticks → open another app → at zero LockActivity covers it → PIN unlock works; wrong PIN ×5 locks out; reboot mid-session restores time (no time counted while off).

### 5b — Usage stats and app blocking
```
UsageStatsManager.queryEvents poll every 1 s (last ~5 s window) to find the current foreground package (ACTIVITY_RESUMED/MOVE_TO_FOREGROUND). Ignore our package, launchers, systemui, default dialer.
Accumulate per package per local date only while a session is active; keep totals in memory + JSON queue; label via PackageManager with NameNotFoundException fallback to package name;
manifest <queries> with the LAUNCHER intent instead of QUERY_ALL_PACKAGES. Blocked packages from config: when foreground is blocked, show LockActivity variant "This app isn't available right now." (does not consume time).
Unit tests: package selection from a list of fake events, ignore list, day rollover, blocked detection.
```
**Accept:** using YouTube/Chrome for a minute produces seconds in the parent dashboard "Top apps"; blocking an app from the dashboard settings takes effect after the next sync.

### 5c — Camera, Face Landmarker, Calm Index
```
CameraX (front camera) inside GuardService (a LifecycleService) with ImageAnalysis STRATEGY_KEEP_ONLY_LATEST, throttled to 1 frame per second. Camera starts ONLY from a visible activity (tap-to-start) — File 01 D-11.
Per frame: convert ImageProxy -> Bitmap, rotate by imageInfo.rotationDegrees so the face is upright, build MPImage, run FaceLandmarker (IMAGE mode, numFaces=1, outputFaceBlendshapes=true) loaded from assets.
Map blendshape scores BY NAME into the order in contracts/feature_spec.json (copy it into assets), clamp to [0,1]. EmotionModel: load assets/emotion_model.json, validate feature_names, run forward pass exactly as ml/src/forward_ref.py (float32, floor(x+0.5) rounding).
Quality = min(size_score, light_score) per feature_spec. Valid sample = face present and quality >= 0.5. Calibration screen (30 s, breathing orb): baseline b = clamp(median p, default-0.25, default+0.25) if >= 15 valid frames else default.
Calm Index per File 01 §E4; emit one sample per second to the rules engine; no bitmap is ever written to disk, logged or uploaded (bitmap.recycle() after use).
Failure handling: camera busy/permission revoked -> camera_ok=false, runs freeze, retry with backoff, never punish; show "Monitoring paused" state with a fix button.
Unit tests: EmotionModel reproduces every vector in contracts/classifier_vectors.json (|p-expected|<=1e-4, ci exact); quality boundaries; baseline clamp; name->index mapping with a shuffled feature list.
```
**Accept:** on a real phone the Home screen (debug overlay text) shows a changing Calm Index; frowning lowers it, relaxed/smiling raises it; covering the camera freezes (no punishment).

### 5d — Rules engine, cooldown, bonus, penalty
```
RulesEngine: pure Kotlin, no Android imports. Implements File 01 §E4 minus the nudge and bedtime rules: EMA 0.2, hysteresis (stressed enter <35 leave >=40; calm enter >=70 leave <65), runs with 10-s reset and no-signal freeze (>120 s resets),
penalty -> cooldown (time not consumed, apps blocked) -> back to active, bonus with per-session cap, low_time notice at 300 s (once), commands add/remove time (never below 0, idempotent by command id), end/lock, expiry at remaining <= 0.
Inputs: tick(dtMs, ScreenState, CalmSample?) ; outputs: state + list of LedgerEvent. State serialisable to JSON and restored after restart/reboot (BootReceiver restarts GuardService).
CooldownScreen: LockActivity mode with breathing exercise (inhale 4 s, hold 4 s, exhale 6 s; orb scales 1.0->1.35; reduced-motion safe), copy from File 02 §4 ("Let's take a calm moment. Your time is safe while we pause.").
Home shows bonus/penalty chips with vector icons (no emoji), low-time notification at 5 min.
Tests (>= 15, pure JUnit): stress run >=300 s -> penalty + cooldown; cooldown does not consume time; calm run >=900 s -> bonus; bonus cap; penalty lockout 900 s; no-face freezes runs; >120 s no face resets; delta capped at 5 s;
remove_time never below 0; duplicate command ignored; expiry at 0; low_time fires once; persistence round-trip; hysteresis flapping (values oscillating around 35/40 don't flap); clock jump has no effect.
```
### 5e — Sync, queue, parent menu, debug tools
```
Sync loop: GET /device/sync every 10 s while a session is active, 15 s while locked, immediate on network-available callback; pass config_version and pin_version; apply config; handle commands
(start_session -> pending "tap to begin"; end/lock/add/remove/refresh_config) and ack each; exponential backoff with jitter.
Event queue: in-memory list persisted to a JSON file every 10 s, capped at 2000 (drop oldest emotion first); uploader sends <=200 items per POST every 10 s; delete only after 2xx; one emotion event per 10 s (mean of valid CI) and ledger/session snapshots on change; daily app totals every 60 s; heartbeat included.
Parent menu (PIN): Start session (15m/30m/1h/2h + stepper), Add/remove time, End session, Permission health, Unpair, About/How SenseHeaven works. Demo tools (hidden: PIN + long-press on version label): inject Calm Index (calm/stressed/none), fast-forward ±N min, force cooldown, force lock.
DEBUG-ONLY DebugReceiver (debug source set, not in release): broadcast actions app.senseheaven.debug.{PAIR --es code, INJECT --ei ci, FASTFORWARD --ei minutes, DUMP_STATE} that log one JSON line to logcat tag SH_DEBUG.
```
### P5.9 Android e2e (scripted) and static checks
```
scripts/e2e_android.sh: start compose API (ENV=development), create parent/child/PIN/pairing code via API, boot/attach AVD (API 34) or a USB device, install the debug APK, grant camera/notifications via `adb shell pm grant`,
usage access via `adb shell appops set app.senseheaven.child GET_USAGE_STATS allow`, overlay via `appops set ... SYSTEM_ALERT_WINDOW allow`, then drive with DebugReceiver:
pair -> API creates a 2-minute session -> tap-to-start via `adb shell input` or a debug START action -> INJECT ci=20 for enough fast-forwarded time -> assert via API: stress_alert alert exists, ledger has penalty + cooldown_start, session penalty_s > 0 ->
INJECT ci=90 + fast-forward -> assert bonus ledger -> fast-forward to zero -> assert session ended/expired and DUMP_STATE shows locked. Fail on any "FATAL EXCEPTION" or "ANR in" in logcat.
If no emulator can run locally, run the same script in GitHub Actions with an Android emulator runner; update android.yml accordingly.
```
### GATE 5 — `make gate-5` (+ `make gate-5-e2e`)
| Check | Bar |
|---|---|
| unit | `./gradlew testDebugUnitTest` all pass; ≥ 30 tests (≥ 15 engine, ≥ 6 model parity/quality, PIN, queue, backoff, usage) |
| lint | `./gradlew lintDebug` 0 errors |
| build | `assembleDebug` ok; APK ≤ 120 MB |
| permissions | `aapt2 dump badging` permissions ⊆ {CAMERA, POST_NOTIFICATIONS, INTERNET, ACCESS_NETWORK_STATE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, PACKAGE_USAGE_STATS, SYSTEM_ALERT_WINDOW, RECEIVE_BOOT_COMPLETED, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, VIBRATE}; no QUERY_ALL_PACKAGES, no ACCESSIBILITY binding |
| privacy static | grep finds no `Bitmap.compress`, `FileOutputStream`/`openFileOutput` inside the camera package, no logging of tokens/PIN |
| release manifest | no cleartext traffic in release; `isMinifyEnabled=false` |
| model parity | included in unit tests, reads `contracts/classifier_vectors.json` |
| e2e (`gate-5-e2e`) | script passes; logcat has 0 `FATAL EXCEPTION`/`ANR` |
| screenshots | emulator/device screenshots of Welcome, Pair, Setup, Locked, Active, Cooldown, PIN sheet saved to `verification/screenshots/android/`; scored in `verification/ui-rubric-android.md` ≥ 80 % (adapted: touch targets ≥ 48 dp, contrast, copy guide, no emoji) |
| regression | `make gate-4` |
**Verifier negative checks:** revoke device in the dashboard → app wipes and shows unpaired within two sync cycles; airplane mode mid-session → countdown and lock continue, queue drains after reconnect; deny camera → "Monitoring paused" and no penalty.
Tag `phase-5-verified`.

---

## PHASE 6 — INTEGRATION, EDGE CASES, DEVICE ACCEPTANCE

### P6.1 Full stack locally
```
`make up` runs db + API (serving web/dist). scripts/system_test.py: starts virtual_child with scenario stress against the live local API, then polls the dashboard API and asserts:
/live reflects device within 5 s; emotion-timeline has points; stress_alert appears in /alerts within the expected time under --fast; overview counters change; app-usage lists apps; session list contains ledger events.
Then run the same with scenario calm and assert a bonus ledger event and no alerts.
```
### P6.2 Edge-case coverage
```
docs/edge_case_coverage.md: table of the lean rows (see section X) -> test name or DEVICE_ACCEPTANCE_TEST step id. scripts check that every referenced test/step exists (grep). Write any missing tests now.
```
### P6.3 Device acceptance test document
```
docs/DEVICE_ACCEPTANCE_TEST.md with numbered steps A1..A20, each: action, expected result, PASS/FAIL box. Cover: setup wizard grants; pairing; tap-to-start; countdown; lock at zero over another app; PIN unlock; wrong PIN ×5 lockout;
camera notification/indicator visible; calm bonus (demo tools); stress penalty + breathing cooldown; app blocking from dashboard; app usage in dashboard; low-time notification at 5 min; reboot mid-session; airplane mode mid-session then reconnect;
revoke from web; emergency dial from lock screen; delete child history from web; battery-optimisation warning; consent screen reachable.
Record H5 results in verification/device-acceptance-<date>.md. Any FAIL is either fixed or logged in KNOWN_ISSUES.md with severity; no open HIGH.
```
### GATE 6 — `make gate-6`
| Check | Bar |
|---|---|
| system test | both scenarios pass; 0 `Traceback` in API logs |
| edge coverage | every lean row mapped; referenced tests/steps exist |
| acceptance doc | exists with A1..A20; `verification/device-acceptance-*.md` exists (else `BLOCKED_ON_H5` for this check only) |
| known issues | no open high |
| regression | `make gate-5` |
Tag `phase-6-verified`.

---

## PHASE 7 — DEPLOY (Render free web service + Neon free Postgres)

### P7.1 Container and blueprint
```
Dockerfile (multi-stage): node:20 builds web -> python:3.11-slim installs api/requirements.lock, copies web/dist, non-root user, `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers`.
.dockerignore. render.yaml: one web service (runtime docker, plan free, healthCheckPath /healthz), env: ENV=production, DATABASE_URL (sync:false), APP_SECRET and PAIRING_PEPPER (generateValue:true). No Render Postgres in the blueprint.
Startup must tolerate Neon cold start: retry the first DB connection for up to 60 s before failing readiness.
```
### P7.2 Deploy
```
If H2/H2b are available: deploy via Render API (scripts/render_deploy.py) or instruct the connected-repo path in docs/DEPLOYMENT.md; set DATABASE_URL from Neon (pooled, sslmode=require).
Verify free-tier facts at build time from docs (Render sleeps after ~15 min idle with ~30-60 s cold start; Neon free suspends compute after ~5 min idle) and record any change in DEPLOYMENT.md.
docs/DEPLOYMENT.md: exact steps, env var table, how to warm up (scripts/warm.sh curls /healthz until 200, up to 90 s), optional UptimeRobot ping only during demo week.
```
### P7.3 Android release
```
android.yml: on tag v* or manual: fetchModels, assembleDebug with BASE_URL=https://<render-url>, compute SHA-256 and size, create GitHub Release with the APK, and a commit updating web/public/apk.json {version,url,sha256,size}.
Debug-signed APK is acceptable for this project (document in DEPLOYMENT.md). Release variant must not allow cleartext traffic.
```
### P7.4 Smoke test against the LIVE URL
```
scripts/smoke_prod.py --base-url URL: wait for /healthz up to 90 s; /readyz; register-or-login fixed account smoke@senseheaven.app (password from SMOKE_PASSWORD secret);
create child (delete-history + delete-child at the end); set PIN; pairing code; pair as a device via API; sync; post an event batch including a stress_alert ledger event; check /live, overview and that the alert exists;
assert response headers (CSP, nosniff, Referrer-Policy, HSTS), cookie flags (Secure, HttpOnly, SameSite=Strict), HTTP->HTTPS redirect, and that /docs and /openapi.json return 404.
```
### GATE 7 — `make gate-7`
| Check | Bar |
|---|---|
| docker | `docker build` ok; container against compose DB serves SPA (`/`), `/api/v1/...` and `/healthz` |
| no dev leaks | image has no `.env`, `ml/data`, `.task` file |
| live smoke | `smoke_prod.py` passes (or `BLOCKED_ON_H2` for live checks only — local checks must still pass) |
| release | GitHub Release exists with the APK; SHA-256 equals `web/public/apk.json`; `aapt2` permissions still ⊆ allowlist |
| regression | `make gate-6` |
Tag `phase-7-verified`.

---

## PHASE 8 — DOCUMENTATION, REPORT, VIVA, FINAL ACCEPTANCE

### P8.1 Architecture and delta to the synopsis
```
docs/architecture.md: Mermaid diagrams — context (DFD-0), level 1 (child app modules, API, dashboard, Neon), ER diagram generated by scripts/gen_er.py from the SQLAlchemy metadata, deployment view, ML contract, privacy data flow (what leaves the device: aggregated Calm Index, app totals, ledger; never frames).
docs/synopsis_delta.md: table — synopsis promise | what was built | reason. Include: CNN 48×48 -> MediaPipe blendshapes + calibrated logistic model; Room local logs -> JSON queue + cloud aggregates; Android-only dashboard -> web dashboard; push alerts -> in-dashboard alerts; 7 emotion classes -> binary distress proxy + Calm Index; timer decay α(M) -> sustained-run penalty/bonus/cooldown; on-device inference retained; no biometric templates; PIN with salted hash retained.
```
### P8.2 Report, results, future work
```
docs/report/ chapters mirroring the synopsis (Introduction, Literature, Problem, Objectives/Method, FER + adaptive control, Requirements, Modules, DFD/ER/Use-case, Results & Testing, Limitations & Future work, References).
scripts/collect_results.py (deterministic) builds docs/report/results.md from ml/reports/*.json, verification/phase-*.json, coverage and UI rubric scores — real numbers only.
docs/future_work.md: compile every cut item from DECISIONS.md with a one-line rationale and the recommended next step (Device Owner provisioning, accessibility-based search safety, bedtime schedules, SSE/FCM, dark mode, child datasets with consent, LSTM on real sequences).
```
### P8.3 Viva prep and demo script
```
docs/viva_prep.md: >= 40 likely questions with 2–4 line answers grounded in this repo (ML choice and mapping, why binary, why blendshapes, Calm Index maths, hysteresis, privacy/DPDP, PIN hashing, tenant isolation, device authority and idempotency,
offline behaviour, why polling not push, free-tier trade-offs, what was cut and why, limitations of facial affect, demographic bias, how you would evaluate on children ethically).
docs/DEMO_SCRIPT.md: 8-minute script with timings (1: problem, 2: parent registers/pairs, 3: start session, 4: countdown + lock, 5: stress via camera + fallback via demo tools, 6: dashboard live + alert + timeline, 7: privacy claims + PIN, 8: limits/future),
pre-demo checklist (warm Render + Neon 10 minutes before, phone charged, permissions verified, seeded data, screen mirroring), and a Plan B (virtual_child + debug panel) if camera or network fails.
```
### P8.4 Clean-clone proof
```
On a fresh clone (CI job `final.yml` or a temp directory): run `make gate-upto N=8` and record the output. Fill docs/FINAL_CHECKLIST.md (below) with evidence links.
```
### GATE 8 — `make gate-8`
| Check | Bar |
|---|---|
| docs | all files in P8.1–P8.3 exist with the required headings; no placeholder text; every relative link resolves |
| results | `collect_results.py` twice → identical output |
| checklist | `docs/FINAL_CHECKLIST.md` all boxes ticked with evidence |
| clean clone | CI run green for gates 0–7 |
| known issues | none open with severity high |
| tags | `phase-0-verified` … `phase-8-verified` exist |
| regression | `make gate-7` |
Tag `phase-8-verified`, then `v1.0.0`.

### FINAL_CHECKLIST (lean) — copy into `docs/FINAL_CHECKLIST.md`
- [ ] `make gate-all` green from a clean clone (evidence: CI link)
- [ ] Live URL: `/healthz`, `/readyz`, SPA load, `smoke_prod.py` green
- [ ] Debug-signed APK in a GitHub Release; SHA-256 matches `web/public/apk.json`; permissions ⊆ allowlist
- [ ] Model card + evaluation committed; deployed `emotion_model.json` is the evaluated one (SHA-256 equal to `classifier_vectors.json`)
- [ ] Web rubric ≥ 80 %, axe 0 critical/serious, screenshots committed; Android rubric ≥ 80 %
- [ ] Device acceptance run recorded (H5), no open HIGH issue
- [ ] Docs complete: architecture, synopsis delta, report chapters, viva prep, demo script, deployment, future work
- [ ] Tags `phase-0-verified` … `phase-8-verified` and `v1.0.0`