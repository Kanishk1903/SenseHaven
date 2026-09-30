# Contracts

Machine-consumed specifications. When code and a contract disagree, the contract wins — fix
the code or amend the contract in a commit that says why (File 01 G11).

| File | Consumed by | Introduced |
|---|---|---|
| `error_codes.md` | API problem+json responses (Phase 2); web error-copy map (Phase 4) | Phase 1 |
| `settings_schema.json` | API children.settings validation — Pydantic model kept in sync with it (Phase 2); device config sync | Phase 1 |
| `openapi.json` | web API types (`make web-types`); drift check in gate-2 | Phase 2 (`make contract-export`) |
| `feature_spec.json` | ML feature names/order + quality definition (Phase 3); Android EmotionModel input ordering (Phase 5) | Phase 3 |
| `classifier_vectors.json` | Android model-parity unit tests: `p` within 1e-4, `ci` exact (Phase 5) | Phase 3 |

Note: `rules_vectors.json` / the Python rules reference from File 01 §E4 were **cut** by the
LEAN EDITION §1.2 — replaced by ≥ 15 hand-written Kotlin rules-engine unit tests.
