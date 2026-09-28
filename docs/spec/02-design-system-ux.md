# SENSEHEAVEN v2 — AUTONOMOUS BUILD PROMPT
## FILE 2 of 3 — DESIGN SYSTEM & UX (web dashboard + Android child app)

**Goal:** the product must look and feel like a funded startup's calm, trustworthy family-wellbeing product — *not* a template. Every decision below is binding. When a screen is not specified, derive it from these principles and record the choice in `docs/design_decisions.md`.

---

## 1. BRAND & PRINCIPLES

**Brand idea:** *Calm technology for families.* Sky, dusk, soft light. Motif = the **mood orb** — a soft radial-gradient sphere that changes hue with state. It appears in the logo, empty states, the child app's home, the breathing exercise.
**Voice:** warm, plain, never shaming, never clinical. Sentence case. Verbs on buttons ("Add time", not "Submit"). Errors say what happened **and** what to do next.
**Five principles:** (1) *Calm over clever* — quiet surfaces, one accent. (2) *Glanceable* — the answer to "is my child OK right now?" is visible in < 2 seconds. (3) *Honest data* — gaps stay gaps, uncertainty is labelled. (4) *Never colour alone* — every state has an icon + text too. (5) *Accessible by default* — WCAG 2.2 AA.
**Anti-patterns (auto-fail in review):** default shadcn look with no customisation · purple-to-pink gradients · emoji used as icons · centred everything · unstyled tables · spinners instead of skeletons · raw JSON/enum strings in the UI (`stress_sustained`) · "Something went wrong" with no action · inconsistent radii/spacing · text under 12px · full-width buttons on desktop forms · modal-on-modal.

---

## 2. DESIGN TOKENS (write to `design/tokens.json`; generate CSS vars, Tailwind theme, and Android `Tokens.kt` with `scripts/gen_tokens.py`; never hand-copy values)

### 2.1 Colour — light
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F7F4` | App background (warm paper) |
| `surface` | `#FFFFFF` | Cards |
| `surface-2` | `#F1F1EC` | Subtle fills, table headers |
| `border` | `#E4E4DD` | Hairlines |
| `text` | `#171714` | Primary text |
| `text-muted` | `#5B5B54` | Secondary text |
| `text-subtle` | `#74746C` | Captions (≥ 4.5:1 on `bg`) |
| `primary` | `#3549D8` | Actions, links, focus |
| `primary-hover` | `#2B3BB3` | |
| `primary-soft` | `#EAEEFF` | Selected rows, chips |
| `on-primary` | `#FFFFFF` | |
| `calm` / `calm-fg` / `calm-soft` | `#2F8F6B` / `#1D6449` / `#E2F4EC` | fill / text-on-light / background |
| `neutral` / `neutral-fg` / `neutral-soft` | `#C58A1B` / `#8A5A0B` / `#FBF1D9` | |
| `stress` / `stress-fg` / `stress-soft` | `#D4532F` / `#A93A1B` / `#FCE6DE` | |
| `focus-ring` | `#3549D8` @ 2px + 2px offset | |

### 2.2 Colour — dark (`[data-theme=dark]`)
`bg #0F1115` · `surface #171A20` · `surface-2 #1E222A` · `border #2A2F3A` · `text #F2F3F5` · `text-muted #A6ACB8` · `text-subtle #8B92A0` · `primary #8497FF` · `primary-soft #232A4D` · `on-primary #0F1115` · `calm #4CC29A` (fg `#7FDDBB`, soft `#12261F`) · `neutral #E0A94A` (fg `#EBC26F`, soft `#2A2212`) · `stress #F0805F` (fg `#F5A28A`, soft `#2E1912`). In dark mode prefer borders over shadows.

### 2.3 Type
| Role | Font | Size/line | Weight |
|---|---|---|---|
| Display (hero numbers, page hero) | **Fraunces Variable** | 40/44 | 600 |
| H1 | Inter Variable | 28/34 | 650 |
| H2 | Inter | 22/28 | 600 |
| H3 | Inter | 18/24 | 600 |
| Body | Inter | 16/24 | 400 |
| Secondary | Inter | 14/20 | 400 |
| Caption | Inter | 12/16 | 500 |
Numbers in tables/KPIs use `font-variant-numeric: tabular-nums`. Fonts are bundled via `@fontsource-variable/*` (no CDN). Body never below 14px on web.

### 2.4 Space, shape, motion
4-pt grid (4/8/12/16/24/32/48/64). Radii: input 8 · card 12 · dialog 16 · pill 999. Shadows (light only): `sm 0 1px 2px rgba(23,23,20,.06)`, `md 0 4px 16px rgba(23,23,20,.08)`. Motion: 150 ms (hover/press), 220 ms (expand/tab), 320 ms (dialog/sheet), easing `cubic-bezier(.2,.8,.2,1)`. Respect `prefers-reduced-motion` (replace movement with opacity or nothing). No looping animation except the mood orb (very slow "breathing", disabled under reduced motion) and skeleton shimmer (disabled under reduced motion).

### 2.5 Contrast test (`scripts/check_contrast.py`, part of Phase 1 gate)
For every documented text/background pair compute WCAG ratio: body text ≥ 4.5, large text (≥ 24px or ≥ 18.66px bold) ≥ 3, UI component boundaries/icons ≥ 3. Any failure → adjust the token and log in `GATES_CHANGELOG.md`.

### 2.6 Android-only "Dusk / Daylight" child themes
Dusk (locked/night): gradient `#1B2350 → #3D4FA8`, text `#F2F3FF`, orb `#9AA8FF`. Daylight (active): gradient `#FFF6E5 → #EAF1FF`, text `#1B2350`, orb `#7FCFB0`. Cooldown: Dusk with slower motion. Theme auto-selects by time (Dusk 19:00–07:00 or during bedtime) and respects system dark mode override in the parent menu.

---

## 3. WEB APP — INFORMATION ARCHITECTURE & SCREENS

**Shell:** left sidebar 248 px (collapses to icons ≤ 1100 px; becomes **bottom tab bar ≤ 768 px** with 5 items: Overview, Analytics, Alerts, Settings, Account). Top bar: child switcher (avatar chip + dropdown, "Add child"), alert bell with unread count, theme toggle, account menu. Content max-width 1200 px. Page header pattern: H1, one-line description, primary action on the right.
**Routes:** `/login` `/register` `/onboarding` `/` `/children/:id/analytics/(emotion|screen-time|searches|sessions)` `/sessions/:id` `/children/:id/settings` `/alerts` `/account` `/download` `*` (404 with orb illustration).
**Global behaviours:** route-level code splitting · error boundary per route with retry · offline banner · toast system (success 4 s, error persistent until dismissed) · `Cmd/Ctrl+K` command palette (nice-to-have, not gated) · focus management on route change · skip-to-content link · every destructive action uses a confirm dialog (delete child/data/account: type the name to confirm).

### 3.1 Auth screens
Split layout: left = form (max 400 px), right = brand panel with orb illustration + 3 concise value props (hidden < 900 px). Fields with inline validation on blur (zod), password strength meter, show/hide toggle, "Enter" submits, autofocus first field, autocomplete attributes correct. Errors from API map by `code` to friendly copy (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `RATE_LIMITED` with countdown from `Retry-After`).

### 3.2 Onboarding wizard (`/onboarding`, 4 steps, progress indicator, resumable)
1. **Add your child** (name, birth year optional, avatar from 8 orb variants). 2. **Set your device PIN** (6 digits; explain "used on your child's phone"; confirm entry; requires password re-entry). 3. **Install & pair** (QR-free: big 6-digit code with 10-min countdown + "Generate new code"; APK download button; 5 install steps with the "restricted settings" tip; expandable "Xiaomi/Oppo/Samsung keep-alive tips"). 4. **Waiting for device** — live polling; when the device appears show success state with device name, Android version, permission checklist (green/amber chips). Finishing → Overview.

### 3.3 Overview (`/`) — the "is my child OK right now?" screen
Top row (glanceable): **Live status card** (spans 2 cols): state chip (`Screen time active` / `Cooldown` / `Locked` / `Offline`), remaining-time ring (Fraunces numerals), current **Calm Index** gauge with label and 30-min sparkline, device freshness ("Updated 4 s ago" → amber after 90 s), quick actions: **Add time** (popover with 5/10/15/30 + custom), **Lock now**, **End session**, **Start session** (duration chips 30m/1h/2h/custom; disabled with reason when device offline/bedtime). Right: **Today** KPI stack (screen time vs limit bar, avg calm with trend %, stress episodes, bonus minutes earned).
Second row: **Calm timeline (today)** area chart with threshold bands + session shading; **Alerts feed** (latest 5, unread dot, "View all").
Third row: **Top apps today** (bar list with app initials avatars, blocked badge) and **Recent searches** (flagged first; reveal-on-click for query text with a visible "hidden by default" toggle in settings).
States: skeletons matching final layout; empty ("No device connected yet" → pairing CTA); stale ("Device hasn't checked in for 12 min" amber banner with troubleshooting link); error per card with retry.

### 3.4 Analytics (tabs)
**Emotion:** date picker (prev/next day) + range presets; timeline area chart (y 0–100, bands: ≥70 calm, 35–69 neutral, <35 stressed, labelled on the axis with icons), session boundaries as subtle vertical lines, tooltip (time · Calm Index · label · session); **heatmap** (7×24 grid, tokens-based diverging scale, accessible: each cell has `aria-label`, table view toggle); **distribution** (stacked bar % of time per label — not a pie); **stress episodes table** (time, duration, outcome, link to session). Include a persistent, non-scary disclaimer line.
**Screen time:** stacked daily bars (7d/30d) by app category (Social, Video, Games, Learning, Other — mapped from a small local package→category table; unknown = Other), per-app table (sortable: time, opens, last used, blocked), hourly usage strip.
**Searches:** table with search box, flagged filter, source app icon, timestamp, keyword highlight; query text hidden behind "Reveal" per row (decrypt-on-demand, audited); CSV export button.
**Sessions:** table (date, duration granted/used, bonus, penalty, avg calm, end reason) → **Session detail** page: header KPIs, timeline with ledger markers (bonus ↑, penalty ↓, cooldown band), ledger list, apps used in session.
Every chart: `ResponsiveContainer` inside a fixed-height parent, thin gridlines in `border`, tabular numerals, loading skeleton with same height (no layout shift), empty state text explaining *why* it's empty.

### 3.5 Child settings (`/children/:id/settings`) — sectioned form with sticky "Save changes" bar showing unsaved-state
**Screen time** (daily limit, bedtime window with timezone note) · **Rewards & cooldown** (bonus minutes, penalty minutes, cooldown minutes, max bonus per session, each with a live "What this means" preview sentence) · **Sensitivity** (calm/stress thresholds as dual-handle slider with band preview, sustained durations in minutes, explanation tooltips, "Reset to recommended") · **Monitoring** (toggles: emotion monitoring, activity log, search capture, show mood to child — each with plain-English consequence text) · **Blocked apps** (searchable list of apps the device has reported + chip input) · **Blocked keywords** (chip input, case-insensitive) · **Device** (name, Android version, last seen, permission health list, "Revoke device") · **Privacy** (retention days 7–90, Export data, Delete history, Delete child).

### 3.6 Alerts (`/alerts`)
Inbox list grouped by day; kind-specific icon + colour + humanised title ("Aarav had a stressful stretch — a 5-minute breather was started"); filters (All/Unread/Critical); bulk mark-read; deep link into the session/time range; browser Notification API opt-in (works while the tab is open) with clear explanation.

### 3.7 Account & Download
Account: profile, timezone, change password, change **device PIN**, active web sessions (revoke), delete account. Download: current APK version, size, SHA-256, install steps with the Android 13+ restricted-settings walkthrough, Play Protect "Install anyway" note, troubleshooting accordion.

### 3.8 Required UI states for EVERY data view
`loading` (skeleton) · `empty` (illustration + reason + CTA) · `error` (message + Retry, request id in a copyable detail) · `stale` (banner) · `partial` (some cards failed) · `success`. Tests must exercise loading, empty and error via MSW/route interception.

### 3.9 Component inventory (build once, reuse everywhere; each with a Vitest test)
`OrbMark`, `Logo`, `StatusChip`, `Kpi`, `Ring`, `Gauge`, `Sparkline`, `AreaTimeline`, `Heatmap`, `StackedBar`, `EmptyState`, `ErrorState`, `Skeleton*`, `PageHeader`, `ChildSwitcher`, `ConfirmDialog` (type-to-confirm), `DurationPicker`, `PinInput`, `ChipInput`, `DataTable` (sort, sticky header, keyboard navigable, responsive card mode < 640 px), `Toast`, `Banner`, `Tooltip`, `SectionCard`, `StickySaveBar`, `RangeTabs`, `RevealText`.

---

## 4. ANDROID CHILD APP — UX SPEC

**Feel:** friendly, not childish. Large type, generous spacing, soft gradients, gentle haptics. Font **Nunito** (bundle TTFs in `res/font`; download from the `google/fonts` GitHub repo; if download fails use system sans with matching weights — do not block). Minimum touch target 56 dp, corner radius 24 dp, keys 72 dp. Respect system font scale up to 200 % and `ANIMATOR_DURATION_SCALE = 0`. Every interactive element has a `contentDescription`/semantics label for TalkBack.

**Screens**
1. **Welcome & consent** — 3 short cards: *what SenseHeaven does*, *what it can see* (face expression estimated on this phone; no photos are saved or sent; apps used; searches if enabled), *who sees it* (your parent). Primary button "I understand". Reachable later from Home → "How SenseHeaven works".
2. **Pair** — 6-digit keypad screen (custom keypad, no system keyboard), shake + haptic on error, success = orb expands and fades into the calibration step. Handles cold start with "Waking things up…" copy (never an error before 90 s).
3. **Setup wizard** — vertical checklist of required grants with progress ring: *Camera*, *Notifications*, *Accessibility service* (with the Android 13+ "Allow restricted settings" mini-guide and deep links), *Device admin*, *Battery optimisation exemption*, *Display over other apps is NOT required (accessibility overlay is used)*. Each card: illustration, one sentence why, status chip (Granted / Needed), button that opens the right Settings screen; the app re-checks on `ON_RESUME` and animates to ✓. "Continue" stays disabled until all *required* grants are green. Optional: OEM keep-alive tips.
4. **Calibration (60 s)** — "Sit comfortably and look at the screen. We're just learning what calm looks like for you." Breathing-orb animation, progress arc, face-found indicator; if no face for 15 s show guidance (lighting, distance). Stores `baseline_p`.
5. **Home (child)** — state variants:
   - *Locked / no session:* Dusk gradient, sleeping orb, "Screen time is paused", secondary "Ask a parent" → PIN sheet, small "Call for help" (dialer).
   - *Active:* Daylight gradient, **big ring** with remaining time (Nunito ExtraBold 56 sp, `H:MM`), mood orb (colour follows label; hidden or generic if `show_mood_to_child=false`), gentle chips for bonus/penalty ("+10 min for staying calm 🙂" — **no emoji: use vector icons**), low-time notices at 5 min and 1 min.
   - *Cooldown:* full-screen **breathing exercise** (inhale 4 s · hold 4 s · exhale 6 s, orb scales 1.0→1.35, text cues, remaining pause time), apps blocked, copy: "Let's take a calm moment. Your time is safe while we pause."
   - *Waiting to start ("tap-to-start")*: shown when a remote start arrived: "Your parent set up 1 h 30 m. Tap to begin" → opens the Activity, starts the camera service, returns to the home screen.
   - *Monitoring paused (camera busy/permission)*: friendly explanation + fix button.
6. **Lock overlay (over any app)** — same visual as *Locked*; PIN sheet slides up; **emergency call** button always visible; blocked-app variant: "This app isn't available right now."
7. **Parent menu (PIN-protected)** — Start session (duration chips 15m/30m/1h/2h + stepper), Add/remove time, End session, Permission health, Change theme, **Demo tools** (inject Calm Index, fast-forward, force cooldown, simulate search — hidden behind PIN + long-press on the version label), Unpair.
**Persistent notification:** low-importance channel, text "SenseHeaven is keeping screen time healthy", action "Open".
**PIN sheet:** 6 dots, custom keypad, backspace, haptic per key, shake + error haptic on wrong PIN, lockout countdown after 5 fails; PIN verified locally with PBKDF2 (constant-time compare); never logged.

---

## 5. COPY GUIDE (write a `docs/copy.md` and use it)
Child-facing never uses "angry", "stressed", "bad", "punish". Parent-facing uses "elevated stress signals", "calm stretch", "breather". Error template: *what happened* + *what you can do* ("We couldn't reach SenseHeaven. Your child's limits still work. Try again"). Empty template: *why it's empty* + *how to fill it*. Numbers: `1 h 25 m`, never `85 minutes` in headings; `Calm Index 72`.

## 6. ACCESSIBILITY CHECKLIST (each item automated where possible)
Landmarks + heading order · form labels + error association (`aria-describedby`) · focus visible on all controls · full keyboard operation of dialogs, menus, tables, charts (table alternative) · colour-independent status (icon+text) · `lang` set · reduced motion · touch targets ≥ 44 px web / 48 dp Android · Android: TalkBack traversal order verified in UI tests, `Modifier.semantics` on custom controls, font-scale 200 % screenshot test.

## 7. UI SELF-REVIEW RUBRIC (agent scores its own screenshots; total ≥ 90 % required; each item 0/1; fix and re-shoot until it passes)
1 Spacing follows the 4-pt scale, no cramped/loose outliers · 2 One clear primary action per view · 3 Type hierarchy is obvious at a glance · 4 Numerals are tabular and aligned · 5 Colours only from tokens, states never colour-only · 6 Dark mode is designed (not inverted) and passes contrast · 7 Empty/loading/error states are designed · 8 No layout shift between skeleton and content · 9 Charts are readable at 390 px width · 10 Tables degrade to cards on mobile · 11 Touch targets ≥ 44/48 · 12 Copy follows the guide (no raw enums, no blame) · 13 Icons consistent (single set, one stroke weight) · 14 Motion is subtle and reduced-motion safe · 15 Looks intentional, not template — a stranger would guess it's a real product.

## 8. ASSETS THE AGENT MUST CREATE (no stock imagery required)
Logo (wordmark + orb) as SVG · 8 avatar orbs · empty-state and 404 illustrations (inline SVG: sky, clouds, orb) · favicon set + manifest · Android adaptive icon (orb on dusk gradient, vector) · OG image for the download page. Store sources in `design/assets/`; keep each SVG < 8 KB.