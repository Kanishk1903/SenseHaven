# DECISIONS

Deviations from `docs/spec/` are recorded here (File 01 §B). LEAN EDITION precedence applies:
LEAN overrides Files 01–02; File 03 adds binding detail.

| ID | Decision | Reason |
|---|---|---|
| D-13 | The later-phase scripts named in the P0.1 tree (`scripts/gen_tokens.py`, `check_contrast.py`, `seed_demo.py`, `virtual_child.py`, `smoke_prod.py`) are created in Phase 0 as honest stubs that print their owning slice and exit 1; each is fully implemented by its owning slice (P1.3, P1.3, P2.8, P2.8, P7.4). | Gate-0's layout check requires every P0.1 path to exist, while G4/G5 forbid empty fakes; a stub that loudly fails is honest, and no gate invokes these before their phase. |
| D-14 | Repo root is this workspace directory (it already contained `docs/spec/`); the `senseheaven/` name in the P0.1 tree refers to the repository itself, not a subdirectory. | The build starts "from an empty directory" — this one. |
