# SENSEHEAVEN v2 — LEAN EDITION (4th-year, free-tier, vibe-coding friendly)

**How to use:** paste this file **after** Files 01 and 02 (and before File 03). **Anything here overrides Files 01–02 on conflict.** Sections 1–5 are the overrides. Section 6 is a spoon-fed **Phase 3 (ML)** that replaces the earlier long Phase 3. Nothing else in Files 01–02 needs rewriting.

**Principle:** a smaller thing that works on a real phone in the viva beats a big thing that half works. Every feature below is either KEEP, SIMPLIFY or CUT. Cut items go to `docs/future_work.md` (they become "Future Work" in the report, which is normal and respectable).

---

## 1. FEATURE TRIAGE (the decision table)

### 1.1 Child Android app
| Feature | Verdict | Why / replacement |
|---|---|---|
| Pairing by 6-digit code | KEEP | Simple, demo-friendly |
| Countdown + lock screen | KEEP | Core |
| Camera foreground service + MediaPipe Face Landmarker → Calm Index | KEEP (core risk) | Sample **1 frame/s**, screen on only. Start from a visible screen (tap-to-start, D-11) |
| Cooldown (breathing screen), bonus, penalty | KEEP | This is the "adaptive" part of the project |
| Per-child baseline calibration | SIMPLIFY | **30 s** instead of 60 s; needs ≥ 15 valid frames, else use default |
| Foreground-app detection | SIMPLIFY | **UsageStatsManager** polling every 1 s (permission: Usage access). No AccessibilityService |
| Lock mechanism | SIMPLIFY | Foreground service launches a full-screen **`LockActivity`** (needs "Display over other apps" so background launch is allowed). **No Compose overlay windows** (lifecycle/ViewTree bugs) |
| AccessibilityService, "restricted settings" flow | **CUT** | Biggest source of OEM/Android-13+ pain |
| Search/URL capture, keyword flags, encrypted queries | **CUT** | Depends on Accessibility; also a privacy liability |
| Device-admin / uninstall guard / settings-page PIN interception | **CUT** | Document as a limitation. Future work: Android Enterprise / Device Owner |
| Bedtime windows, DST logic, daily limit | **CUT** | Timezone bugs; sessions with explicit durations are enough |
| "Nudge after 2 min" child message | CUT | Extra rule, little demo value |
| Room database + outbox | SIMPLIFY | Replace with a **JSON-file queue** (in-memory list, saved every 10 s, capped at 2 000 items). Avoids KSP/Kotlin version mismatch |
| App usage logging | SIMPLIFY | **Daily per-app totals** (package, seconds), not per-interval rows |
| Blocked apps | SIMPLIFY | Parent toggles block on apps the device has *already reported*. Same 1-s poller enforces it |
| Battery/OEM keep-alive | SIMPLIFY | One screen + tips text; demo on **one** known device |
| Themes/fonts | SIMPLIFY | System font, two colour states (locked = dusk, active = daylight) |
| Demo/debug panel (inject score, fast-forward, force cooldown) | **KEEP — mandatory** | It is how you test without a face and without waiting hours |

**Grants the child app now needs (4):** Camera, Notifications, Usage access, Display over other apps (+ optional battery exemption). No restricted-settings dance.

### 1.2 API / backend
| Feature | Verdict | Replacement |
|---|---|---|
| SSE live stream | **CUT** | Dashboard polls every 5 s (TanStack Query `refetchInterval`) |
| Email alerts, FCM, Firebase | CUT | In-dashboard alerts + unread badge in tab title |
| Alembic migrations | **CUT** | `Base.metadata.create_all()` at startup + `scripts/reset_db.py` for dev. Freeze schema at end of Phase 2 |
| Server-side sessions table, CSRF double-submit, "revoke web sessions" | SIMPLIFY | Signed JWT in **HttpOnly, SameSite=Strict, Secure** cookie (14 days) + require `X-Requested-With: senseheaven` header on mutating calls |
| Field-level AES-GCM | CUT | Only needed for search capture |
| Retention background job, audit log, CSV export | CUT | "Delete history" and "Delete child" buttons remain (privacy claim) |
| Device-offline alerts (background scan) | CUT | Dashboard shows "Last seen N min ago" banner (computed on read) |
| Rate limiting | SIMPLIFY | 20-line in-memory limiter for login and pairing only |
| Security headers | SIMPLIFY | One middleware: CSP (`default-src 'self'`), `nosniff`, `Referrer-Policy: no-referrer`, HSTS in prod |
| Argon2 password hashing, device PIN PBKDF2 verifier, 6-digit pairing code hashed, tenant isolation (404 on cross-tenant) | **KEEP** | These are your Cyber-Security marks. Keep the IDOR test |

**Lean data model (10 tables):** `parents`, `children` (with a `settings` **JSONB** column instead of a 25-column table), `pairing_codes`, `devices`, `screen_sessions`, `emotion_events`, `ledger_events`, `app_usage_daily` (child_id, date, package, seconds; upsert with max), `alerts`, `commands`. Idempotent uploads stay: `client_uuid` + `UNIQUE(child_id, client_uuid)` + `ON CONFLICT DO NOTHING`.

**Lean API:** keep everything in File 01 §E2 **except** `/stream`, `/searches`, `/export`, `DELETE /parents/me`, `/emotion-heatmap`, `PUT /parents/me/password`, `GET /sessions/{id}`. Sessions list returns ledger events inline.

**Rules engine (device-authoritative):** keep File 01 §E4 (EMA, hysteresis, runs, penalty → cooldown, bonus, low-time at 5 min, commands) **minus** the nudge rule and bedtime rule. **No Python reference implementation and no 80 golden vectors.** Replace with ≥ 15 hand-written Kotlin unit tests (pure Kotlin class, no Android imports) covering: stress → penalty, cooldown doesn't consume time, calm → bonus, bonus cap, no-face freezes runs, clock deltas capped at 5 s, remove-time never below 0, restart restores state.

### 1.3 Web dashboard
| Feature | Verdict |
|---|---|
| Dark mode, Fraunces font, command palette, bottom tab bar | **CUT** (light theme, Inter only; sidebar collapses to a top sheet menu on mobile) |
| Heatmap, Searches tab, Session detail *page* | CUT (session row expands inline) |
| Onboarding | SIMPLIFY to 3 steps: add child → set device PIN → pairing code + "waiting for device" |
| Pages | Login/Register · Onboarding · Overview · Analytics (tabs: Emotion, Screen time, Sessions) · Alerts · Child settings · Account (PIN) · Download · 404 |
| Charts | Recharts `AreaChart` (timeline), `BarChart` (apps, daily time, distribution). Nothing else |
| Components | shadcn/ui primitives (Card, Button, Dialog, Tabs, Table, Slider, Skeleton, Sonner toast) + your own: `StatusChip`, `Kpi`, `Ring`, `EmptyState`, `ErrorState`, `PageHeader`, `ChildSwitcher`, `ConfirmDialog`, `PinInput`, `DurationPicker` |
| UI rubric (File 02 §7) | Keep, pass mark lowered to **≥ 80 %** |
| Keep from File 02 | Tokens (light only), copy guide, required states (loading/empty/error/stale), a11y basics, mood orb brand motif |

### 1.4 Testing and gates (lean)
| File 01 item | Lean version |
|---|---|
| API coverage 85 % | **60 %**, but 100 % of the **security tests**: login throttle, wrong password, cookie flags, IDOR matrix, device-token scope, pairing code single-use/expiry |
| Hypothesis, OpenAPI snapshot diff, Locust/k6, Lighthouse CI, gitleaks, mypy, detekt | **CUT** (keep `ruff`, `eslint`, `tsc`, `no_placeholders.sh`) |
| Playwright | **3 tests**: register→onboarding, login→overview with seeded data, alerts read/unread. axe on those 3 pages: 0 critical |
| Android | JUnit for the rules engine, PIN verifier, feature→CI mapping, JSON queue. One emulator e2e using the debug panel |
| Post-deploy | `smoke_prod.sh`: healthz, register/login, create child, pairing code, pair via API, post events, read overview, cleanup |
| Final checklist | "phase-0..8 verified" tags, live URL smoke green, APK in Release, `KNOWN_ISSUES.md` has no open **high** items |

**"Zero errors" wording stays honest:** *zero known defects at the gate*, not a proof of no bugs.

---

## 2. FREE-TIER STACK (checked against current docs, Sept 2026)

| Piece | Choice | Limits you must design around |
|---|---|---|
| API + web | **Render free Web Service** (Docker) | Sleeps after ~15 min idle; cold start ~30–60 s; 512 MB RAM; monthly free instance-hour cap; **no cron/workers** |
| Database | **Neon free Postgres** (NOT Render Postgres) | Render's free Postgres **expires 30 days after creation** (docs: render.com/docs/free) — it would die before your viva. Neon free: ~0.5 GB, 100 CU-hours/month, compute suspends after 5 min idle (adds ~1 s on first query) |
| CI + APK hosting | GitHub Actions + GitHub Releases | Free for public repos; private repos have a monthly minutes allowance (check current number). Ship the **debug-signed APK** (fine for a demo; skip release keystores) |
| Android build | Android Studio + emulator locally; CI is a backup | — |
| Keep-warm | Optional UptimeRobot free ping on `/healthz` **only in demo week** | Don't burn instance hours all semester |

**Config rules:** `DATABASE_URL` from Neon (use the **pooled** host, `sslmode=require`), normalise to `postgresql+psycopg://`, create engine with `pool_pre_ping=True`, `pool_recycle=300`, `connect_args={"prepare_threshold": None}` (PgBouncer-safe). All timeouts on the phone and web ≥ 60 s for first request (File 01 G18 stays).

---

## 3. LEAN PHASE MAP (replaces "phase-0..9")

| Phase | Deliverable | Cut-line if time runs out |
|---|---|---|
| 0 | Repo, Makefile, docker-compose (local Postgres), CI, `PROGRESS.md` | — |
| 1 | `contracts/` (error codes, feature spec stub) + `design/tokens.json` + generated CSS/Kotlin tokens | — |
| 2 | **API core** + tests + `seed_demo.py` + `virtual_child.py` | Drop analytics endpoints except overview + timeline + apps |
| 3 | **ML model** (Section 6) | Ship heuristic scorer |
| 4 | **Web dashboard** | Drop Sessions tab |
| 5 | **Android child app** in layers 5a→5e (Section 4) | Drop 5d bonus (keep penalty) |
| 6 | Integration on real phone + virtual child | — |
| 7 | Deploy (Render + Neon) + APK Release + smoke | — |
| 8 | Docs, report skeleton, viva prep, demo script | — |

**MUST list (viva demo depends on these; everything else is negotiable):** pair → remote start → countdown → lock at zero → camera Calm Index → penalty + breathing cooldown → dashboard live status + emotion timeline + alert → PIN unlock on device → top apps.

---

## 4. VIBE-CODING PROTOCOL (how to actually get it built without drowning)

1. **Slices, not phases.** One prompt = one small thing with one acceptance command. Template:
```
CONTEXT: read docs/spec/ (Files 01, 02, LEAN). Phase <N>, slice <id>.
TASK: <one thing>.
FILES YOU MAY TOUCH: <list>. Touch nothing else. No new dependencies unless listed here: <list>.
ACCEPTANCE: run `<command>`; expected: <exact output/behaviour>.
WHEN DONE: commit "<type>: <what>" and stop. Do not start the next slice.
```
2. **Error prompt (use it every time something breaks):** "Here is the full error and the file. First explain the root cause in 3 lines. Then propose the smallest fix. Do not change unrelated code. Do not add try/except to hide it."
3. **Two-strikes rule:** a feature that fails **two** distinct fix attempts, or eats **4 working hours**, is cut or simplified. Move it to `docs/future_work.md`, delete its code and UI, add one line to `DECISIONS.md`. No guilt, no debate.
4. **Android scaffold by hand once:** create the project with Android Studio's "Empty Activity (Compose)" template so Gradle/AGP/Kotlin/Compose versions are a known-good set. Then commit and never let the agent upgrade versions. Add MediaPipe `tasks-vision` and CameraX only in slice 5c.
5. **Android layers (each must work on your real phone before the next starts):** 5a pairing + countdown + `LockActivity` · 5b usage stats poller + app blocking · 5c camera service + Face Landmarker + Calm Index on screen · 5d rules engine (penalty, cooldown, bonus) · 5e sync/upload queue + demo panel.
6. **Test the phone against the real backend from day one of Phase 5** (`virtual_child.py` and seed data already exist from Phase 2), using your laptop's LAN IP over HTTP in a debug build; switch to the Render URL in Phase 7.
7. **Never let the agent "fix" a red check by editing the check.** Same as File 01 G3.
8. **One conversation per slice** when the agent starts looping; paste the slice prompt again plus the current error only.

---

## 5. HOW TO PRESENT THE CUTS (viva)

| Cut | Say this |
|---|---|
| No accessibility/search capture | "We deliberately excluded content capture: it needs a high-privilege service, and monitoring a minor's searches conflicts with our data-minimisation goal (DPDP Act 2023)." |
| No uninstall guard | "Android does not allow ordinary apps to be uninstall-proof. Production solution is Device Owner provisioning; listed as future work." |
| No SSE / FCM | "Polling every 5 s gives a near-live dashboard at zero infrastructure cost." |
| Linear model, no CNN/LSTM | "We use MediaPipe landmarks → blendshapes → calibrated logistic model. Small, explainable, runs on-device, and evaluated with a proper held-out set." |
| No bedtime/daily limit | "Session-based control was chosen; scheduling is future work." |

---

## 6. PHASE 3 (LEAN) — EMOTION MODEL, SPOON-FED

**Goal:** turn one Face Landmarker blendshape vector into `p = distress-likelihood`, map to the **Calm Index 0–100** exactly as File 01 §E4, export as one small JSON the Kotlin app can run. It is a facial-expression **proxy**, not a stress detector or medical tool.

**Fits Files 01–02:** D-5 (JSON weights + tiny forward pass), D-6 (same `.task` file in training and on device), D-7 (binary calm vs distress + per-child baseline), D-8 (no LSTM). It **replaces** MLP/HistGB/simulation from the long Phase 3 with a single logistic model, which is far easier to debug and still explainable.

### 6.0 Preconditions
`make gate-2` green. **H3:** Kaggle credentials (`KAGGLE_USERNAME`, `KAGGLE_KEY`) or FER2013 placed in `ml/data/fer2013/`. If missing, write the exact commands in `SETUP_REQUIRED.md`, finish the code and unit tests that don't need data, mark the gate `BLOCKED_ON_H3`, and do not fake data.

### 6.1 Frozen decisions for this phase
| Item | Value |
|---|---|
| Labels | `distress` = angry, fear, sad · `calm` = happy, neutral · excluded = surprise, disgust |
| Data size | Up to **6 000 images per binary class** from the training pool (seeded), plus the dataset's test set for the final test. Keeps extraction to ~10–20 min |
| Splits | Test = dataset's own test set (touched once). Train/val = 85/15 stratified split of the rest, seed `20260928`. Exact-duplicate pixel hashes dropped; a hash present in two splits stays in train only |
| Model | `StandardScaler` + `LogisticRegression` (L2, `C` chosen from {0.01, 0.1, 1, 10} on validation, class-balanced). A hand-weighted **heuristic H** is the fallback and a sanity baseline |
| Output | `ml/artifacts/emotion_model.json` (≤ 20 KB) |

### 6.2 Slice P3.1 — Environment and model file
**Prompt to the agent:**
```
Create ml/ with a Python 3.11 venv (ml/.venv). requirements.txt: mediapipe, scikit-learn, numpy, pandas,
opencv-python-headless, matplotlib, pytest, kaggle, tqdm. Install, then pip freeze > ml/requirements.lock.
Create scripts/fetch_models.sh (idempotent) that downloads
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
to ml/artifacts/face_landmarker.task. First `curl -sI` the URL; if not HTTP 200, search current MediaPipe Face
Landmarker docs for the new URL and log it in DECISIONS.md. Compute SHA-256, store it in contracts/feature_spec.json
as task_sha256, and store mediapipe_version. Later runs must verify the hash and fail on mismatch.
Git-ignore the .task file and ml/data/. Create ml/src/config.py with SEED=20260928 and all paths.
Add Makefile targets: ml-setup ml-data ml-features ml-train ml-eval ml-export ml-vectors ml-test gate-3.
```
**Acceptance:** `ml/.venv/bin/python -c "import mediapipe, sklearn; print(mediapipe.__version__)"` prints a version; `sh scripts/fetch_models.sh` twice → second run says "hash OK"; `git status` shows no `.task` file.

### 6.3 Slice P3.2 — Dataset index, dedupe, split
**Prompt:**
```
Download FER2013: `kaggle datasets download -d msambare/fer2013 -p ml/data/ --unzip` (verify the slug exists; if not,
find a FER2013 mirror and log it in DECISIONS.md). Write ml/src/dataset_index.py that supports either an image-folder
layout (train/<emotion>/*, test/<emotion>/*) or fer2013.csv, and outputs a table (path_or_row, label7, source_split, md5).
Drop exact duplicate md5 within a split; if an md5 appears in more than one split keep it only in train. Map labels using
the frozen label map (distress: angry,fear,sad; calm: happy,neutral; drop surprise, disgust). Sample up to 6000 images per
binary class from the train pool with the seed. Write ml/reports/dataset_index.json with counts before/after dedup, per class
and per split. Add ml/tests/test_dataset_index.py: no md5 shared across splits; only labels calm/distress remain.
```
**Acceptance:** `make ml-test` passes; `dataset_index.json` shows cross-split duplicates = 0 and ≥ 10 000 images total in train+val.

### 6.4 Slice P3.3 — Preprocess pilot and feature extraction
**Prompt:**
```
Write ml/src/preprocess.py: prepare(img48) -> RGB uint8: grayscale→3 channels, constant border pad of pad_frac*size, then
cv2.INTER_CUBIC upscale to S×S. Pilot on 300 random train images the grid pad_frac in {0,0.25,0.4} × S in {256,384};
choose the combo with the highest face-detection rate; save the winner in contracts/feature_spec.json→preprocess and the
grid results in ml/reports/preprocess_pilot.json.
Write ml/src/extract_features.py using MediaPipe Tasks:
  from mediapipe.tasks import python as mp_python
  from mediapipe.tasks.python import vision
  opts = vision.FaceLandmarkerOptions(
      base_options=mp_python.BaseOptions(model_asset_path="ml/artifacts/face_landmarker.task"),
      running_mode=vision.RunningMode.IMAGE, num_faces=1, output_face_blendshapes=True,
      min_face_detection_confidence=0.3, min_face_presence_confidence=0.3)
  lm = vision.FaceLandmarker.create_from_options(opts)
  res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
  cats = res.face_blendshapes[0] if res.face_blendshapes else None   # list of Category(category_name, score)
Read feature NAMES AND ORDER from the first successful result (drop "_neutral" if present); never hard-code the count.
Save them to contracts/feature_spec.json (feature_names, n_features). Output ml/data/features/{train,val,test}.npz with
X float32, y_bin, y7, detected, md5. Make it resumable (checkpoint every 1000 images) and idempotent. Write
ml/reports/detection.json (detection rate per split and per original class).
Tests: same 10 images twice → identical features; values finite in [0,1]; a blank image → detected=False, no crash.
```
**Acceptance:** `make ml-features` finishes; `detection.json` overall detection rate ≥ **0.50**; ≥ 8 000 detected training samples. *If detection is < 0.50:* re-run the pilot with `min_face_detection_confidence=0.2` and `pad_frac` 0.5; still low → log it, continue with whatever is detected (≥ 4 000 samples), note the selection-bias caveat in the model card.

### 6.5 Slice P3.4 — Train, heuristic, evaluate
**Prompt:**
```
ml/src/train.py: load features. Augment TRAIN ONLY with left/right flips (swap every feature pair whose names end in
Left/Right). Fit StandardScaler on train; LogisticRegression(class_weight="balanced", max_iter=2000) for C in
{0.01,0.1,1,10}; pick C by validation ROC-AUC. Also implement heuristic H: a fixed weighted sum of blendshapes
(browDown_L/R, browInnerUp, mouthFrown_L/R, eyeSquint_L/R, minus mouthSmile_L/R), min-max scaled on train to [0,1].
ml/src/evaluate.py (run on the TEST split once the model is frozen): ROC-AUC with a 500-sample bootstrap 95% CI,
balanced accuracy at threshold 0.5, Brier score, ECE (10 bins), distress recall and calm false-alarm at p>0.5, a table
comparing LR vs H, figures roc.png / calibration.png / confusion.png, and a per-original-class table (angry, fear, sad,
happy, neutral, plus surprise/disgust for information only). Write ml/reports/evaluation.json.
```
**Acceptance / bars (test split):** ROC-AUC ≥ **0.75**, balanced accuracy ≥ **0.68**, distress recall ≥ 0.60, calm false-alarm ≤ 0.35. ECE is reported (no bar).
**If a bar is missed (max 3 distinct attempts):** (1) add aggregate features (mean of left/right pairs, brow aggregate, mouth aggregate); (2) rerun the preprocess pilot with another size/pad; (3) try `C` finer grid. Still below: if AUC ≥ 0.70 ship it with `"tier":"limited"` and a **low**-severity `KNOWN_ISSUES.md` entry (measured numbers + "app relies on smoothing, baseline and long sustained windows"); if AUC < 0.70 ship **H** labelled `"tier":"heuristic"` and say so in the report. Never edit the bars.

### 6.6 Slice P3.5 — Calm Index mapping and quality score
**Prompt:**
```
ml/src/calibrate_index.py (use VALIDATION only): default_baseline = median p of calm-class validation samples.
Grid anchor in {72,75,78}, slope in {100,120,150,180}. ci = clamp(floor(anchor - slope*(p - baseline) + 0.5), 0, 100)
(use floor(x+0.5), never Python round()). Choose the pair that satisfies P(ci<35 | distress) >= 0.45 and
P(ci>=70 | calm) >= 0.50 and P(ci<35 | calm) <= 0.15, then maximises the sum of the first two. Store baseline_clamp=0.25:
on the phone b = clamp(median_p_of_calibration, default-0.25, default+0.25); calibration needs >=15 valid frames in 30 s.
Report the chosen pair's rates on TEST once (no re-tuning).
Also define quality in contracts/feature_spec.json: quality = min(size_score, light_score), where
size_score = clamp((face_bbox_area/frame_area - 0.04)/0.08, 0, 1) and light_score = 1 if 40 <= mean_luma <= 220 else 0.3.
Implement ml/src/quality_ref.py + unit tests at the boundaries.
```
**Acceptance:** `ml/reports/calibration.json` shows the chosen pair and validation rates meeting the three conditions; test rates: P(ci<35|distress) ≥ 0.40, P(ci≥70|calm) ≥ 0.45, P(ci<35|calm) ≤ 0.20.

### 6.7 Slice P3.6 — Export, forward reference, vectors
**Prompt:**
```
ml/src/forward_ref.py (float32 numpy, no sklearn):
  z = (x - mean) / max(std, 1e-3); logit = z @ w + b; p = sigmoid(logit)   # stable sigmoid
  ci = clamp(floor(anchor - slope*(p - baseline) + 0.5), 0, 100)
Inputs are clamped to [0,1] first; wrong length or non-finite input raises a clear error.
ml/src/export_json.py writes ml/artifacts/emotion_model.json (canonical: sort_keys, compact separators, floats rounded to
float32 via float(np.float32(v))):
{ "schema_version":1, "model_id":"...", "tier":"normal|limited|heuristic", "feature_names":[...],
  "mean":[...], "std":[...], "weights":[...], "bias":0.0,
  "calm_index":{"anchor":75,"slope":120,"default_baseline":0.0,"baseline_clamp":0.25},
  "training":{"dataset":"FER2013","label_map":{...},"seed":20260928,"mediapipe_version":"...","task_sha256":"..."} }
If tier is heuristic, weights/mean/std encode H so the Kotlin forward pass is identical.
Add a loader/validator that rejects wrong shapes, non-finite numbers, and feature names not equal to contracts/feature_spec.json.
ml/src/make_vectors.py writes contracts/classifier_vectors.json with >= 60 vectors: 30 real TEST feature rows (numbers only,
no images), 10 extremes (all 0, all 1, seeded uniform random), 20 with baselines {default,0.10,0.30,0.55}.
Each has features, expected_p, expected_ci per baseline. DROP any vector where anchor - slope*(p-b) + 0.5 is within 0.01 of
an integer. Top level: model_sha256, tolerance_p=1e-4, ci_exact=true.
Test: forward_ref vs sklearn (float64) max abs diff on ALL test rows <= 1e-5.
```
**Acceptance:** parity test passes; every vector's `ci` reproduced exactly by `forward_ref`; `model_sha256` matches `sha256sum ml/artifacts/emotion_model.json`.

### 6.8 Slice P3.7 — Model card, gate, verifier, tag
**Prompt:**
```
Write ml/MODEL_CARD.md with sections: Intended use · Out of scope (medical/psychological assessment; punishment from a
single reading; use on someone not informed) · Data (FER2013, mapping, exclusions, dedup, research-use licence caveat) ·
Method (blendshapes, logistic model, Calm Index, baseline) · Results (tables + figures from evaluation.json) ·
Limitations (adult web images vs children; low-res grayscale training vs colour phone frames; label noise; demographic
and cultural variation; lighting/glasses/occlusion; detected-face selection bias) · Privacy (no frames stored/sent; only a
Calm Index leaves the device) · Ethics (parent wording "elevated stress signals", child wording never says stressed/angry;
consent screen) · Reproduction commands · Versions and hashes.
Implement `make gate-3` (writes verification/phase-3.json) running: ml tests, dataset check, detection check, the bars in
6.5 and 6.6, parity, vector reproduction, JSON validity and size <= 20 KB, model card sections present, ruff clean,
no_placeholders clean, no dataset or .task file tracked by git, and `make gate-2` still green.
Then produce verification/report-phase-3.md with pasted real output including NEGATIVE checks: delete ml/data/fer2013 →
clear H3 message; wrong-length feature vector → clear error; NaN feature → clear error; alter one weight by 1e-3 → parity
test FAILS; change the .task hash → fetch_models.sh FAILS. Commit "feat(ml): emotion model — Verified: phase 3 gate green"
and tag phase-3-verified.
```
**Acceptance:** `make gate-3` exits 0; `verification/phase-3.json` verdict `PASS` (or `PASS_WITH_FALLBACK` with the `KNOWN_ISSUES.md` entry).

### 6.9 Handoff to Phase 5 (Android)
- Use the **same `.task` file** (`fetch_models.sh` verifies the hash in CI). Read blendshape scores **by name** and put them in the order of `feature_spec.json`.
- Kotlin unit test: load `emotion_model.json`, run every vector, require `|p − expected_p| ≤ 1e-4` and exact `ci`.
- Debug panel "inject Calm Index" bypasses the model entirely, so rules can be tested without a face.
- Any change to model, preprocessing, mapping or constants → regenerate vectors and re-run `make gate-3`.