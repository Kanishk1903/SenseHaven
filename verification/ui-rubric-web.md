# UI Self-Review Rubric — Web (redesign review, ≥ 80 %)

Re-reviewed after the UI/UX redesign (semantic tokens, light/dark themes, Manrope+Inter,
CalmChart with time axis/auto-zoom/crosshair, nav groups + collapse + bottom tab bar,
settings single-column, onboarding stepper). Evidence: 12 committed screenshots
(10 light: 5 pages × 390/1440; 2 dark QA: login + overview at 1440) in
`verification/screenshots/web/`.

## Redesign spec compliance (UI-UX.md sections)

| Spec section | What was implemented | Status |
|---|---|---|
| §2 Semantic tokens light+dark | tokens.json → CSS vars → Tailwind; no raw hex in components | ✓ |
| §3 Theming | System/Light/Dark, localStorage, no-flash inline script (CSP-hashed), live OS sync, Sun/Monitor/Moon toggle in sidebar footer + mobile sheet | ✓ |
| §4 Typography | Manrope Variable (display/numerals/h1/h2) + Inter Variable; scale incl. numeral-xl 64 + body-strong; tabular numerals via tnum class + font-feature cv11/ss01 | ✓ |
| §5 Radii hierarchy | control 10 / card 16 / dialog 20 / hero 24 / pill — migrated across all components | ✓ |
| §6 Motion | duration tokens 120/200/320, ease tokens, active:scale-0.98 press, reduced-motion media (opacity-only) | ✓ |
| §7.8 Charts | CalmChart: labelled time axis (adaptive ticks), Now marker, auto-zoom + Full-day toggle, y-labels Calm/Okay/Stressed, 8% bands + stressed hatch, gradient area, dots at samples, gap regions, crosshair tooltip (mouse + arrow keys), episode flags | ✓ |
| §7.4 Nav | nav groups Monitor/Manage, collapsible 72px icon rail (persisted), tablet rail, mobile bottom tab bar, alerts badge | ✓ |
| §8.4 Overview hero | greeting h1, offline dim + copy, status chip, Calm Index numeral, sparkline, Updated Ns ago, action grouping with undo toast (Add time) | ✓ |
| §8.7 Settings | single column max-w 760, danger zone (outlined), sticky save bar elev-2 | ✓ |
| §8.3 Onboarding | connected stepper (sm+) / "Step N of 3" bar (<480), pairing code as digit tiles grouped 3+3 | ✓ |
| §12 Accessibility | focus ring vars, aria radiogroup on theme, role=radiogroup/progressbar, keyboard chart navigation, aria-live announcements, sr-only chart summary | ✓ |
| §2.5 Contrast | both themes pass WCAG AA (script-verified: 16 light + 16 dark pairs) | ✓ |

## Light-theme page scores (File 02 §7 items, same as previous review)

| Page | Score |
|---|---|
| overview-1440 | 14/14 |
| overview-390 | 13/13 |
| analytics-emotion-1440 | 14/14 |
| analytics-emotion-390 | 13/13 |
| alerts-1440 | 13/13 |
| alerts-390 | 12/12 |
| settings-1440 | 14/14 |
| settings-390 | 13/13 |
| onboarding-1440 | 14/14 |
| onboarding-390 | 13/13 |

## Dark-theme QA (new)

- dark-login-1440.png / dark-overview-1440.png: dark surfaces (#0C0E14/#141722), light text,
  state colours legible, chart gridlines visible, orb/ring render correctly. Verified
  `data-theme=dark` + computed body bg rgb(12,14,20) programmatically.
- Contrast script now validates both themes (all 32 pairs pass).

**Overall pass rate: 133/134 = 99 % — VERDICT: PASS (≥ 80 %). Dark-mode QA: PASS.**

Remaining polish (documented, not blocking): chart tick labels use browser-default locale
formatting; multi-child family strip is P3; density toggle not implemented.
