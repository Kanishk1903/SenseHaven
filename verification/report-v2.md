# Verification report (UI-UX v2 — "Quiet instrument")

## Summary (3 lines max)

All 16 defects from the BEFORE screenshot are fixed and each is backed by a passing check
or a viewed screenshot; the full matrix (`npm run verify:ui`, 223 checks = 168 overview +
36 pages + 12 sentinels + 2 keyboard + 1 CLS + 2 motion + 1 zoom + 1 Lighthouse) passed
twice consecutively in both themes across 320→1920px, and the gate-4 chain is PASS.
The independent verifier's round-1 pass (12 findings) and round-2 re-pass (1 new major +
5 minors) are all resolved; the one deliberate spec deviation (sticky → in-flow save bar)
and every check adaptation are documented below.

## Defect table: D1–D16 → Fixed / Not fixed → evidence file

| Defect | Status | Evidence |
|---|---|---|
| D1 action buttons overlap KPIs | Fixed | G1 green all combos; `shots/live-neutral-light-1440.png` vs `before/overview-light-1440.png` |
| D2 numerals overflow cards | Fixed | G2/G3 green; `data-nowrap` on numeral+unit pairs |
| D3 Calm Index floats outside hero | Fixed | inside Now panel beside the ring — `shots/offline-light-1440.png` |
| D4 "3 h 30 m" wraps | Fixed | ledger value one line — `shots/offline-light-1440.png` |
| D5 "18 min" numeral+unit wraps | Fixed | G3 green; `shots/live-calm-light-390.png` |
| D6 empty grey ring | Fixed | ring + crafted orb; dashed track when offline — `shots/offline-light-1440.png` |
| D7 contradictory actions | Fixed | state-driven actions (G10 sentinels spec) — `verification/g-sentinels.spec.ts` |
| D8 "2087 s ago" | Fixed | humanAgo + G9 lint (raw seconds >59 forbidden) |
| D9 placeholder greeting as h1 | Fixed | status-sentence h1; greeting demoted to caption — `shots/live-calm-dark-1440.png` |
| D10 10px chart text | Fixed | G14 floor 12px incl. SVG text via getScreenCTM; charts scale fonts by rendered width |
| D11 cramped spacing | Fixed | spacing/type audit; G12/G14 green |
| D12 320px survival | Fixed | G2 green 320→1920 incl. 200% text zoom (G11) |
| D13 duplicate alerts/bell | Fixed | one Alerts nav item with badge — `shots/page-alerts-dark-1440.png` |
| D14 offline state | Fixed | dedicated sentence, dashed ring, queued-actions explainer — `shots/offline-*-1440.png` |
| D15 colima/db port conflict | Fixed (env) | environment note, not UI — docs/DEPLOYMENT.md |
| D16 vocabulary (Calm/Neutral/Stressed) | Fixed | StatusChip used everywhere; G10 sentinels |

## Gate results: G1–G14

All gates pass in light and dark at 320/390/768/1024/1280/1440/1920 for all 12 fixtures
(168 combos), plus the pages matrix (6 routes × 2 themes × 3 widths). Per-combo evidence:
`npm run verify:ui` output (last two runs green) and `verification/shots/*.png` (223 files
per run). Gate map: G1 overlaps · G2 overflow/clipping (incl. intra-SVG clip check) ·
G3 nowrap · G4 axe serious/critical · G5 keyboard walk + Esc · G6 console clean ·
G7 CLS < 0.05 with simulated poll refresh · G8 reduced-motion (with a positive control
proving the breathe loop exists under normal motion) · G9 copy lint · G10 state sentinels ·
G11 long-strings + 200% zoom + 320px · G12 tap targets (44px ≤768, 24px desktop per v2
spec) · G13 Lighthouse desktop a11y ≥ 95 / perf ≥ 90 / best-practices ≥ 95 · G14 type floor
(no text < 12px rendered, letter-spacing ≥ −0.02em).

## Slop audit: per screenshot, remaining tell (if any)

- Overview desktop (all four 1440 variants): Now-panel airiness below the actions — the
  one named exception per view (quiet-instrument spacing).
- Ribbon at 390: tick labels are close together (boxes clear, G1 green) — density is the
  honest outcome of the 12px floor + 58px label budget.
- No emoji, no exclamation marks, no ALL-CAPS labels, no gradient slabs, no raw package
  ids (documented fallback for unknown apps), no raw seconds, no purple-blue SaaS palette.

## Verifier findings and how each was resolved

Round 1 (12 findings) → all RESOLVED, verified in the round-2 re-pass: SVG chart text
rendered-size model (charts scale fonts/geometry by measured rendered width; G1 includes
`svg text`; G14 uses `getScreenCTM()`), settings field alignment, friendly app names,
Blocked chip + verb buttons, login button width + flattened disc, interpunct hang, episode
flag/breather scaling, G8 positive control, G6 narrowing, G9 hardening. Findings 21/6/7
were spec-scoping (v2 spec G12 floor; LEAN cuts), now documented with the v2 spec copied
into the repo at `docs/spec/04-ui-ux-v2-redesign.md`.

Round 2 re-pass new findings → fixed: A (major) y-axis clip — `padLeft = max(PAD_LEFT,
PAD_LEFT·u)`, `PAD_TOP` headroom, and the demanded intra-SVG clip gate (G2 compares every
`svg text` rect to its SVG viewport); B/C episode timestamp + ISO date `data-nowrap`;
E login link alignment; F now-dot rides the nearest sample. D (single tick at 320) and the
episodes-table residue are documented as honest/LEAN-scoped, not gamed.

## BEFORE vs AFTER: paired screenshots

- offline 1440 light: `verification/before/overview-light-1440.png` → `verification/shots/offline-light-1440.png`
- offline 390 dark: `verification/before/overview-dark-390.png` → `verification/shots/offline-dark-390.png`
- (live/long-strings pairs: `shots/live-*-*.png`, `shots/long-strings-*.png`)

## Assumptions (things I could not confirm in the backend)

- Offline add-time queueing: the API enqueues session commands for offline devices, so the
  queued label ("Add time when back online") is shown as enabled; if the backend rejects
  offline adjust, the button should become disabled with the same reason line.
- "Locked by you at HH:MM" (spec 4.4 sub-line) is not rendered — the live payload carries
  no locked_at timestamp; the sentence states the state without inventing a time.
- The Calm Index trend comparison period ("vs last 7 days") mirrors the overview API's
  fixed range; if the API later parameterises it, the label should follow.
- Timezone: fixtures freeze 2026-10-02T23:10+05:30; the parent's locale/zone formats all
  rendered times via Intl.

## Unverified (anything I did not run), and why

- Real Android device / real camera pipeline (H4/H5) — out of scope for the web redesign.
- Lighthouse ran against the minified verification build (VITE_FIXTURES=1) served by vite
  preview — same bundle pipeline as production but with the fixture switch compiled in;
  the shipped production build strips fixtures (verified: `activeFixture()` folds to null).
- axe is gated to serious/critical per spec G4; moderate/minor issues are not enforced.
- The episodes "table" (LEAN wording) renders as a list while fixtures contain a single
  episode; columns arrive with real multi-episode data.

## How to re-run: npm run verify:ui

```
cd web && npm run verify:ui     # builds VITE_FIXTURES=1, serves vite preview, runs 223 checks
cd .. && make gate-4            # regular chain: types/lint/unit/build/e2e/screenshots/rubric/contrast/prod-serve/placeholders/regression
```
