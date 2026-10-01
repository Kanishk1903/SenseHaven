# Independent Verifier report — Phase 6

Auditor mode (File 01 §G.2). Real runs of 2026-10-01/02.

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 6)

P6.1: `scripts/system_test.py` drives the real API with the virtual child in both scenarios
and asserts the dashboard reflects everything within the expected window. P6.2:
`docs/edge_case_coverage.md` maps every remaining lean E6 row to a named test or acceptance
step, with a checker asserting the mapping and that referenced tests exist. P6.3:
`docs/DEVICE_ACCEPTANCE_TEST.md` with numbered steps A1..A20; H5 (real-phone run) recorded
separately. GATE 6 green including the gate-5 regression.

## 2. Existence check

`scripts/system_test.py`, `docs/edge_case_coverage.md` (14 rows mapped),
`docs/DEVICE_ACCEPTANCE_TEST.md` (A1..A20 + run-record table),
`scripts/check_gate6_docs.py`, `scripts/gates/gate-6.sh`.

## 3. Execution check (final `make gate-6`, verdict PASS, exit 0)

| Check | Result |
|---|---|
| system test | PASS — stress: `stress_alerts 1, timeline_points 2, overview {stress_episodes 1, screen_time_s 780}`; calm: `bonus true, stress_alerts 0` |
| edge coverage | PASS — rows 1,2,3,4,5,6,9,10,11,14,15,17,18,20 all mapped to named proof |
| acceptance doc | PASS — A1..A20 present (20 steps) |
| known issues | PASS — none open at medium+ (KI-1 low/environment) |
| regression | PASS — full gate-5 chain green incl. the live emulator e2e |

## 4. Output correctness (expected vs observed)

- Stress scenario: the virtual child paired itself, ran ci=20 sustained → the server created
  the stress alert with the humanised title; overview `stress_episodes=1`,
  `screen_time_s=780`; timeline has real (non-null) buckets; session ledger present.
- Calm scenario: a bonus ledger event appeared; **zero** stress alerts for that child —
  proving the adaptive loop discriminates between the two regimes.
- The e2e inside regression: `stress_alert` + `penalty_s 300` + `cooldown_start` + `bonus`
  + locked-end with clean logcat (from the Android app on the emulator).

## 5. Negative checks (must fail *safely*)

- Calm scenario asserting NO stress alerts is itself a negative check (opposite regime →
  opposite outcome, same pipeline).
- `check_gate6_docs.py edge` exits non-zero if any required row is unmapped (verified by
  construction: the checker asserts against a fixed required set).
- Earlier chained runs failed safely when the emulator died (environment) — recorded in
  `verification/fail-phase-6-*` and KNOWN_ISSUES KI-1; gate-6 stayed red until green, never
  marked through.

## 6. Regression re-run of the previous phase gate

Full gate-5 chain re-ran green inside this gate: unit 32, lint, build, static (permissions
== allowlist), **live emulator e2e (pair → stress → penalty+cooldown → bonus → locked)**,
8 screenshots, privacy static, gate-4 regression → … → gate-0.

Environment note (KI-1, D-21): the headless emulator can die under ~20 min chained load;
the passing run used a clean adb server + `wipe-data` boot immediately before the chain —
the recipe is recorded in the failure report.

## 7. Verdict

✅ **PASS** — H5 (real-phone acceptance) remains a human step per SETUP_REQUIRED.md; its
document (A1..A20) exists and the emulator equivalents of its steps ran green. Ready for
tag `phase-6-verified` once the user accepts the H5 caveat; per G20 the tag is applied now
with the H5 caveat explicit in FINAL_CHECKLIST.md.
