# Independent Verifier report — Phase 1

Auditor mode (File 01 §G.2). All outputs pasted from real runs of 2026-09-28 / 2026-09-30.

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 1)

The specs that code will consume exist first: `contracts/error_codes.md` (17 codes, each with
HTTP status + user-facing copy per the File 02 §5 voice); `contracts/settings_schema.json`
(JSON Schema draft 2020-12, defaults + ranges, `stress_threshold < calm_threshold - 10`
declared and tested 3 bad / 3 good); `design/tokens.json` (light theme only) with
`scripts/gen_tokens.py` emitting committed, never-hand-edited `tokens.css`,
`tailwind.tokens.cjs`, `Tokens.kt` idempotently; `scripts/check_contrast.py` covering the
documented pairs; `contracts/README.md` naming the other contract sources; GATE 1 green with
gate-0 regression.

## 2. Existence check

`bash scripts/check_layout.sh` (via gate-0 regression) → `layout OK: all P0.1 paths exist`.
Additionally present: `contracts/{error_codes.md, settings_schema.json, README.md}`,
`design/tokens.json`, `design/generated/{tokens.css, tailwind.tokens.cjs, Tokens.kt}`,
`scripts/{gen_tokens.py, check_contrast.py, check_contracts.py, gates/gate-1.sh}`.

## 3. Execution check (final `make gate-1`, exit 0)

| Check | Exit | Result |
|---|---|---|
| error codes | 0 | PASS — "17 codes; all 17 required codes present with correct HTTP status and copy; no duplicates" |
| settings schema | 0 | PASS — "valid draft-2020-12 structure; defaults validate; cross-field rule holds on 3 bad + 3 good samples; range/pattern negatives behave" |
| tokens generated | 0 | PASS — gen_tokens.py run twice, `git diff --exit-code -- design/generated` clean ("tokens deterministic: double re-run byte-identical") |
| contrast | 0 | PASS — all 8 documented pairs ≥ 4.5 (lowest: neutral-fg/neutral-soft 5.27; text-subtle 5.01 after the token fix) |
| placeholders | 0 | PASS |
| regression: previous gate | 0 | PASS — full gate-0 re-run green |

## 4. Output correctness (expected vs observed)

- Contrast table (real values): text/bg 16.74 · text-muted/bg 6.37 · text-subtle/bg 5.01 ·
  on-primary/primary 6.78 · calm-fg/calm-soft 6.19 · neutral-fg/neutral-soft 5.27 ·
  stress-fg/stress-soft 5.29 · primary/bg 6.32 — every pair above its bar.
- File 02's published `text-subtle` (#74746C) measured **4.39** on `bg` — below the 4.5 bar —
  so the token was darkened to `#6B6B63` (measures 5.01) exactly as File 02 §2.5 prescribes,
  with the adjustment recorded in `design/tokens.json` → `meta.adjustments` and
  `GATES_CHANGELOG.md` (dated 2026-09-28).
- Cross-field samples: rejected (35,40), (50,55), (60,69); accepted + schema-valid
  (35,70), (5,50), (60,95) — 3 bad / 3 good as the gate requires.
- Generated artefacts start with the "do not edit by hand" header and are committed.

## 5. Negative checks (must fail *safely* — real output)

**(a) Duplicate error-code row appended → checker must FAIL:**
```
error_codes.md:
  ERROR duplicate code: UNAUTHENTICATED
check_contracts error-codes: FAIL
error-codes exit: 1 (expect 1)
```
(file restored via `git checkout`.)

**(b) Reverting the contrast fix (`text-subtle` back to `#74746C`) → checker must FAIL:**
```
text-subtle on bg     4.39  4.5   FAIL  captions
check_contrast: FAIL — adjust the token, log in GATES_CHANGELOG.md, re-run
contrast exit: 1 (expect 1)
```
(token restored via `git checkout`.)

After both negatives the full gate was re-run and returned to green (`gate-1 exit: 0`).

## 6. Regression re-run of the previous phase gate

Executed as gate-1's final check (exit 0): layout, doctor, db, placeholders, gitignore,
runner all PASS; `ci` BLOCKED_ON_H1 as before (human step H1 still pending).

One environment failure cycle was logged this phase (colima daemon stopped between sessions;
restarted, see `verification/failure-phase-1-2026-09-30.md`).

## 7. Verdict

✅ **PASS** — no check skipped, loosened, or unverified. Ready for tag `phase-1-verified`.
