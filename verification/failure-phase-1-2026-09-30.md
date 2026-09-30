# Failure report — Phase 1 (gate-1)

Per File 01 §G12. One failure cycle before the green re-run; root-caused, no check weakened.

## Cycle 1 — `regression: previous gate` FAIL (colima daemon down)

- **Command:** `make gate-1` — 2026-09-28 ~12:20 IST (first attempt), session resumed 2026-09-30
- **Output tail (real):**
  ```
  FAIL regression: previous gate (exit 1) — last lines:
      FAIL doctor (exit 1) — …
          FAIL  docker daemon not reachable (run: colima start — or open Docker Desktop)
      FAIL db (exit 1) — last lines:
          failed to connect to the docker API at unix:///Users/kanishkgupta/.colima/default/docker.sock
          … connect: no such file or directory
  ```
- **Classification:** *config/env* — the colima VM that hosts the docker daemon was stopped
  between runs (the session was interrupted for ~2 days; `colima list` showed `Stopped`).
  Gate-1's own five checks had all passed; only the nested gate-0 re-run was red.
- **Fix:** `colima start` (no code or gate changes). Note: the foreign `sensehaven_db`
  container from Phase 0 (D-15) has restart disabled, so it did **not** re-grab port 5432
  when the VM came back — the fix from the phase-0 failure held.
- **Re-run:** PASS — full gate-1 green:
  `PASS error codes / settings schema / tokens generated / contrast / placeholders /
  regression: previous gate`, verdict `PASS`, exit 0 (`verification/phase-1.json`).

## Outcome

`make gate-1` green; negative checks executed afterwards (see `verification/report-phase-1.md`)
also behave: duplicate error-code row → FAIL; reverting the `text-subtle` contrast fix → FAIL.
