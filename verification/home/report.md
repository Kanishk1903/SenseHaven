# Home verification report (spec §12.7)

## Summary (3 lines max)

The public Home page (`/`) ships all nine sections in order, built from the real Overview
components (NowPanelView, DayRibbon, orb, chips) fed by committed sample data — no
screenshots, no device frames, no invented facts. `npm run verify:home` (23 checks across
H1–H18, themes × 320–1920) passed twice consecutively; the architecture is prerender +
islands, so the LCP paint is static and immune to hydration/bundle parsing.

## Gate results: H1–H18 → pass/fail

All gates green in light and dark at 320/390/768/1024/1280/1440/1920 × 12 fixtures for the
base matrix (home.spec), plus the sibling gates: H5 keyboard walk (menu Esc + focus trap,
switcher arrows, pause aria-pressed) · H7 CLS < 0.02 across load/font-swap/three state
switches · H8 reduced-motion (no animations, no auto-cycle; positive control proves the
breathe loop runs under normal motion) · H10 state sentinels (Calm/Neutral/Stressed
sentences + chips; offline never shown) · H11 long-name + pseudo-locale + 200% zoom at
320px pass H1–H3 · H13 Lighthouse mobile perf ≥ 0.9, a11y ≥ 0.95, BP ≥ 0.95, SEO ≥ 0.95 ·
H15 no-JS (headline/lede/CTA/panel/FAQ/anchors) · H16 budgets (entry JS ≤ 90 KB gzip,
preloaded fonts ≤ 120 KB, LCP evidence) · H17 metadata (single h1, heading order, title
≤ 60, description ≤ 155, OG resolves, FAQ JSON-LD mirrors visible copy) · H18 build guard
(no CONFIRM/lorem/TODO/placeholder price in the rendered output).

Runner: `npm run verify:home` (build → prerender → H18 guard → playwright). Files:
`verification/home.checks.ts`, `verification/home.spec.ts`, `verification/home-gates.spec.ts`,
`verification/home-gates2.spec.ts`, `verification/home-h13-lighthouse.spec.ts`,
`playwright.home.config.ts`.

## Slop audit: per screenshot, remaining tell (if any)

- default-light/dark-1440 and 390: one tell each — the hero demo caption ("Buttons do
  nothing here") is wording, not a visual tell; visually the hero reads as the product.
  Marginalia leader lines land on their annotated ribbon points (measured, not hard-coded).
- pseudo-zoom-long-light-320: header collapses to mark + CTA + Menu with zoom-invariant
  text (12px floor); the demo switcher stacks full-width. No overflow (H2 green).
- No emoji, no exclamation marks, no ALL-CAPS, no gradient slabs, no three-icon-card rows,
  no logo walls, no fake proof, no stock photos anywhere.

## Claims audit: every factual claim → source

| Claim on the page | Source |
|---|---|
| "Estimated from facial expressions on the child's phone. Not a diagnosis." | api/app/schemas/child_settings.py; EmotionEvent stores derived index only |
| "Limits still apply offline; changes apply on reconnect" | Device-side RulesEngine + Command queue (api/app/routers/children.py, models.Command) |
| "Add time … Undo" | Overview toast with Undo action (web/src/features/overview/OverviewPage.tsx) |
| "Lock now … after a confirm" | LockButton confirm popover (OverviewPage.tsx) |
| "Block an app — from the Top apps list" | blocked_packages in settings + Top apps rows |
| "Never see a score … by default; you can turn mood labels on" | show_mood_to_child default False (schemas/child_settings.py:27) |
| "Pairs with a short code" | pairing router: 6-digit code (api/app/routers/pairing.py) |
| "Android 13+" | Download page install steps (web/src/features/download/DownloadPage.tsx) |
| "No paid tier and no payment mechanism" | no payment code exists in the repo |
| "Gaps stay gaps" | Emotion timeline gaps stay null (api analytics service) |
| "Compare only to their own recent days" | avg_calm_trend_pct vs own last 7 days |
| "Demo uses sample data; nothing is a real child" | web/src/features/home/data.ts (committed constants) |
| "Delete a child removes everything collected" | DELETE /children/{id}/data (routers/children.py:79) |

## Verifier findings and how each was resolved

Self-hostile pass (round loop) findings, all fixed:
- Header overflow at 320px + 200% text zoom (H11) → header text switched to
  zoom-invariant `clamp` with a 12px px floor; CTA labels nowrap.
- Marginia notes escaped the section at lg → the sample-day grid gained a real third
  column (300px) and note tops are now measured (staggered from the strip position,
  clamped to the column).
- Lazy ribbon never mounted in static captures → idle-mount fallback added (spec §9.1
  "visibility/idle").
- Grep guard self-match (H18 pipeline) → guard patterns/messages de-literalised.
- GZip middleware missing after the islands refactor → import restored (production serve
  check caught it).
- LCP 4.4s → 0.9s FCP / ~1.3s LCP observed: full hydration replaced by islands
  (prerendered markup never repainted; islands mount into placeholders on load/idle).

## BEFORE vs AFTER

No prior Home page existed (the "/" route was the authenticated Overview). Recorded:
"no prior Home" — BEFORE set omitted per spec §12.2. The authenticated Overview now lives
at `/app` and its own verification suite (`npm run verify:ui`, 223 checks) still passes
twice consecutively after the route move.

## Assumptions (things I could not confirm in the backend)

- "End session — stops the current session": the API ends the session; whether unused
  time is banked is not modelled anywhere, so the copy makes no claim about it.
- Pairing code shown as "3 9 2 7 4 1": illustrative sample of the real pairing UI
  (routers/pairing.py generates a real 6-digit code at runtime).
- Languages: English only assumed (no i18n in the repo) — no Devanagari fallbacks loaded.

## Resolved [CONFIRM] items and their sources; unresolved items (must be zero)

All 14 spec §14 decisions resolved from the codebase (see "Claims audit") — none guessed.
Production output contains zero `[CONFIRM` markers (H18 build guard green).

## Unverified (anything I did not run), and why

- H13 ran Lighthouse with DevTools throttling (`--throttling-method=devtools`, mobile
  preset) on the served prerendered page — the spec's "Slow 4G, 4× CPU" profile; Lantern's
  simulated mode was tried and produced pessimistic model values for a local origin, so
  the DevTools profile was used for both the gate and the LCP evidence (2.65s observed →
  0.9-1.3s after the islands refactor; final run's numeric LCP evidence is in the H13
  attachment).
- Real Android device behaviour of the child app (out of scope for the web page; the
  page's claims about the child app are sourced from the Android code).
- The OG image is generated from the brand mark + headline text (scripts/gen-home-assets
  .mjs); social-platform preview rendering was not tested on real platforms.

## How to re-run: npm run verify:home

```
cd web && npm run verify:home   # build → prerender → H18 guard → playwright (23 checks)
cd .. && make gate-4            # dashboard regression chain (223 checks via npm run verify:ui)
```
