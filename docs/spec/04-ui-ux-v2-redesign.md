# SenseHeaven — Overview Redesign, Bug Fix and Verification Prompt (v2)

**Give this whole file to your coding agent.** It supersedes the *visual* parts of `UI-UX.md` (typography, colour, card styling, Overview layout). Everything else in `UI-UX.md` (information architecture, copy rules, accessibility floor, screen list, build order) stays as the baseline.

---

## 0. Your role and operating rules

You are a senior product designer and front-end engineer. You will (1) fix a visibly broken dashboard, (2) give it a distinctive identity that does not look AI-generated, and (3) **prove** it works with automated checks and screenshots you have actually looked at.

Rules that apply to the whole task:

1. **Discover before you change.** Read the repo, find the framework, router, styling system, data layer and the Overview route. Do not assume React/Tailwind; confirm it.
2. **Find root causes.** The current layout collides because of structural problems (likely absolute positioning, fixed widths, grid children missing `min-width: 0`, unbreakable content in `fr` tracks). Do not patch symptoms with `overflow: hidden`, `!important`, or magic pixel offsets.
3. **Vertical slice first.** Build the design system + app shell + Overview, verify it fully (section 8), and only then propagate to other screens.
4. **Evidence over assertion.** "The code looks right" is not evidence. Evidence is: a screenshot you opened and inspected, or the output of a check you ran. Never report something as verified that you did not run.
5. **Never invent product behaviour.** If the backend/device cannot do something (for example, deliver "Lock now" while the phone is offline), read the code/API and reflect the real behaviour. If unknown, ask or mark it as an assumption in the report.

---

## 1. What is wrong right now (from the screenshot)

Treat each as a defect with a test. IDs are referenced in the verification section.

| ID | Defect | Required outcome |
|---|---|---|
| D1 | The action buttons (Add time / Lock now / End session / Start session) overlap the "Breathers started" KPI text. | Zero overlapping text or controls anywhere. |
| D2 | The "Calm Index", "58" and "Neutral" chip float outside the hero card and collide with the "Screen time 3h 30m" tile. | All hero content stays inside the hero's box at every width. |
| D3 | Hero card and KPI cards physically overlap each other. | Grid tracks never overlap; content cannot push past its track. |
| D4 | "3h 30 m" breaks across lines, orphaning the "m". | Numbers and their units never wrap (`white-space: nowrap`, unit in a smaller span). |
| D5 | Avg calm delta wraps into 4 lines ("vs / -6.9% last / period"). | Delta is one line, or a clean two-line block with fixed structure. |
| D6 | The ring is an empty grey circle with cramped "40 m remaining" text inside. No progress arc, no orb. | Real progress arc + orb; time remaining set in its own typographic block. |
| D7 | Contradictory actions shown together: **End session** and **Start session**. Start session is a white fill unlike every other button. | Only actions valid for the current state are shown. Consistent button system. |
| D8 | Raw "Updated 488 s ago". | Human time: "8 min ago". Absolute time on hover. |
| D9 | "Hi Aarav's parent" and a subtitle phrased like a prompt, not an answer. | Use the parent's name (fallback "Hello"). The page answers the parent's question in a sentence (section 4.4). |
| D10 | Letter-spacing so tight that glyphs touch ("Aarav's today", "Calm timeline — today"). | Negative tracking only on display sizes ≥ 28px, never tighter than -0.02em. Body tracking 0. |
| D11 | Chart: ~8px axis labels, unreadable legend, empty left padding, line starts mid-chart with no gap marker, legend says "Okay" while the chip says "Neutral". | Min 12px chart text, one vocabulary (Calm / Neutral / Stressed), gaps drawn as gaps. |
| D12 | Alerts list shows the same alert twice, the card is clipped at the bottom, and times are in 24h ("23:05") while other places differ. | Dedupe/group, never clip, one locale-aware time format. |
| D13 | Stray "•" dots beside the logo and child name (looks like broken icon/avatar fallbacks); the bell badge collides with the child row. | Real logo mark and orb avatar; notifications live on the Alerts nav item. |
| D14 | Offline state ignores the spec (ring not dashed, no last-seen time, no explanation of what still works). | Implement the offline state in 5.3. |
| D15 | Everything has equal visual weight; the hero is half empty. | Clear hierarchy: one dominant element, the rest recessive. |

Before you change any code: run the app, capture **BEFORE** screenshots of Overview in light and dark at 1440 and 390 wide, and save them to `verification/before/`. Reproduce D1–D4 and write down the root cause of each.

---

## 2. Why it reads "AI-generated" (banned patterns)

The current screen has the standard tells. **Remove all of them** and do not reintroduce them on any other screen:

- Every block is the same rounded rectangle with the same border and padding.
- Glass/gradient borders, backdrop blur, glowing edges, purple-indigo gradients.
- A 2×2 grid of "big bold number + tiny label" KPI tiles.
- Heavy negative letter-spacing and everything set in bold.
- An icon on every label; icon-in-coloured-square list bullets.
- Symmetric, evenly weighted layouts with no focal point.
- Generic copy ("Welcome back", "Unlock insights", "Hi X's parent").
- A blurry gradient circle used as an "orb" with no craft.
- Emoji or exclamation marks in system copy.

**Slop audit (used in verification):** score each screenshot against these nine points. A screen may have at most **one** remaining tell, and you must name it.

---

## 3. Design concept: "Quiet instrument"

SenseHeaven should feel like a well-made instrument or a good almanac: calm, specific, printed-on-paper rather than glowing-on-glass. The parent is anxious; the screen should answer a question in plain words, then show evidence.

Principles:

1. **Answer first.** The page headline is a sentence that answers "Is everything OK right now?" (4.4).
2. **One raised surface.** On Overview only the *Now* panel sits on a raised surface. Everything else sits on the page background and is separated by hairline rules and whitespace. This breaks the card-grid look.
3. **Typography does the work.** Hierarchy comes from size, weight, serif vs sans, and spacing, not from boxes.
4. **Honest data.** Gaps stay gaps. Estimates are labelled. Offline is shown as offline.
5. **Calm colour.** State colours (calm / neutral / stress) are reserved for state. Indigo is used for exactly one thing per screen: the primary action.
6. **Few, meaningful motions.** The orb breathes only when calm. No decorative motion.

### 3.1 Typography (replaces Manrope + Inter)

| Role | Face | Notes |
|---|---|---|
| Display, numerals, page headline, section labels | **Fraunces** (variable, use `opsz`, keep `SOFT` low, `WONK` off) | Warm, human. Gives the product a voice that is not the default SaaS look. |
| UI and body | **Instrument Sans** (variable) | Clean, slightly narrow, distinct from Inter. |
| Timestamps, IDs, checksums, ledger values | **JetBrains Mono** or **Geist Mono** | Tabular and precise. Use sparingly. |

- Self-host all fonts, `font-display: swap`, `size-adjust` fallbacks so there is no layout shift.
- Scale (desktop / mobile): headline 34/40 → 28/34, numeral-xl 56/56 → 44/44, h2 22/28, body 16/24, secondary 14/20, caption 12/16 (nothing smaller than 12px anywhere, including charts).
- Tracking: display −0.02em max, body 0. Sentence case only. No ALL-CAPS labels.
- Numerals: `font-variant-numeric: tabular-nums` everywhere they update.
- Units sit next to numbers at about 55% of the numeral size, baseline-aligned, never on their own line.

### 3.2 Colour tokens (replaces section 2.1 of `UI-UX.md`; state colours from 2.2 are kept so the child app stays aligned)

Light "Paper" and dark "Ink". Start from these values, then **measure contrast and adjust until every pair passes** (text ≥ 4.5:1, large text and graphics ≥ 3:1). Do not copy the numbers on trust.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F3F0E9` | `#0E0E10` |
| `--surface` (the Now panel, popovers) | `#FBF9F4` | `#17171A` |
| `--surface-2` | `#ECE8DF` | `#1F1F23` |
| `--rule` (hairlines) | `#DDD8CB` | `#2B2B30` |
| `--rule-strong` | `#BDB7A7` | `#44444B` |
| `--text` | `#1A1916` | `#EFECE4` |
| `--text-muted` | `#5B574D` | `#A8A498` |
| `--primary` | `#3B46D9` | `#8E98FF` |
| `--on-primary` | `#FFFFFF` | `#0E0E10` |

State colours: reuse `--calm / --neutral / --stress` (`base`, `fg`, `soft`) from `UI-UX.md` 2.2.

- Dark mode uses lighter surfaces and rules, not shadows.
- No `backdrop-filter`. No gradient borders. No glow except the optional ≤ 8% mood tint in the Now panel corner.
- Shape: radius scale 4 / 10 / 20. Controls 10, the Now panel 20, chips full. Not everything is 24.
- Theme system, no-flash script and Tailwind wiring from `UI-UX.md` section 3 stay as written.

### 3.3 The orb (craft it, do not just blur a circle)

Draw it as an SVG, not a CSS gradient blob:

- Crisp 1px rim in `--rule-strong`.
- Base fill from two radial stops in the current state colour (calm → teal-green, neutral → amber, stressed → coral, offline → desaturated grey).
- A small offset highlight ellipse (white at 25–35% alpha) top-left.
- A flat, soft contact shadow ellipse beneath, so it looks like an object sitting on the page.
- Breathes (scale 1 → 1.03, 6s) only when state is calm and reduced-motion is off.

Used as: logo mark, child avatar, ring centre, empty states, 404, favicon.

---

## 4. Overview specification

### 4.1 Layout (desktop ≥ 1180px content width; max content width 1180, rail 232 or 72 collapsed)

```
┌ rail ┬─────────────────────────────────────────────────────────────┐
│      │ Aarav is doing okay. 40 min left in this session.   (h1)   │
│      │ Last checked in 8 min ago · Calm Index is an estimate       │
│      ├──────────────────────────────────┬──────────────────────────┤
│      │ NOW  (the only raised surface)   │ Today        (no surface)│
│      │  ring+orb   40 min left          │ Screen time ··· 3 h 30 min│
│      │             Calm Index 58        │ Average calm ··· 68.5  ▾  │
│      │             Neutral · estimated  │ Breathers ····· 0         │
│      │  [Add time]  Lock now   ⋯        │ Bonus earned ··· 0 min    │
│      ├──────────────────────────────────┴──────────────────────────┤
│      │ Today's day ribbon                                          │
│      │ Insight sentence                                            │
│      │ ▓▓▓▒▒▓▓▓░░▓▓▓  (ribbon + line + session brackets)  now ▏    │
│      │ 8 PM        9 PM         10 PM        11 PM                 │
│      ├──────────────────────────┬──────────────────────────────────┤
│      │ Worth a look (alerts)    │ Top apps today                   │
└──────┴──────────────────────────┴──────────────────────────────────┘
```

Build it with **named CSS grid areas** and container queries, never absolute positioning for flow content.

- ≥ 1180: two columns `minmax(0, 1.6fr) minmax(280px, 1fr)`.
- 768–1179: Now panel full width, Today ledger below it in two columns.
- < 768: single column; Today becomes a ledger list; the Now panel stacks ring above text; action buttons become a full-width row (primary full width, secondary beside overflow).
- Every grid child gets `min-width: 0`. Every text container that can be long has an explicit wrap or truncate rule and `title` or tooltip for truncated text.
- No fixed heights on text containers.

### 4.2 Now panel

- Ring 176px (140 on mobile): 10px track in `--rule`, progress arc with rounded caps, orb inside (96px). **Time remaining is not inside the ring.** It sits to the right as a Fraunces numeral: `40` `min` + "left in this session".
- Under it: Calm Index as one line: **58** · Neutral chip · "estimated from facial expressions", with a 30-minute sparkline (with time ticks).
- Actions are state-driven (this fixes D7):

| State | Visible actions |
|---|---|
| Session running | **Add time** (primary), Lock now (secondary, with confirm popover), `⋯` menu → End session |
| No session | **Start session** (primary), Lock now |
| Locked | **Unlock / Start session** per backend capability (read the API) |
| Offline | Add time (label becomes "Add time when back online" only if the backend queues it), Lock now disabled with a one-line reason under it |

- After any action: toast with Undo where reversible (Add time 10s).
- Disabled actions always show the reason in text directly beneath, not only in a tooltip.

### 4.3 Today ledger (replaces the 2×2 KPI tiles; fixes D4, D5)

A definition list with dotted leaders between label and value (CSS: flex row, `border-bottom: 1px dotted var(--rule-strong)` on a growing spacer). Values in the mono or serif tabular face.

- Screen time `3 h 30 min`
- Average calm `68.5` with `▾ 6.9% vs last 7 days` on one line (delta in neutral/amber, **never red**; state the comparison period from the API, do not invent it)
- Breathers started `0`, with the sub-line "moments the app suggested a pause" shown once, in `caption`
- Bonus earned `0 min`, with "0 min lost to penalties" in `caption` (hide the caption if the API says penalties are disabled)

### 4.4 The status sentence (h1)

Generated from state. Plain, specific, no exclamation marks, no emoji, the child's name is used (no "your child").

| State | Headline | Sub-line |
|---|---|---|
| live, calm | "Aarav is calm. 22 min left in this session." | "Updated 4 s ago" |
| live, neutral | "Aarav is doing okay. 40 min left in this session." | as above |
| live, stressed | "Aarav has had a tense few minutes. A breather was offered at 11:05 PM." | as above |
| session ending (< 5 min) | "5 min left in Aarav's session." | ring turns amber |
| offline | "Aarav's phone hasn't checked in for 8 min. Limits still apply." | "Last seen 11:02 PM. What to try" |
| no session | "Aarav isn't in a session right now." | "Start one when he is ready." (use the correct pronoun or avoid it) |
| locked | "Aarav's phone is locked." | "Locked by you at 10:40 PM." |

Greeting (time of day + parent first name) can sit above in `caption` size: "Good evening, Priya". Fallback "Hello".

Time formatting: relative within 24h ("8 min ago"), then absolute, always `Intl.DateTimeFormat` with the parent's locale and time zone, full timestamp on hover. Never raw seconds above 59.

### 4.5 Offline state (fixes D14)

- Ring track becomes dashed; orb desaturated with a small "no signal" glyph.
- Do **not** dim the whole panel (it hurts legibility). Show a plain status row: icon + "Offline since 11:02 PM" + one sentence: "Limits still work offline. Anything you change here will apply when the phone reconnects." (only if true per backend).
- Countdown shows "about 40 min left" with an "estimated" label.
- "Updated" turns amber after 90 s with a Refresh ghost button.

### 4.6 Day ribbon (the signature visual; replaces the plain line chart as the main view)

- A 56px-high strip. X = time. Each reading is coloured by mood using a continuous calm → neutral → stress interpolation (OKLCH), so the day reads like a sunrise strip.
- A thin line (2px) over it shows the exact Calm Index value; hover/focus shows a crosshair tooltip with time, value and state.
- **Gaps** (no readings) render as a hatched pattern, never interpolated. Legend: "Hatched = no readings. We never guess between samples."
- **Session brackets** under the ribbon: thin horizontal brackets labelled with the session length, so "what was happening" is visible.
- **Breather markers**: small circle glyphs on the ribbon, keyboard focusable.
- Auto-zoom to the active window (first reading − 15 min to now + 15 min); toggle "Active hours | Full day".
- Axis: adaptive ticks (1h/2h/3h), 12px labels, a "Now" marker with label. State names are exactly Calm / Neutral / Stressed everywhere (fixes D16 vocabulary).
- Accessibility: summary sentence above, "View as table" disclosure, arrow keys move between samples with a polite live announcement, pattern + icon redundancy for colour-blind users.
- Insight sentence above the ribbon (rules-based, no ML): "Aarav was calmest between 4 and 5 PM and had two stress episodes after 8 PM."

### 4.7 Alerts ("Worth a look") and Top apps

- Group consecutive identical alerts within 10 minutes: "Breather started at 11:05 PM (2 times)". Unread = a left dot + weight 600. Show the latest 5, the list never clips (let it grow, no inner fixed height).
- Copy uses "stress signals" and "breather". It does not label the child.
- Top apps: bar list, duration right-aligned in tabular numerals, Blocked chip, row menu with Block.
- Alerts nav item holds the unread badge. Remove the bell and badge from the child row (fixes D13).

### 4.8 Shell

- Rail with real logo mark (orb + wordmark), child switcher showing the orb avatar and name (no stray dots), nav with 2px left indicator on the active item and weight 600 (no heavy filled slab), collapsible to a 72px icon rail, theme control in the footer.
- Loading, empty, error, stale and offline states are designed for every panel. Skeletons match final geometry.

---

## 5. Robustness rules (the anti-breakage contract)

Add these data attributes so the checks in section 8 can see intent:

- `data-nowrap` on every numeral + unit pair, chip, button label and ledger value.
- `data-allow-truncate` only on elements where truncation is deliberate (with a tooltip).
- `data-scroll-x` on containers that scroll horizontally on purpose (tables, code).
- `data-testid="overview-ready"` / `"overview-loading"` on the page root when data is settled / loading.

Rules:

1. No absolute positioning for content that participates in layout (only for badges, markers, tooltips).
2. No `overflow: hidden` to hide a layout problem. If it is clipped, fix the cause.
3. Use `clamp()` for type, `rem` for sizes, logical properties for spacing.
4. Everything survives: 320px width, 200% text zoom, 40% longer strings, a 40-character child name, `99+` alerts, 0 values, and `12 h 59 min`.
5. No layout shift when polling updates arrive (reserve space, tabular numerals).

---

## 6. Build order

1. Tokens, themes, fonts, orb SVG, button/chip/ledger/ring primitives.
2. App shell + Overview (sections 4.1–4.8) behind the fixture harness (section 7).
3. **Run the full verification (section 8) on this slice. Do not continue until it passes.**
4. Propagate the system to Analytics, Alerts, Settings, Onboarding, Login, Account, Download, 404 following `UI-UX.md` section 8, using the same open, rule-based layout. Re-run verification for each screen.

---

## 7. Fixture harness (needed for verification)

Add a dev/test-only mock layer (MSW or a `?fixture=` switch that is stripped from production builds) and a frozen clock (`page.clock.setFixedTime`, time `2026-10-02T23:10:00+05:30`). Fixtures:

`live-calm`, `live-neutral`, `live-stressed`, `session-ending`, `offline`, `stale` (last update > 90 s), `locked`, `no-session`, `loading`, `empty`, `error`, `long-strings` (40-char names, long app names, `12 h 59 min`, `99+` alerts, pseudo-locale with +40% text length).

Use the real values from the screenshot for `offline`: session 40 min remaining, Calm Index 58, screen time 3 h 30 min, avg calm 68.5 (down 6.9%), breathers 0, bonus 0, last update 488 s ago, duplicate breather alert at 23:05.

---

## 8. Verification protocol (mandatory, you may not skip any step)

### 8.1 Rules of evidence

- Every claim in your final report must point to a file: a screenshot path, a test name, or a command output.
- Anything you could not run (for example, no browser available) is listed under **Unverified**, not implied as done.
- You may not weaken a check, raise a threshold, delete a test, add `eslint-disable`, `@ts-ignore`, or hide a failing fixture to get green. If a check is wrong, explain why in the report and fix the check transparently.
- Clipping counts as failure even if it is hidden by `overflow: hidden`.

### 8.2 Matrix

Themes `light`, `dark` × viewports `320, 390, 768, 1024, 1280, 1440, 1920` × all fixtures in section 7. Save full-page screenshots to `verification/shots/{fixture}-{theme}-{width}.png`. Also capture: reduced motion (`reducedMotion: 'reduce'`), forced colours (`forcedColors: 'active'`), and 200% text zoom (`document.documentElement.style.fontSize = '200%'`).

### 8.3 Automated gates (all must be zero failures)

| Gate | Check | Defects covered |
|---|---|---|
| G1 | No two text or control elements overlap (bounding-box intersection > 2px, excluding ancestor/descendant). | D1, D2, D3 |
| G2 | No horizontal page scroll; no text clipped by `overflow`; nothing extends past the viewport unless inside `[data-scroll-x]`. | D2, D12 |
| G3 | Every `[data-nowrap]` stays on one line (height ≤ 1.5 × line-height). | D4, D5 |
| G4 | axe-core: 0 serious/critical violations in both themes, including colour contrast. | a11y floor |
| G5 | Keyboard walk: every interactive element reachable by Tab, visible focus ring that is not clipped, Esc closes popovers, no traps. | a11y floor |
| G6 | No console errors or warnings, no failed requests (other than fixture-injected). | quality |
| G7 | CLS < 0.05 including after a simulated poll refresh. | perf |
| G8 | Under reduced motion, no running animations (`document.getAnimations()` is empty after settle). | a11y |
| G9 | Copy lint on rendered text: no seconds above 59 ("488 s"), no `undefined`/`NaN`/`[object`, no "'s parent", no emoji, no `!`, no ALL-CAPS labels. | D8, D9 |
| G10 | State sentinels: each fixture shows its expected headline (4.4), the right actions (4.2), and "Offline" has a dashed ring and last-seen time. | D7, D14 |
| G11 | `long-strings` fixture + 200% zoom + 320px pass G1–G3. | robustness |
| G12 | Tap targets ≥ 44px at ≤ 768px, ≥ 24px on desktop. | a11y |
| G13 | Lighthouse (desktop): accessibility ≥ 95, performance ≥ 90, best practices ≥ 95. | quality |
| G14 | Type floor: no rendered text under 12px; no letter-spacing tighter than −0.02em. | D10, D11 |

Expose all of this as `npm run verify:ui` (and run it in CI). Commit the specs.

### 8.4 Reference implementation of the layout checks (adapt to the repo)

```ts
// verification/checks.ts
import type { Page } from '@playwright/test';

export const findOverlaps = (page: Page) => page.evaluate(() => {
  const label = (e: Element) => `<${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 30)}"`;
  const els = [...document.querySelectorAll<HTMLElement>(
    'h1,h2,h3,h4,p,span,a,button,label,li,dt,dd,td,th,[data-nowrap]'
  )].filter(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' &&
      (ownText || ['BUTTON', 'A'].includes(el.tagName));
  });
  const issues: string[] = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 2 && h > 2) issues.push(`${label(a)} overlaps ${label(b)} (${Math.round(w)}x${Math.round(h)}px)`);
  }
  return issues;
});

export const findOverflow = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) out.push(`page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`);
  document.querySelectorAll<HTMLElement>('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const clipX = ['hidden', 'clip'].includes(cs.overflowX), clipY = ['hidden', 'clip'].includes(cs.overflowY);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
    const tag = `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 30)}"`;
    if (hasText && !el.hasAttribute('data-allow-truncate') &&
        ((clipX && el.scrollWidth > el.clientWidth + 1) || (clipY && el.scrollHeight > el.clientHeight + 1)))
      out.push(`${tag} is clipped`);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > innerWidth + 1 && !el.closest('[data-scroll-x]')) out.push(`${tag} extends past viewport`);
  });
  return out;
});

export const findWrappedNoWrap = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>('[data-nowrap]')].flatMap(el => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const r = el.getBoundingClientRect();
    return r.height > lh * 1.5 ? [`"${el.textContent?.trim()}" wrapped (${Math.round(r.height)}px tall)`] : [];
  }));

export const findSmallTargets = (page: Page, min: number) => page.evaluate((min) =>
  [...document.querySelectorAll<HTMLElement>('button,a[href],[role=button],input,select,textarea')].flatMap(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.width < min || r.height < min)
      ? [`<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 20)}" is ${Math.round(r.width)}x${Math.round(r.height)}`] : [];
  }), min);

export const copyLint = (text: string) => {
  const rules: [RegExp, string][] = [
    [/\b(6\d|[7-9]\d|\d{3,})\s?s ago\b/i, 'raw seconds above 59'],
    [/undefined|NaN|\[object/, 'leaked value'],
    [/'s parent\b/i, 'placeholder greeting'],
    [/!/, 'exclamation mark'],
    [/\p{Extended_Pictographic}/u, 'emoji'],
  ];
  return rules.filter(([re]) => re.test(text)).map(([, why]) => why);
};
```

```ts
// verification/overview.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { findOverlaps, findOverflow, findWrappedNoWrap, findSmallTargets, copyLint } from './checks';

const VIEWPORTS = [320, 390, 768, 1024, 1280, 1440, 1920].map(w => ({ width: w, height: w < 768 ? 844 : 900 }));
const THEMES = ['light', 'dark'] as const;
const FIXTURES = ['live-calm','live-neutral','live-stressed','session-ending','offline','stale',
                  'locked','no-session','loading','empty','error','long-strings'];

for (const theme of THEMES) for (const vp of VIEWPORTS) for (const fx of FIXTURES) {
  test(`overview · ${fx} · ${theme} · ${vp.width}`, async ({ page }) => {
    const logs: string[] = [];
    page.on('console', m => ['error', 'warning'].includes(m.type()) && logs.push(m.text()));
    page.on('pageerror', e => logs.push(String(e)));
    await page.setViewportSize(vp);
    await page.clock.setFixedTime(new Date('2026-10-02T23:10:00+05:30'));
    await page.addInitScript(t => localStorage.setItem('sh-theme', t), theme);
    await page.goto(`/?fixture=${fx}`);
    await page.getByTestId(fx === 'loading' ? 'overview-loading' : 'overview-ready').waitFor();

    await page.screenshot({ path: `verification/shots/${fx}-${theme}-${vp.width}.png`, fullPage: true, animations: 'disabled' });

    expect.soft(await findOverlaps(page), 'G1 overlaps').toEqual([]);
    expect.soft(await findOverflow(page), 'G2 overflow/clipping').toEqual([]);
    expect.soft(await findWrappedNoWrap(page), 'G3 wrapped nowrap').toEqual([]);
    expect.soft(await findSmallTargets(page, vp.width <= 768 ? 44 : 24), 'G12 targets').toEqual([]);
    expect.soft(copyLint(await page.locator('main').innerText()), 'G9 copy').toEqual([]);
    expect.soft(logs, 'G6 console').toEqual([]);

    const axe = await new AxeBuilder({ page }).analyze();
    expect.soft(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')), 'G4 axe').toEqual([]);
    // G5, G7, G8, G10, G11, G13, G14: implement as sibling specs (keyboard walk, CLS observer,
    // getAnimations() under reducedMotion, per-fixture sentinel text, 200% zoom pass, Lighthouse, font-size/tracking scan).
  });
}
```

### 8.5 Visual review (you must actually look)

Open every screenshot in the `before` set and at least these in the `after` set: `offline`, `live-calm`, `live-stressed`, `long-strings` at 1440 and 390, in both themes (8 images minimum), plus any screenshot a gate flagged. For each, write in `verification/round-N.md`:

1. Does any text or control overlap or touch? (Name the exact elements or say "none found".)
2. Is anything clipped, wrapped badly or orphaned?
3. Three-second test: what does the eye land on first, second, third? Is that the intended order?
4. Slop audit (section 2): which tells remain? (max one)
5. Compare against the BEFORE image: which of D1–D16 are fixed, and which are not?

### 8.6 Independent verifier pass

After your own pass is green, run a **second, adversarial pass in a fresh context** (a separate sub-agent if your environment supports it; otherwise start a clean review pass that ignores your earlier reasoning). Give the verifier only: the screenshots, this document, and the check output. Its job is to **break** the result, not approve it. Use this prompt:

> You are a hostile QA lead and a picky art director. You did not build this. Using only the screenshots, the spec, and the check output, find: (a) any overlap, clipping, wrap or misalignment; (b) any state or width that looks unfinished; (c) any place the UI still looks templated or "AI-generated"; (d) any claim in the report that is not backed by a file; (e) any weakened check or hidden failure. List every finding with the screenshot filename and a severity (blocker / major / minor). If you find nothing, explain exactly what you checked so the absence of findings is credible. Do not say "looks good" without evidence.

Fix every blocker and major finding, then re-run the full matrix.

### 8.7 Loop and exit criteria

- Run: implement → matrix → gates → visual review → verifier → fix. Repeat for **at most 5 rounds**.
- Exit only when **two consecutive rounds** have: all gates green, zero blocker/major findings from the verifier, and a slop audit with ≤ 1 tell per reviewed screenshot.
- If you cannot reach that in 5 rounds, stop and report exactly what is failing and why. Do not claim success.

### 8.8 Final report (required format)

```
# Verification report
## Summary (3 lines max)
## Defect table: D1–D16 → Fixed / Not fixed → evidence file
## Gate results: G1–G14 → pass/fail per theme × viewport (link to the report)
## Slop audit: per screenshot, remaining tell (if any)
## Verifier findings and how each was resolved
## BEFORE vs AFTER: paths to paired screenshots (offline, 1440 and 390, light and dark)
## Assumptions (things I could not confirm in the backend)
## Unverified (anything I did not run), and why
## How to re-run: npm run verify:ui
```

---

## 9. Definition of done

- [ ] D1–D16 fixed and each backed by a passing check or a viewed screenshot
- [ ] Overview works in all 12 fixtures, both themes, 320 → 1920px
- [ ] No gate weakened; `npm run verify:ui` passes locally and in CI
- [ ] Two consecutive clean verification rounds including the independent verifier
- [ ] The Overview no longer shows any pattern from section 2 beyond one named exception
- [ ] The report in 8.8 is complete and honest about what was not verified
- [ ] The system (tokens, type, ledger, ring, orb, ribbon) is reusable, and the next screen can adopt it without new one-off styles
