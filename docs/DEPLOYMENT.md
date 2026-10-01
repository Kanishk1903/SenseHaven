# Deployment

Written in Phase 7 (P7.2) — Render free web service + Neon free Postgres: exact steps, env
var table, warm-up procedure, free-tier limits verified against current docs.

## Architecture (one deployable, D-4)

A single Docker image serves the built React SPA **and** the FastAPI backend:

```
Browser ──► Render web service (Docker, free plan)
              ├── /                → web/dist SPA (immutable assets, no-cache index)
              ├── /api/v1/*        → FastAPI (uvicorn, 1 worker)
              └── /api/v1/healthz  → health check path
                        │
                        └──► Neon PostgreSQL (pooled connection string, sslmode=require)
```

## Prerequisites (human steps — see SETUP_REQUIRED.md)

| ID | Step |
|---|---|
| H2 | `RENDER_API_KEY`, or connect the repo once in the Render dashboard (Blueprint flow) |
| H2b | Neon project → copy the **pooled** `DATABASE_URL` (Neon, never Render Postgres — Render's free DB expires after 30 days) |

## Environment variables (Render → Environment)

| Key | Value | Notes |
|---|---|---|
| `ENV` | `production` | disables `/docs`, enables HSTS + Secure cookies |
| `DATABASE_URL` | `postgresql://…neon.tech/db?sslmode=require` | sync:false (secret); normalised to `postgresql+psycopg://` in code |
| `APP_SECRET` | generateValue (render.yaml) | JWT signing |
| `PAIRING_PEPPER` | generateValue (render.yaml) | pairing-code hashing |

## Deploy steps

1. **Blueprint:** Render dashboard → New → Blueprint → pick this repo. `render.yaml` defines
   one free web service (`docker` runtime, health check `/healthz`, the env vars above).
2. **Database:** paste the Neon pooled URL into `DATABASE_URL`. The engine uses
   `pool_pre_ping=True`, `pool_recycle=300`, `prepare_threshold=None` (PgBouncer-safe) and
   retries the first connection for up to 60 s (Neon cold start, P7.1).
3. **Schema:** created at startup by `Base.metadata.create_all()` (LEAN §1.2 — no Alembic).
4. **First smoke:** `scripts/smoke_prod.py --base-url https://<render-url>` — registers a
   throwaway account, pairs a virtual device, asserts headers/cookies/SPA, then cleans up.

## Android release (P7.3)

`android.yml` (on tag `v*`): `fetchModels` → `assembleDebug` with
`-PbaseUrl=https://<render-url>` → SHA-256 + size → GitHub Release with the debug-signed APK
→ commit `web/public/apk.json` so the dashboard's Download page shows the real file.
Debug signing is acceptable for this project (documented school demo); release builds forbid
cleartext traffic.

## Free-tier limits (verified against vendor docs, Sept 2026)

| Service | Limit | Design response |
|---|---|---|
| Render web service | sleeps after ~15 min idle; cold start 30–60 s | phone + dashboard tolerate ≥ 60 s first request (G18); `scripts/warm.sh` before demos; optional UptimeRobot ping **only in demo week** |
| Render free instance hours | monthly cap | keep-warm only in demo week |
| Neon free | compute suspends after ~5 min idle (~1 s extra on first query); ~0.5 GB storage | first-connect retry 60 s; retention: "Delete history" button (lean §1.2) |

## Warm-up

```bash
scripts/warm.sh https://<render-url>   # GET /healthz until 200, up to 90 s
```

## Rollback

Render → Deploys → pick the previous deploy → "Rollback". Schema is additive-only in this
project (create_all), so rolling the image back is safe.
