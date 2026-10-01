# Synopsis Delta — promise vs build

| Synopsis promise | What was built | Reason |
|---|---|---|
| CNN 48×48 emotion classifier | MediaPipe Face Landmarker blendshapes → calibrated logistic model (JSON weights + tiny Kotlin forward pass) | Small, explainable, on-device, no train/serve skew (same `.task` file); evaluated on a held-out test set |
| 7 emotion classes | Binary distress proxy → Calm Index 0–100 with per-child baseline | FER2013 has no real stress labels; a 7-class remap would be fabricated. Honest framing: facial-expression proxy, not diagnosis |
| Room/local DB for logs | JSON-file event queue (cap 2000, drop-oldest-emotion) | Avoids Room/KSP toolchain risk; disk use bounded; upload semantics unchanged |
| Android-only dashboard | Web dashboard (React) + native child app | Parents manage from any browser; hot-reload deploys with `git push` |
| Push alerts (FCM) | In-dashboard alerts + unread tab badge, 5–15 s polling | Removes Firebase service accounts, token registration and security rules at zero infrastructure cost |
| Timer decay α(M) | Sustained-run rules: penalty → breathing cooldown; calm → bonus | Defensible adaptive control with visible cause-and-effect for the viva |
| LSTM on sequences | EMA + hysteresis + sustained windows | FER2013 is static images; a sequence model trained on it would be fabricated (D-8) |
| Search capture / keyword flags | Cut (LEAN §1.1) | Needs AccessibilityService (high-privilege); monitoring a minor's searches conflicts with data-minimisation (DPDP Act 2023) |
| Uninstall guard / device-admin | Cut — documented limitation | Android does not allow ordinary apps to be uninstall-proof; production answer is Device-Owner provisioning (future work) |
| Bedtime schedules / daily limit | Cut — session-based control | Timezone/DST bug surface; explicit sessions were enough for the demo |
| On-device inference | **Kept** | Core privacy promise: frames never leave the phone |
| PIN with salted PBKDF2 | **Kept** (+ pin_version) | Cyber-security marks: argon2id passwords, peppered pairing codes, tenant isolation, IDOR matrix all retained |
