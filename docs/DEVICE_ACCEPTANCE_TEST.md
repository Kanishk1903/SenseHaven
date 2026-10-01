# Device Acceptance Test — SenseHeaven (H5)

Run on the real child phone next to the parent dashboard (phone browser is fine).
Each step: perform the **action**, verify the **expected** result, tick PASS/FAIL.
Record the run date + device model at the bottom. A FAIL is either fixed or logged in
`KNOWN_ISSUES.md` with severity — no open HIGH at close.

**Prep:** production (or LAN debug) backend reachable; parent account registered; APK
installed (Download page); phone charged ≥ 30 %.

## Steps

| ID | Action | Expected |
|---|---|---|
| A1 | Open the app | Consent screen: 3 cards + disclaimer, no crash |
| A2 | Tap "I understand" | Pairing keypad appears (6 dots + custom keypad) |
| A3 | Enter a fresh dashboard code (type all 6) | App advances to the setup wizard |
| A4 | Grant Camera, Notifications, Usage access, Display-over-others via the wizard | All 4 cards show "Granted"; button enabled |
| A5 | Tap "Open SenseHeaven" | Home screen; within ~15 s shows "Your parent set up time — tap to begin" or live countdown |
| A6 | Parent dashboard: start a 30-min session; wait ≤ 15 s | Home flips to "Screen time active" with a counting countdown |
| A7 | Camera indicator | Android shows the camera-in-use indicator while monitoring runs; the persistent SenseHeaven notification is visible |
| A8 | Demo: inject calm (parent menu / debug) and stay | After a sustained calm stretch (or fast-forward in demo), bonus chip appears; dashboard ledger shows `bonus` |
| A9 | From the lock screen tap "Call for help" | Dialler opens with no PIN; dialling is never blocked or counted |
| A10 | Dashboard: Delete history for the child | Dashboard empties; app keeps running; next sync does not error |
| A11 | Open another app during an active session | Time keeps counting; dashboard "Top apps" shows it within a minute |
| A12 | Dashboard: block that app; wait for next sync | Opening it shows the lock variant "This app isn't available right now." |
| A13 | Let the countdown reach 0 (or fast-forward) | Lock screen covers the screen; "Screen time is paused" |
| A14 | Reboot the phone mid-session, unlock | App returns; remaining time preserved (no time counted while off); GuardService restarts |
| A15 | Enter the wrong PIN 5× | PIN pad locks with a wait message; clears after the window |
| A16 | Airplane mode mid-session; use the phone | Countdown + lock keep working offline; after reconnect the dashboard catches up (outbox drains) |
| A17 | Dashboard: Revoke device | App shows "unpaired" within two sync cycles; local state wiped |
| A18 | Deny Camera permission (system settings) | App shows "Monitoring paused" with a fix button; no penalty accrues |
| A19 | Battery-optimisation prompt/notes | Follow the keep-alive tips; app survives overnight (demo-week check) |
| A20 | Consent re-read: "How SenseHeaven works" from Home | Consent cards reachable any time |

## Run record

| Field | Value |
|---|---|
| Date | _(fill during H5)_ |
| Device model | _(fill)_ |
| Android version | _(fill)_ |
| Backend | _(fill: LAN debug / production URL)_ |
| Result | _(all PASS / list of FAILs)_ |
