# Demo Script — 8 minutes (viva)

**Pre-demo checklist (T-15 min):**
- [ ] `scripts/warm.sh https://<render-url>` (or LAN debug URL) — both green
- [ ] Phone charged ≥ 30 %, SenseHeaven installed + paired, permissions green in the wizard
- [ ] Dashboard logged in on the laptop (or phone browser), Overview visible
- [ ] `virtual_child.py` ready as Plan B; debug broadcast cheatsheet on a sticky note
- [ ] Screen-mirroring for the phone verified (scrcpy / caster)

## Timed run

| Min | Beat | What happens | Fallback if live fails |
|---|---|---|---|
| 0:00–1:00 | Problem | "Screen-time apps punish; we made one that adapts to how the child actually feels." Show the consent cards on the phone (privacy story first). | Screenshots in `verification/screenshots/` |
| 1:00–2:00 | Parent pairs | Dashboard: add child → PIN → big 6-digit code; type it on the phone keypad; wizard shows all grants green | `virtual_child.py --code <code>` pairs from the laptop |
| 2:00–3:00 | Remote start | Dashboard "Start session 30 m" → phone shows "Your parent set up time — tap to begin" → tap → countdown ticking | Already-running session from prep |
| 3:00–4:30 | Live dashboard | Overview: state chip active, ring counting down, Calm Index gauge, "Updated Ns ago", top apps filling in | Emulator + debug inject (below) |
| 4:30–6:00 | The adaptive bit | Phone camera on the presenter (frown) → Calm Index dips → dashboard "elevated stress signals" alert → phone enters the breathing cooldown ("your time is safe while we pause"); time frozen | Debug: `adb shell am broadcast -a app.senseheaven.debug.INJECT -p app.senseheaven.child --ei ci 20` then `...FASTFORWARD --ei minutes 6` |
| 6:00–7:00 | Reward + unlock | After the break (or inject ci=90 + fast-forward) → bonus chip "+10 min"; dashboard timeline shows penalty dip + bonus; end session → lock screen → PIN unlocks | Same debug path |
| 7:00–8:00 | Privacy + close | Consent screen re-read; dashboard footer disclaimer; one-line architecture: "frames never leave the phone — only a score"; cuts table (`synopsis_delta.md`) | — |

## Plan B (full virtual demo, no phone needed)

```bash
# terminal 1: backend already up
api/.venv/bin/python scripts/system_test.py          # proves the loop headlessly
# terminal 2: virtual child with visible ticks
api/.venv/bin/python scripts/virtual_child.py --base-url <url> --code <code> --scenario stress --fast
```
Narrate from the dashboard while `virtual_child` prints its ticks; every rule fires on
screen in under a minute.
