# Failure report — Phase 4 (gate-4)

Per File 01 §G12. Gate-4 ran red twice before the green re-run; root causes fixed, no check
weakened.

## Cycle 1 — `unit` and `rubric` checks exited 2/1 (shell quoting in the gate)

- **Command:** `make gate-4` (first run)
- **Root cause:** the two checks with nested `$(…)` / multi-line `python3 -c` quoting broke
  when re-quoted through the gate runner's `bash -c`. *Classification: test defect (gate
  authoring).*
- **Fix:** extracted each into a committed helper — `scripts/check_unit_count.sh` (vitest
  count ≥ 40) and `scripts/check_rubric.py` (rubric ≥ 80 %). Also fixed the count parse to
  match the `Tests` line (not `Test Files`) with `^ *Tests `.
- **Re-run:** PASS.

## Cycle 2 — `lint` and `regression` FAIL

- **lint:** `scripts/check_rubric.py` missing its executable bit (EXE001). Fixed with
  `chmod +x`; re-run PASS.
- **regression (gate-2):** gate-2's `lint` row failed on the same missing exec bit. Same fix;
  gate-2 re-ran green (9/9) before gate-4's final pass.

## Development-loop defects caught by the visual review + e2e (all fixed before the gate)

1. **Double-mount bug:** `RequireAuth` rendered `<Shell/>` directly while the route tree also
   had a Shell layout route — the whole dashboard rendered twice (caught by the alerts e2e
   strict-mode violation). Fixed: RequireAuth renders `<Outlet/>`.
2. **Stale session cache:** after login the pre-auth `useMe` 401 stayed cached and bounced
   the user back to /login. Fixed: invalidate `["me"]` on login/register success.
3. **TanStack v5 `isLoading` misuse:** disabled queries (no child selected) report
   `isLoading === false`, so cards read `undefined` and crashed. Fixed: guard on
   `!child || query.isPending` everywhere.
4. **Tailwind spacing-token collision:** pixel-valued generated spacing keys (`8` = 8 px)
   shadowed Tailwind's scale (`w-8`/`h-12`), visibly squashing the PIN keypad — caught by
   the screenshot review. Fixed: default scale kept (it already is the 4-pt grid).
5. **Charts dropped sparse data:** index-modulo sampling skipped the only non-null buckets
   and x-positions were index-scaled. Rewritten time-proportional with dot markers.
6. **E2E environment:** a stale uvicorn from an earlier run held port 8000 with an old build
   and accumulated pair-limiter state (429s). `web_e2e.sh` now uses a dedicated port (8021)
   and clears stale listeners; the seed restores one unread demo alert so the alerts flow is
   repeatable.

## Outcome

`make gate-4` green: 11/11 checks PASS — types, lint, unit (41 ≥ 40), build (initial JS
~86 KB gzip ≤ 400 KB), e2e (6/6 incl. axe + screenshots), screenshots (10 files, both
widths), rubric (99 % ≥ 80 %), contrast, production serve, placeholders, regression gate-3.
