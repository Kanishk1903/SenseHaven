# Independent Verifier report — Phase 3

Auditor mode (File 01 §G.2). Real runs of 2026-09-30. This phase rests at `BLOCKED_ON_H3`
by design (LEAN §6.0): *"If missing, write the exact commands in SETUP_REQUIRED.md, finish
the code and unit tests that don't need data, mark the gate BLOCKED_ON_H3, and do not fake
data."*

## 1. Definition of Done (restated from LEAN §6, slices P3.1–P3.7)

A Python 3.11 venv under `ml/` with pinned lock; `scripts/fetch_models.sh` downloading the
Face Landmarker `.task` bundle with SHA-256 recorded in `contracts/feature_spec.json` and
verified on every run; dataset index/dedupe/split (P3.2); preprocess pilot + blendshape
feature extraction with names learned from the model, never hard-coded (P3.3); scaler +
logistic training with flip augmentation and the heuristic baseline (P3.4); evaluation with
bootstrap CI / balanced accuracy / Brier / ECE (P3.4); Calm-Index calibration grid on
validation with the three rate conditions and floor(x+0.5) rounding (P3.5); a float32
forward reference, canonical JSON export ≤ 20 KB with a strict validator, and ≥ 60
classifier vectors with exact-CI reproduction (P3.6); model card + gate (P3.7).

## 2. Existence check

`ml/{requirements.txt, requirements.lock (61 pins), pyproject.toml, MODEL_CARD.md}`,
`ml/src/{config, dataset_index, preprocess, extract_features, train, evaluate,
calibrate_index, quality_ref, forward_ref, export_json, make_vectors, fetch_data,
check_bars, check_vectors}.py`, `ml/tests/` (12 tests), `ml/artifacts/face_landmarker.task`
(git-ignored), `scripts/fetch_models.sh`, Makefile targets
`ml-setup ml-data ml-features ml-train ml-eval ml-export ml-vectors ml-test`.

## 3. Execution check (`make gate-3`, verdict BLOCKED_ON_H3, exit 0)

| Check | Result |
|---|---|
| ml tests | PASS — 12 data-independent tests (synthetic fixtures) |
| task hash | PASS — `fetch_models: hash OK (64184e229b263107…)` (idempotent second run verifies, does not re-download) |
| model card | PASS — all 10 required sections present |
| git hygiene | PASS — no `ml/data/` or `.task` tracked |
| ruff | PASS |
| placeholders | PASS |
| regression: previous gate | PASS — full gate-2 (9 checks) re-run green |
| dataset / features / model bars / model json / vectors | **BLOCKED_ON_H3** — six rows, each with the exact unblocking command |

## 4. Output correctness (expected vs observed — synthetic-model proofs)

- `forward_ref` matches sklearn `predict_proba` to ≤ 1e-5 on 50 synthetic rows
  (`test_forward_matches_sklearn_to_1e5`) — the Kotlin parity contract.
- `ci == calm_index(p, 75, 120, baseline)` exactly (floor(x+0.5), never `round()`).
- Inputs are clamped to [0,1] (`[5.0, -3.0, …]` ≡ `[1.0, 0.0, …]`); wrong length →
  `ValueError("feature vector has wrong length…")`; NaN → `ValueError("…non-finite…")`.
- Export is canonical (sorted keys, compact separators, float32-rounded values); the written
  file equals `canonical_bytes(payload)`; tampered weights → validator `ValueError`.
- Vectors: ≥ 40 from 30 rows × 4 baselines {default, 0.10, 0.30, 0.55}, every one reproduced
  exactly, every near-integer raw (|raw − round(raw)| < 0.01) dropped.
- Flip augmentation swaps exactly the Left/Right pairs and keeps unpaired columns.
- Cross-split duplicate md5 stays in train only; surprise/disgust excluded; per-class cap
  6 000 with seed 20260928.

## 5. Negative checks (must fail *safely* — real output)

- **Model URL moved:** `fetch_models.sh` first `curl -sI`s the URL; on non-200 it refuses
  and instructs logging the new URL in DECISIONS.md (verified by code inspection + hash gate:
  a stored hash mismatch exits with "SHA-256 mismatch — … investigate").
- **Tampered task bundle:** replacing the `.task` file makes `fetch_models.sh` exit non-zero
  on the stored-hash comparison (the gate's `task hash` check would FAIL, not skip).
- **Wrong-length / NaN feature vector:** clear ValueError, no crash (asserted in tests).
- **Missing dataset:** `make ml-data` prints the exact H3 commands and exits 1;
  `build_index` raises `FileNotFoundError` — no synthetic data is ever fabricated
  (`test_missing_dataset_raises`).
- **Validator rejects shape drift:** `weights` shortened by one → ValueError (tested).

## 6. Regression re-run of the previous phase gate

Executed as gate-3's final check: gate-2 fully green (9/9 including the virtual-child e2e).

## 7. Verdict

✅ **PASS (BLOCKED_ON_H3 for the six data-dependent checks only)** — per LEAN §6.0 and the
Phase-3 preconditions ("H3 or BLOCKED_ON_H3"). Every executable check passed; nothing was
faked; the exact unblocking commands are in `SETUP_REQUIRED.md`. Ready for tag
`phase-3-verified`; after H3 lands, `make gate-3` must be re-run to PASS.
