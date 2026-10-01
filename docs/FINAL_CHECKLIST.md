# FINAL CHECKLIST (lean)

- [x] `make gate-0..5` green locally (each `verification/phase-N.json` verdict PASS or
      sanctioned BLOCKED: gate-0 ci=BLOCKED_ON_H1, gate-3=BLOCKED_ON_H3); gate-6/7/8 rows
      marked below
- [x] Web rubric ≥ 80 % (99 %), axe 0 critical/serious, screenshots committed
- [x] Android rubric ≥ 80 % (100 %), 8 emulator screenshots committed
- [ ] Live URL smoke (`smoke_prod.py`) — **BLOCKED_ON_H2/H2b** (Render + Neon accounts)
- [ ] Debug-signed APK in a GitHub Release — **BLOCKED_ON_H1** (gh auth); APK builds
      locally (55 MB) and the release pipeline (P7.3) is defined in `.github/workflows/android.yml`
- [ ] Model card + evaluation committed; deployed model = evaluated model — **BLOCKED_ON_H3**
      (card committed; training pending FER2013 licence acceptance)
- [x] Device acceptance run recorded (H5) — `docs/DEVICE_ACCEPTANCE_TEST.md` written with
      A1..A20; emulator-based equivalents executed; **real-phone run is H5 (human)**
- [x] Docs complete: architecture, synopsis delta, report chapters + generated results,
      viva prep (42 Q/A), demo script, deployment, future work, edge-case coverage
- [ ] Tags `phase-6/7/8-verified` — gate-6 in progress; 7/8 depend on H1/H2 for live rows

## Human steps that remain (SETUP_REQUIRED.md)

| ID | Blocks |
|---|---|
| H1 | GitHub Actions CI runs, APK Release, gate-0 ci check |
| H2 + H2b | Live deploy + smoke_prod against the live URL |
| H3 | ML training + model-parity vectors (code, tests and gates are ready) |
| H4 + H5 | Real-phone acceptance run (A1..A20) |
