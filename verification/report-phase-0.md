# Independent Verifier report — Phase 0

Auditor mode (File 01 §G.2). All outputs below are pasted from real runs of 2026-09-28.

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 0)

An empty-but-verified skeleton where every later gate can run: repo layout with meta docs and
spec copies; idempotent `scripts/doctor.sh` (FAIL only for python ≥ 3.11, node ≥ 20, docker +
compose, git); docker-compose `db` (postgres:16, healthcheck); gate runner writing
`verification/phase-N.json` per the gate-runner contract; `no_placeholders.sh`; Makefile
targets (doctor, gate-%, gate-upto, gate-all, api-test, web-*, up, down); `ci.yml` that skips
gracefully while api/web are empty; `android.yml` placeholder; git initialised with
`chore: scaffold`; GATE 0 checks green.

## 2. Existence check

`bash scripts/check_layout.sh` → `layout OK: all P0.1 paths exist` (exit 0). This covers every
root file, `docs/` set, `scripts/` set (including the six later-phase scripts, present as
honest stubs per D-13), the four spec files in `docs/spec/`, and all directories.

## 3. Execution check (exit codes from the final `make gate-0`)

| Check | Exit | Result |
|---|---|---|
| layout | 0 | PASS |
| doctor | 0 | PASS (`python3 3.11.5`, `node 26.8.2`, `docker … daemon up`, `git 2.54.0`; WARN: gh auth → H1, adb, Android SDK) |
| db | 0 | PASS (`db ready after 1s`) |
| placeholders | 0 | PASS (`no_placeholders: clean`) |
| gitignore | 0 | PASS (`.env, ml/data/*, node_modules/* are all ignored`) |
| runner | 0 | PASS (`runner selftest OK: phase-N.json writer emits a valid, schema-checked file`) |
| ci | — | BLOCKED_ON_H1 (gh not authenticated, no origin remote — the GATE 0 table explicitly permits this for the `ci` check only) |

Gate verdict: `BLOCKED_ON_H1`, **exit 0**. `git log`:
`538de34 feat: gate runner…`, `8b0209d chore: local postgres compose…`,
`61ab0e7 feat: doctor script…`, `c2da1e5 chore: scaffold`.

## 4. Output correctness (expected vs observed)

- `verification/phase-0.json` matches the gate-runner contract: `{phase, timestamp,
  checks:[{name, cmd, exit, pass, blocked?, note?}], verdict, fallback_applied}`; validated by
  `_gate_json.py.validate()` on write (a malformed file would have failed the gate).
- Doctor's FAIL set is exactly {python, node, docker, git} as specified; everything else WARN.
- The `blocked` entry carries `pass: true` only in the "does not block the phase" sense; the
  verdict string `BLOCKED_ON_H1` distinguishes it from a clean PASS, and `PROGRESS.md` logs it.
- `docker compose exec -T db pg_isready -U senseheaven -d senseheaven` exits 0 (db truly serving).

## 5. Negative checks (must fail *safely*)

**(a) Gate with `.env.example` deleted → must FAIL.** Real output:
```
FAIL layout (exit 1) — last lines:
    missing: .env.example
gate-0: verdict FAIL — written to verification/phase-0.json
gate exit: 1 (expect non-zero)
```
(Incidental: the same run also lost the `db` check to a transient mid-pull network error —
see `verification/failure-phase-0-2026-09-28.md` cycle 2. `.env.example` was restored.)

**(b) Source file containing a marker token → `no_placeholders.sh` must FAIL.** Real output:
```
./scripts/negcheck_tmp.sh:2:# TODO: remove me
no_placeholders: FAIL (hits above)
no_placeholders exit: 1 (expect 1)
```
(The planted file was removed immediately afterwards.)

**(c) Unplanned live negative proof:** the gate initially FAILED on my own plan text containing
a marker token (cycle 1 in the failure report) — demonstrating it does not fake green.

## 6. Regression re-run of the previous phase gate

Not applicable — Phase 0 is the first phase; by the gate contract gate-0 has no regression
check. All later gates end with `regression: previous gate`.

## 7. Verdict

✅ **PASS** (with `BLOCKED_ON_H1` for the `ci` check only, as the GATE 0 table allows).
No check was skipped, loosened, or unverified. Ready for tag `phase-0-verified`.
