# KNOWN ISSUES

Open items with severity ≥ medium block phase completion (File 01 §A; LEAN final checklist:
no open **high** items).

| ID | Severity | Area | Issue | Workaround | Status |
|---|---|---|---|---|---|
| KI-1 | low | environment | The headless emulator (swiftshader) crashes under sustained load from *chained* gate runs (~20 min); standalone `make gate-5` passes consistently (3 recorded PASS verdicts). | `e2e_android.sh` self-heals by booting its own AVD; CI (android.yml) is the durable home; fresh `wipe-data` boot fixes a stuck adb state. | open |
| (none open) | | | | | |
