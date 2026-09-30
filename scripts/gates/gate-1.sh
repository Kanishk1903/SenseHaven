# GATE 1 — contracts and design tokens (docs/spec/03-phases-and-gates-lean.md §GATE 1).
check "error codes" "python3 scripts/check_contracts.py error-codes"
check "settings schema" "python3 scripts/check_contracts.py settings"
check "tokens generated" "python3 scripts/gen_tokens.py && python3 scripts/gen_tokens.py && git diff --exit-code -- design/generated && echo 'tokens deterministic: double re-run byte-identical'"
check "contrast" "python3 scripts/check_contrast.py"
check "placeholders" "bash scripts/no_placeholders.sh"
check "regression: previous gate" "bash scripts/gate.sh 0"
