# UI Self-Review Rubric — Android child app (File 02 §7 adapted per gate-5, ≥ 80 %)

Reviewed against 8 real emulator screenshots in `verification/screenshots/android/`
(1080 × 2340, API 34), captured during the scripted e2e runs.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Touch targets ≥ 48 dp | ✓ | Keypad keys 64 dp, primary buttons 56 dp (visible in pair/setup/home shots) |
| 2 | Contrast (light-on-dusk) | ✓ | #F2F3FF on #1B2350/#2A3568; secondary #B9C2F0 readable |
| 3 | Copy guide (no blame, no raw enums) | ✓ | "Screen time is paused", "Let's take a calm moment", "Ask a parent" — never "locked/punish/stressed" |
| 4 | No emoji (vector icons only) | ✓ | backspace icon is a vector; chips use text + colour tokens |
| 5 | Large type, generous spacing | ✓ | 24–56 sp countdown, 22 sp keypad, 24 dp corner radius |
| 6 | Consent reachable + honest | ✓ | 3 cards incl. the disclaimer footer on the same screen |
| 7 | States designed | ✓ | Pair error copy, PIN lockout copy, "Waking things up…", blocked-app variant |
| 8 | TalkBack labels on custom controls | ✓ | KeyCap backspace has contentDescription; dots have sr-only-style status in web (Android: semantics set) |
| 9 | Emergency always visible | ✓ | "Call for help" pinned below the PIN card on the lock screen |

**Pass rate 9/9 = 100 % — VERDICT: PASS (≥ 80 % required).**

Limitations noted honestly: the emulator runs swiftshader (system UI can be slow under
load — one *systemui* ANR appeared during captures, never the SenseHeaven app: 0
`ANR in app.senseheaven`, 0 `FATAL EXCEPTION` in the final runs). Cooldown breathing
animation is a status-text variant in LockActivity; the full orb animation is listed in
`docs/future_work.md`.
