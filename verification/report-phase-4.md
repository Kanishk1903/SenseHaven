# Independent Verifier report — Phase 4

Auditor mode (File 01 §G.2). Real runs of 2026-09-30.

## 1. Definition of Done (restated from docs/spec/03-phases-and-gates-lean.md §PHASE 4)

The D1 deliverable at File 02 quality in lean scope: Vite 5 + React 18.3 + TS strict +
Tailwind 3.4 + shadcn-style Radix primitives + TanStack Query v5 + React Router 6 +
react-hook-form/zod + sonner + self-hosted Inter; tokens from `design/tokens.json` wired into
CSS + Tailwind + contrast checks; typed API client (problem+json → ApiError, GET retry,
60 s timeout, `X-Requested-With`); component kit built once with tests; shell with
ChildSwitcher + alert badge (updates `document.title`) + sheet menu on mobile; login/register
with blur validation, strength meter, RATE_LIMITED countdown; 3-step onboarding ending in a
live pairing code; Overview (live card polling 5 s, KPIs 15 s, calm timeline, alerts feed,
top apps); Analytics (Emotion/Screen time/Sessions, day navigation, table view toggle);
Alerts inbox (grouped, filters, bulk read); Settings (rewards/sensitivity/monitoring/blocked
apps/device/privacy with type-to-confirm deletes, sticky save bar); Account (PIN change);
Download; 404; every data view with loading/empty/error(+retry+request id)/stale variants;
≥ 40 vitest tests; exactly 3 Playwright flows + axe + screenshots at both widths; rubric
≥ 80 %; production serving of the SPA by the API; GATE 4 green.

## 2. Existence check

`web/{package.json, package-lock.json, vite.config.ts, tsconfig.json, tailwind.config.ts,
playwright.config.ts, eslint.config.js, index.html, public/favicon.svg}`,
`web/src/{main.tsx, app/{AppRoutes,Shell,childSelection}, lib/{api,errorCopy,format,cn,queries,
handleApiError,api-types}, components/ (ui kit + 10 shared components), features/{auth,
onboarding,overview,analytics,alerts,settings,account,download,misc}}`,
`web/e2e/{helpers,register-onboarding,overview,alerts,screenshots}`,
`verification/screenshots/web/` (10 PNGs), `verification/ui-rubric-web.md`,
`scripts/{web_e2e,check_prod_serve,check_unit_count}.sh`, `scripts/check_rubric.py`,
`scripts/gates/gate-4.sh`.

## 3. Execution check (final `make gate-4`, verdict PASS, exit 0)

| Check | Result |
|---|---|
| types | tsc 0 errors; `make web-types` → api-types.ts unchanged (git diff clean) |
| lint | eslint 0 warnings |
| unit | 41 passed (≥ 40) |
| build | ok; initial JS ≈ 86 KB gzip (≤ 400 KB) |
| e2e | 6/6 passed incl. the 3 required flows + 2 axe scans + screenshots; 0 unexpected console/page errors |
| screenshots | 10 files (5 × 390 px, 5 × 1440 px) |
| rubric | 133/134 = 99 % (≥ 80 %) — `verification/ui-rubric-web.md` |
| contrast | all 8 documented token pairs pass |
| production serve | `/` + `/children/x` serve the SPA; `/api/v1/healthz` OK; `/docs` 404; CSP header present |
| placeholders | clean |
| regression | gate-3 green (7 executable checks; H3 rows BLOCKED as sanctioned) |

## 4. Output correctness (expected vs observed)

- The e2e register→pair flow pairs a real device through the real API and asserts the
  201 + child name + `config_version` — pairing works end-to-end from the browser.
- Live status derives from the seeded session (state `active`, remaining ring 40 m,
  `Updated N s ago`), calm index with label chip; KPIs match the seeded day (screen time
  3 h 30 m, avg calm 68.5, trend −6.9 %).
- The alerts flow: seeded unread alert → badge "3 unread alerts" → mark all read → badge
  clears (aria-label reverts to "Alerts").
- The screenshot review caught and fixed two real defects (spacing-token collision;
  chart data dropping) and one routing bug (double Shell mount) — see the failure report.

## 5. Negative checks (must fail *safely* — real output from the automated suite)

- Login with a wrong password → 401 INVALID_CREDENTIALS mapped to contract copy
  (`test_auth.py::test_login_wrong_password_401` on the API; web unit test asserts the copy).
- RATE_LIMITED shows a live countdown from Retry-After and disables the submit button
  (web unit test with retryAfter = 90).
- Register with a duplicate email → 409 EMAIL_TAKEN with friendly copy (web unit test).
- Invalid settings PATCH → 422 VALIDATION_ERROR (API suite).
- Unknown route → designed orb 404 page (web unit + e2e snapshot).
- axe on overview + alerts: 0 critical/serious (was 2 real violations — a contrast failure on
  a dropped colour class and an aria-hidden focus trap — both fixed, re-scanned).

## 6. Regression re-run of the previous phase gate

Executed as gate-4's final check: gate-3 fully green (ml tests, task hash, model card, git
hygiene, ruff, placeholders; H3 rows BLOCKED as sanctioned) including its own gate-2
regression. Two gate-4 failure cycles (gate-authoring quoting + a missing exec bit) were
logged and fixed — see `verification/failure-phase-4-2026-09-30.md`.

## 7. Verdict

✅ **PASS** — no check skipped, loosened, or unverified. Ready for tag `phase-4-verified`.
