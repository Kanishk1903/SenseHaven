# Failure report — Phase 2 (gate-2)

Per File 01 §G12. The gate ran red once before the green re-run; earlier development-loop
failures are summarised at the end for completeness.

## Gate cycle 1 — `lint` FAIL (unused imports/variable in the new IDOR test)

- **Command:** `make gate-2` → `ruff check scripts/ api/` — 2026-09-30
- **Output tail (real):**
  ```
  F401 `pytest` imported but unused                (tests/test_idor_matrix.py:9)
  F401 `fastapi.testclient.TestClient` imported but unused (tests/test_idor_matrix.py:10)
  F401 `api.tests.test_pairing.make_child` imported but unused (tests/test_idor_matrix.py:13)
  F841 Local variable `b` is assigned to but never used      (tests/test_idor_matrix.py:98)
  ```
- **Classification:** *test defect* (dead imports left from refactoring the matrix test).
- **Fix:** removed the unused imports; gave `b` a real use (`assert b["child_id"] != a["child_id"]`).
- **Re-run:** full gate-2 PASS (`verification/phase-2.json` verdict `PASS`).

## Development-loop defects caught before/at gate time (all fixed, none weakened checks)

1. **`rowcount` = −1 for multi-row inserts** (`services/events.py`): SQLAlchemy
   insertmanyvalues does not report rowcount for batched `INSERT … ON CONFLICT DO NOTHING`,
   producing `accepted: {emotion: -1}`. Fixed by adding `.returning(<pk>)` and counting rows.
2. **FK ordering in ingest**: ledger rows reference `screen_sessions`; session snapshots are
   now ingested first so same-batch references resolve.
3. **Flaky stress-alert dedupe test**: `datetime.now()` could sit near a 10-minute bucket
   boundary, making the 5-minute gap cross buckets intermittently. Test now anchors the
   timestamp at bucket-start + 1 min (3 consecutive green runs).
4. **virtual-child integration check** (3 iterations): (a) `@senseheaven.test` rejected by
   email-validator (special-use TLD) → use `example.com`; (b) the virtual device needs a
   `start_session` command before stress rules run — the check now starts a remote session
   after pairing; (c) corrected a broken penalty condition in `virtual_child.py` (proper
   `penalty_lockout_s` lockout).
5. **Config fail-fast typo (F821)**: `", ".join(m.upper())` → `", ".join(name.upper() for name in missing)`
   — the production missing-var message would have raised NameError instead.

## Outcome

`make gate-2` green: all 9 checks PASS (tests, no-skips, idor, security, openapi, virtual
child, lint, placeholders, regression gate-1) — 73 tests, 88% coverage.
