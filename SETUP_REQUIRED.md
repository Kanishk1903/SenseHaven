# SETUP REQUIRED — human-only steps

The only steps that need a human (File 03 §X). Everything else is built by the agent.

| ID | Step | Exact commands / where | Status |
|---|---|---|---|
| H1 | Authenticate GitHub CLI (or provide `GITHUB_TOKEN`) | `gh auth login` — then add the `origin` remote, push, and re-run `make gate-0` so the `ci` check can verify Actions runs | **REQUIRED** — gh is installed but not authenticated |
| H2 | Provide `RENDER_API_KEY`, or connect the repo to Render once in the dashboard | Render dashboard → New → Blueprint → point at this repo | needed for Phase 7 |
| H2b | Create a free Neon project; copy the **pooled** connection string as `DATABASE_URL` | https://neon.tech → New project → copy pooled connection string | needed for Phase 7. Do **not** use Render's free Postgres — it expires 30 days after creation |
| H3 | Provide Kaggle credentials, or place FER2013 manually | Either: `gh …` no — run `export KAGGLE_USERNAME=... KAGGLE_KEY=... && make ml-data ml-features ml-train ml-eval ml-export ml-vectors` (licence acceptance happens when you use your own Kaggle account), **or** unzip FER2013 into `ml/data/fer2013/` and run `make ml-features ml-train ml-eval ml-export ml-vectors`. Then re-run `make gate-3` — it must turn from `BLOCKED_ON_H3` to PASS. | **BLOCKING Phase 3 result** — gate-3 rests at BLOCKED_ON_H3; all code is built and tested |
| H4 | Grant permissions on the child phone | In-app setup wizard: Camera, Notifications, Usage access, Display over other apps (+ battery exemption) | needed for Phase 5/6 |
| H5 | 10–15 minute real-device acceptance run | `docs/DEVICE_ACCEPTANCE_TEST.md` (written in Phase 6) | needed for Phase 6 |
| H6 | Only if `assembleDebug` stays red after two agent attempts: create `android/` from Android Studio's "Empty Activity (Compose)" template | Android Studio → New Project → Empty Activity (Compose) | conditional (Phase 5) |
