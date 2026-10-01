# Report — chapter skeleton

Chapters mirror the synopsis; the results chapter is generated
(`scripts/collect_results.py` → `results.md`, deterministic, real numbers only).

| Chapter | File | Status |
|---|---|---|
| 1 Introduction | `01_introduction.md` | skeleton below |
| 2 Literature & background | `02_literature.md` | skeleton below |
| 3 Problem statement | `03_problem.md` | skeleton below |
| 4 Objectives & method | `04_method.md` | skeleton below |
| 5 FER + adaptive control design | `05_design.md` | skeleton below |
| 6 Requirements | `06_requirements.md` | skeleton below |
| 7 Modules | `07_modules.md` | skeleton below |
| 8 DFD / ER / Use-cases | `08_diagrams.md` | skeleton below |
| 9 Results & testing | `results.md` | **generated — real numbers** |
| 10 Limitations & future work | `10_limits.md` | skeleton below |
| 11 References | `11_references.md` | skeleton below |

Supporting: `../synopsis_delta.md` (promise vs build), `../architecture.md`,
`../viva_prep.md`, `../DEMO_SCRIPT.md`.

## 01 Introduction (skeleton)

- Context: children's screen time is a family battleground; existing tools punish.
- Thesis statement: an on-device wellbeing signal can make screen-time control adaptive
  without harvesting the child's data.
- Deliverables: parent web dashboard, native child app, API, ML artifacts, docs.

## 02 Literature & background (skeleton)

- FER2013 and facial-expression datasets; the emotion-recognition-from-faces debate
  (expressions ≠ feelings) — grounds the "proxy, not diagnosis" framing.
- Screen-time interventions: blocking vs. contextual approaches.
- Android defence: FGS types, UsageStatsManager, PBKDF2/argon2, DPDP Act 2023
  (data minimisation for minors).

## 03 Problem statement (skeleton)

- Punitive control fails; cloud-camera designs are privacy-toxic; parents need honest,
  low-cost insight with enforcement that works offline.

## 04 Objectives & method (skeleton)

- Objectives O1–O6 mapping to gates 0–8 (each gate = an objective with a measurable bar).
- Method: lean phase map, contracts-first, gate discipline, two-strikes cuts.

## 05 FER + adaptive control design (skeleton)

- Blendshapes → logistic → Calm Index → hysteresis → sustained-run rules (details in
  `../architecture.md` + model card).

## 06 Requirements (skeleton)

- Functional: pairing, sessions, adaptive rules, dashboard, alerts, privacy controls.
- Non-functional: offline-first, cold-start tolerance, accessibility, security bars
  (File 01 §E3), privacy invariants (§E8).

## 07 Modules (skeleton)

- API (auth/PIN, children/settings, pairing/devices, sync/ingest, analytics, commands).
- Web (shell, overview, analytics, alerts, settings, onboarding).
- Android (engine, model, guard service, camera, usage poller, UI flow, sync/queue).

## 08 Diagrams (skeleton)

- DFD-0/level-1, ER, deployment — Mermaid in `../architecture.md`; use-case list from the
  MUST list (pair → start → adapt → unlock).

## 10 Limitations & future work (skeleton)

- Model trained on adults (H3 pending at build time); swiftshader emulator instability;
  single worker; no uninstall guard; cuts table in `../synopsis_delta.md`.

## 11 References (skeleton)

- FER2013 (Goodfellow et al., 2013); MediaPipe Face Landmarker docs; FastAPI/SQLAlchemy/
  React/Compose docs; DPDP Act 2023; OWASP ASVS controls used.
