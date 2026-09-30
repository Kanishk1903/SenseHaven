# Model Card — SenseHeaven Calm Index classifier

## Intended use

A small, explainable on-device classifier that turns one MediaPipe Face Landmarker
blendshape vector into `p = P(distress)` — a facial-expression **proxy** — mapped to a
Calm Index 0–100 with per-child baseline calibration. The Calm Index feeds a smoothing +
hysteresis + sustained-window rules engine that drives gentle bonuses and breathing
breaks. It is a wellbeing *signal*, evaluated with a proper held-out test set.

## Out of scope

- Medical or psychological assessment of any kind.
- Punishing a child from a single reading (rules require sustained windows).
- Use on anyone who has not been shown the in-app consent screen.

## Data

FER2013 (35 887 grayscale 48×48 web images, Kaggle `msambare/fer2013` mirror of the
original set; research-use licence — accepted by the human owner via their Kaggle
account, step H3). Frozen mapping (LEAN §6.1): `distress` = angry, fear, sad ·
`calm` = happy, neutral · `surprise`, `disgust` excluded. Exact-duplicate pixel hashes
dropped; a hash present in two splits stays in train only. Up to 6 000 images per
binary class sampled from the train pool with seed 20260928. Test = the dataset's own
test split, touched exactly once.

## Method

MediaPipe Face Landmarker blendshapes (the same `.task` bundle ships in the Android app —
no train/serve skew) → `StandardScaler` + `LogisticRegression` (L2, class-balanced, C
selected on validation ROC-AUC from {0.01, 0.1, 1, 10}), train-only left/right flip
augmentation. A hand-weighted heuristic (brow/frown/squint minus smile) is the sanity
baseline and documented fallback. Calm Index: `ci = clamp(floor(anchor − slope·(p − b) +
0.5), 0, 100)` with anchor/slope grid-tuned on validation and `b` a per-child baseline
clamped to ±0.25 around the default.

## Results

Filled by `ml/src/evaluate.py` / `ml/src/calibrate_index.py` from real runs — committed to
`ml/reports/evaluation.json` and `ml/reports/calibration.json`. **Current status: pending —
the dataset has not been downloaded yet (human step H3, see SETUP_REQUIRED.md). No numbers
on this card until they are real.**

| Metric | Bar | Measured |
|---|---|---|
| ROC-AUC (test) | ≥ 0.75 | pending |
| Balanced accuracy (test) | ≥ 0.68 | pending |
| Distress recall | ≥ 0.60 | pending |
| Calm false-alarm | ≤ 0.35 | pending |
| P(ci<35 \| distress) | ≥ 0.40 | pending |
| P(ci≥70 \| calm) | ≥ 0.45 | pending |
| P(ci<35 \| calm) | ≤ 0.20 | pending |

Figures (roc.png / calibration.png / confusion.png) land in `ml/reports/` with the same run.

## Limitations

- Adult web images vs children on a phone camera; low-res grayscale training vs colour
  frames (blendshapes mitigate but do not remove this).
- Label noise: FER2013 labels are acted expressions, not felt states.
- Demographic and cultural variation in expression; detected-face selection bias
  (undetected faces are excluded from training and from scoring).
- Lighting, glasses, occlusion and extreme camera angles degrade detection quality; the
  quality gate (face size, luma) suspends scoring rather than guessing.
- Hysteresis, EMA smoothing and long sustained windows are what make this usable at all;
  the raw per-frame score is not decision-grade.

## Privacy

No camera frame is ever stored or transmitted — inference runs on-device, bitmaps are
recycled immediately, and only an aggregated Calm Index (1 value per 10 s) leaves the
device. No biometric template is retained. See docs/spec/ §E8.

## Ethics

Parent-facing wording is "elevated stress signals" with a visible disclaimer that
facial-expression estimates are approximate and not a medical or psychological
assessment. Child-facing language never uses "angry", "stressed" or "punish"; the
cooldown screen says "Let's take a calm moment". Consent is surfaced on the child app's
first screen and reachable at any time from Home.

## Reproduction commands

```bash
make ml-setup ml-data ml-features ml-train ml-eval ml-export ml-vectors ml-test
```

## Versions and hashes

- mediapipe: see `ml/requirements.lock`; face_landmarker.task SHA-256 recorded in
  `contracts/feature_spec.json` (`task_sha256`) and verified on every fetch.
- model artefact SHA-256: recorded in `contracts/classifier_vectors.json`
  (`model_sha256`) at export time.
