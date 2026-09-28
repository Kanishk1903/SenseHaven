# SenseHeaven

Calm screen-time wellbeing for families: a **parent web dashboard** (React + FastAPI) that
pairs with a **native Android child app** (Kotlin + Compose) which keeps time authoritatively
on-device, estimates a *Calm Index* from on-device facial-geometry blendshapes, and enforces
bonus / penalty / cooldown rules offline-first.

> Facial-expression estimates are approximate and are not a medical or psychological assessment.

## Status

Built phase-by-phase against the gate contract in `docs/spec/03-phases-and-gates-lean.md`
(see also `docs/spec/` for the other three binding specification files).
Current phase and event log: `PROGRESS.md`.

## Quickstart

```bash
make doctor            # toolchain check (python 3.11+, node 20+, docker, git)
docker compose up -d db
make gate-0            # verification gate for the current phase
```

## Layout

| Path | What |
|---|---|
| `api/` | FastAPI + PostgreSQL backend (Phase 2) |
| `web/` | Parent dashboard SPA (Phase 4) |
| `android/` | Child app, Kotlin + Compose (Phase 5) |
| `ml/` | Emotion model training + JSON artifacts (Phase 3) |
| `contracts/` | Error codes, settings schema, OpenAPI snapshot (Phase 1+) |
| `design/` | Design tokens + generated themes |
| `scripts/` | Doctor, gates, seed / virtual child, deploy smoke |
| `verification/` | Gate results (`phase-N.json`), failure reports, screenshots |
| `docs/spec/` | The four binding specification files |

Human-only steps are collected in `SETUP_REQUIRED.md`.
