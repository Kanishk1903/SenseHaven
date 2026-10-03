# Visual review — round 1 (post-implementation pass, before verifier)

Reviewer: build agent. Reviewed the `verification/shots/` set (key set: offline, live-calm,
live-stressed, long-strings at 1440 and 390, light and dark — plus pages-matrix shots).

## 1. Overlap / touching

Found (and fixed in this round):
- Offline 1440: ribbon "Now" label collided with the "11:00 PM" tick label — SVG text is
  outside the G1 selector list, so the gate could not see it. Fix: ticks within 34 units of
  the Now marker drop their label.
- Ledger dotted leaders were invisible everywhere: `.ledger-rule` used `var(--rule-strong)`
  but the token had never been emitted (`--rule`/`--rule-strong` missing from tokens.json) —
  border silently dropped. Fix: added `rule`/`rule-strong` to tokens.json + generator; dots
  now render in both themes.
- (Earlier rounds, via G1) mobile bottom tab bar over page content → removed; rail at 768
  rendered expanded content → collapsed below lg; several others — all in the round history
  of /tmp/verify-ui*.log runs and the fix commits.

After fixes: none found in the eight key images.

## 2. Clipping / bad wraps / orphans

- long-strings 390: 40-char name wraps cleanly in the h1 (3 lines, no clipping); ledger value
  `12 h 59 min` holds one line; long app name truncates with ellipsis + title (allowed).
- Ribbon at 390 was squashed with unreadable tick text. Fix: tick density now scales with the
  rendered width (ResizeObserver) — 390px shows 30-min ticks at legible size.

## 3. Three-second test (offline-light-1440)

1. Status sentence "Aarav's phone hasn't checked in for 8 min. Limits still apply."
2. Ring/orb with dashed offline track + 18 min left
3. Ledger numerals (3 h 30 min / 68.5)
Matches the intended order (answer → state → numbers).

## 4. Slop audit

Found and fixed:
- The status sentence and the "Last checked in …" line each rendered twice (page header +
  Now panel). Removed from the panel; the header is the single source, with the amber
  stale state + Refresh button (spec §4.5) living in the header sub-line.
- Header and panel sentences could disagree (header passed no stress context:
  "offered at recently" vs panel "offered at 11:35 PM"). Header now uses the same
  lastStressAt input.

Remaining tells (≤1 per screenshot):
- The Now panel keeps `h-full` and has empty space below the actions in dark 1440 —
  accepted as the "quiet instrument" airiness (named exception; one per view max).
- No emoji, no exclamation marks, no ALL-CAPS, no gradient buttons/cards, no purple-blue
  SaaS palette (primary is a deliberately-printed indigo on paper neutrals).

## 5. D1–D16 spot check vs BEFORE (verification/before/)

- D1 buttons/KPI overlap → fixed (G1 green, bottom bar removed).
- D2 numerals overflow → fixed (data-nowrap + ledger shrink rules).
- D3 Calm Index floating → fixed (inside Now panel next to the ring).
- D4/D5 wrapped numerals → fixed ("12 h 59 min", "18 min" one line).
- D6 empty grey ring → replaced by ring + crafted orb, offline = dashed track.
- D7 contradictory actions → state-driven (offline: queued add-time + disabled lock with
  reason; cooldown: lock/end; locked: start new session).
- D8 "2087 s ago" → humanAgo ("8 min ago"), G9 lint enforces.
- D9 placeholder greeting h1 → status sentence; time-of-day greeting demoted to caption.
- D10 10px chart text → 12px floor (G14 green; CalmChart SVG text bumped 10→12).
- D11 cramped spacing → rem scale + spacing audit (G12/G14 green).
- D12 320px survival → G2 green incl. 200% zoom.
- D13 duplicate alerts/bell → one Alerts nav item with badge.
- D14 offline state → dedicated offline sentence, dashed ring, queued-actions explainer.
- D15 colima/db conflict → environment note, not UI.
- D16 vocabulary → Calm/Neutral/Stressed chips everywhere.
