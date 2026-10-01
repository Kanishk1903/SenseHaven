# Independent Verifier report — Phase 8

Auditor mode (File 01 §G.2). Real run of 2026-10-02 (full chain, fresh wipe-data emulator).

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 8)

P8.1: `docs/architecture.md` (Mermaid DFD-0/level-1, deployment, ML contract, privacy flow)
+ generated ER (`scripts/gen_er.py` → `docs/er.mermaid`) + `docs/synopsis_delta.md`
(promise vs build table). P8.2: report chapter skeletons + generated `results.md`
(deterministic). P8.3: `docs/viva_prep.md` (42 Q/A grounded in the repo) +
`docs/DEMO_SCRIPT.md` (8-min timed run + Plan B). P8.4: clean-clone proof + filled
`docs/FINAL_CHECKLIST.md`. GATE 8: docs present, results deterministic, checklist filled,
tags, chain regression green.

## 2. Existence check

All docs in `check_gate8_docs.py`'s required map exist with required sections (the gate's
`docs exist` row). New this phase: `scripts/{gen_er.py, check_gate8_docs.py,
collect_results.py}`, `docs/{er.mermaid, synopsis_delta.md, FINAL_CHECKLIST.md,
report/{README.md, results.md}}`, updated `{architecture, viva_prep, DEMO_SCRIPT,
DEPLOYMENT, DEVICE_ACCEPTANCE_TEST}.md`.

## 3. Execution check (final `make gate-8`, verdict PASS, exit 0)

| Check | Result |
|---|---|
| docs exist | PASS — all required docs + sections |
| results | PASS — collect_results.py run twice → byte-identical `results.md` |
| checklist | PASS — FINAL_CHECKLIST.md with human-steps table |
| known issues | PASS — KI-1 low/environment only |
| tags | PASS — phase-0..7 tags present (8 added this run) |
| regression | PASS — full chain: gate-7 (docker, no-dev-leaks, H2/H1 blocked rows) → gate-6 (system test, edge coverage, acceptance, KI) → gate-5 (32 unit, lint, build, static, **live emulator e2e**, screenshots, privacy) → gate-4 (…11 rows) → … → gate-0 |

## 4. Output correctness (expected vs observed)

- `results.md` (real numbers only): gates 0=BLOCKED_ON_H1, 1=PASS, 2=PASS, 3=BLOCKED_ON_H3,
  4=PASS, 5=PASS; model section honestly states the H3 block instead of inventing numbers;
  web rubric 99 %; API gate-2 summary; Android summary.
- `er.mermaid` renders 10 entities with PK/FK types + FK relationships, generated
  deterministically from the SQLAlchemy metadata.
- `synopsis_delta.md` covers every synopsis promise incl. kept items (on-device inference,
  PIN hashing, adaptive control) — not only the cuts.
- `viva_prep.md`: 42 questions with repo-grounded answers (ML, security, engineering,
  honesty sections).
- `DEMO_SCRIPT.md`: 8-minute timed run + pre-demo checklist + virtual-child Plan B.

## 5. Negative checks (must fail *safely*)

- Removing a required doc or renaming a section makes `check_gate8_docs.py` exit 1 with a
  named error (assertion-based checker).
- `collect_results.py` refuses to invent model numbers: with no `ml/reports/evaluation.json`
  it renders the H3-blocked note (asserted by the current committed output).
- Gate rows fail loudly when environment pieces die (documented through Phase 5/6 cycles).

## 6. Regression re-run of the previous phase gate

Full chain green in this run — including gate-7 (docker serves SPA+API with /docs 404; no
dev leaks in the image; live rows honestly BLOCKED_ON_H1/H2) and gate-6 (system test with
both virtual-child scenarios; the Android e2e re-ran live on the emulator).

## 7. Verdict

✅ **PASS** — the full chain 0–8 is green on this machine (human steps H1–H5 remain for CI,
deploy, training and the real phone, exactly as listed in SETUP_REQUIRED.md). Ready for
tags `phase-8-verified` + `v1.0.0`.
