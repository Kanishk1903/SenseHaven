# P6.2 — Edge-case coverage (lean rows from docs/spec/03-phases-and-gates-lean.md §X)

Lean keeps rows 1, 2, 3, 4, 5, 6, 9, 10, 11, 14, 15, 17, 18, 20 (7, 8, 12, 13, 16, 19 cut).
Each row maps to the automated test or the device-acceptance step that proves it.

| E6 row | Situation | Required behaviour | Proof |
|---|---|---|---|
| 1 | Device offline mid-session | Local countdown + lock continue; outbox drains on reconnect | `docs/DEVICE_ACCEPTANCE_TEST.md` step A16 (airplane mode) + queue unit test `queueBatchAndRemoveAfterAck` |
| 2 | Server cold start (30–60 s) | ≥ 60 s timeouts, retry with backoff, "Connecting…" never an error | web `api.test.ts` (GET retry + NETWORK mapping); API `_wait_for_db(60)` in `test_health.py`; device OkHttp 30/60 s timeouts in `DeviceApi.create` |
| 3 | Wall clock changed by child | No effect (monotonic deltas only) | `RulesEngineTest.tickDeltaIsCapped`, `clockJumpHasNoEffect` |
| 4 | Reboot mid-session | State restored; service restarted; no time counted while off | `RulesEngineTest.persistenceRoundTrip` + `BootReceiver` + engine restore in `SessionManager.restore`; device acceptance step A14 |
| 5 | Camera taken by another app | camera_ok=false, runs freeze, never punish | `RulesEngineTest.noFaceFreezesRuns`, `lowQualitySampleIsTreatedAsNoSignal`; UI "Monitoring paused" state; acceptance step A18 |
| 6 | Camera permission revoked | Paused-by-policy overlay, alert `permission_revoked` | server test `test_permission_revoked_once_per_day`; client treats camera_ok=false as no-signal (never punishes) |
| 9 | Duplicate/replayed batch | No duplicate rows | `test_events_idempotent_replay` (replay → duplicates=3, row counts unchanged) |
| 10 | Device token revoked | 401 DEVICE_REVOKED → wipe, unpaired | `test_revoked_device_receives_DEVICE_REVOKED`; client `Store.wipe()` on DEVICE_REVOKED (5e) |
| 11 | Parent changes limits mid-session | New rules on next sync | `test_sync_shape_and_config_pin_versioning` (config_version bump → config payload) |
| 14 | Emergency | Dialler/emergency always allowed, never counted | `allowed_packages` default incl. dialer/emergency (`settings_schema.json`); UsagePoller ignore list; lock screen "Call for help" (ACTION_DIAL); acceptance step A9 |
| 15 | Wrong PIN ×5 | 15-min local lockout, exponential | `PinLockout` + `fiveMissesLockFor15MinutesThenDouble`; LockActivity lockout copy |
| 17 | Parent deletes child data | Cascade delete; dashboard empty states | API `test_delete_child_soft` + `DELETE /children/{id}/data`; web empty-state components; acceptance step A10 |
| 18 | Two parents, same email | 409 EMAIL_TAKEN constant-time; no enumeration on login | `test_register_duplicate_email_409`, `test_login_unknown_email_same_code_401` (dummy argon2 hash) |
| 20 | Storage failure stays locked-safe | Never unlocks by accident | engine treats restore failure as fresh PENDING (locked) — `SessionManager.restore` runCatching; queue capped (drop-oldest) so disk stays bounded |

## Cut rows (documented for the viva)

7 (accessibility killed), 8 (force-stop detection), 12 (DST bedtime — bedtime cut), 13 (low
battery sampling), 16 (uninstall guard — needs AccessibilityService, cut by LEAN §1.1),
19 (SSE drop — SSE cut; 5 s polling is the replacement).
