# Independent Verifier report — Phase 2

Auditor mode (File 01 §G.2). All outputs pasted from real runs of 2026-09-30.

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 2)

The complete lean backend per File 01 §E2 as trimmed by LEAN §1.2: FastAPI app factory with
fail-fast config, normalised DB URL, request-id + security-header middleware, problem+json
errors with stable codes and request ids; the 10 lean tables with UUID PKs, UTC datetimes and
the specified unique/partial indexes; argon2id auth with throttling, JWT cookie
(HttpOnly/SameSite=Strict/Secure-in-prod) and the X-Requested-With guard; PBKDF2 device PIN
(210 000 iterations, `pin_version`); children CRUD + deep-merged, contract-validated settings
(`config_version` bump per PATCH); peppered single-use pairing codes; device pairing that
revokes the previous device; bearer device auth scoped to its own child; idempotent event
ingest (≤ 200 items, `ON CONFLICT DO NOTHING`, max() upserts, terminal-session guard,
stress_alert + permission-revoked alerts); command queue with 24 h expiry and idempotent ack;
live-state derivation; parent-tz analytics (overview, 1-min timeline with null gaps,
app-usage top-10, sessions with inline ledger); alerts inbox; delete-data; IDOR matrix over
every parent path route; seed_demo; virtual_child; committed OpenAPI snapshot; GATE 2 green
including gate-1 regression.

## 2. Existence check

`bash scripts/check_layout.sh` → `layout OK: all P0.1 paths exist` (via regression).
Key artefacts verified present: `api/app/{main,config,db,deps,problems,middleware}.py`,
`api/app/{models,schemas,routers,services}/…`, `api/tests/` (8 files, 73 tests),
`scripts/{seed_demo,virtual_child,reset_db,check_virtual_child}.py`,
`contracts/openapi.json` (33 paths), `api/requirements.lock` (42 pinned packages).

## 3. Execution check (final `make gate-2`, verdict PASS)

| Check | Result |
|---|---|
| tests | PASS — `73 passed` with `--cov-fail-under=60` (measured 88%) |
| no-skips | PASS — no skip markers in `api/tests/` |
| idor | PASS — matrix test covers every OpenAPI path with a path id; 0 leaks |
| security | PASS — test_security + test_auth + test_health all green |
| openapi | PASS — `make contract-export` → `git diff --exit-code` clean |
| virtual child | PASS — `{"stress_alerts": 1, "timeline_points": 1, "sessions": 1, "overview": {"stress_episodes": 1, "screen_time_s": 300, "sessions_count": 1}}`; server log free of Traceback/ERROR |
| lint | PASS — `ruff check` clean on `api/` and `scripts/` |
| placeholders | PASS |
| regression: previous gate | PASS — full gate-1 re-run green |

## 4. Output correctness (expected vs observed)

- `POST /device/events` replay returns `accepted: {emotion: 0, ledger: 0}` and
  `duplicates == 3` with unchanged DB row counts (idempotency proven, not assumed).
- `used_s` stays 150 across snapshots (100 → heartbeat 150 → snapshot 120 → heartbeat 90).
- A snapshot setting `status: "ended"` cannot be reverted to `active`; server keeps
  `ended`/`end_reason`.
- stress_alert ledger events dedupe to exactly one alert per session per 10-minute bucket
  (1, 1, 2 across three buckets); permission loss dedupes per device per grant per day.
- Timeline buckets: 1440 per local day, gaps `null`; the Berlin spring-forward day
  (2026-03-29) yields 1440 buckets with correct +01:00/+02:00 local labels
  (`tests/test_analytics.py::test_timeline_handles_dst_transition_day`).
- Cookie flags on `Set-Cookie`: `HttpOnly`, `SameSite=Strict`, no `Secure` outside production.

## 5. Negative checks (must fail *safely* — live server, real output)

```
NEG1 no-cookie GET /children -> 401 UNAUTHENTICATED (expect 401 UNAUTHENTICATED)
NEG2 wrong-X-Requested-With -> 403 CSRF_HEADER_MISSING (expect 403 CSRF_HEADER_MISSING)
NEG3 malformed batch -> 422 VALIDATION_ERROR (expect 422 VALIDATION_ERROR)
NEG4 201-item batch -> 413 BATCH_TOO_LARGE (expect 413 BATCH_TOO_LARGE)
NEG5 revoked device sync -> 401 DEVICE_REVOKED (expect 401 DEVICE_REVOKED); live state -> unpaired (expect unpaired)
```
All five failed safely with the contract's stable codes; no stack traces leaked.

## 6. Regression re-run of the previous phase gate

Executed as gate-2's final check: gate-1 fully green (error codes, settings schema, tokens,
contrast, placeholders) including gate-0. One gate-2 failure cycle (lint in the new test)
was logged and fixed — see `verification/failure-phase-2-2026-09-30.md`.

## 7. Verdict

✅ **PASS** — no check skipped, loosened, or unverified. Ready for tag `phase-2-verified`.
