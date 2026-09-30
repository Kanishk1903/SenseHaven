#!/usr/bin/env python3
"""Contract checks for gate-1 (P1.1 error codes, P1.2 settings schema). Stdlib only.

Modes:
  error-codes   parse contracts/error_codes.md; every spec-required code present with the
                right HTTP status and non-empty user-facing copy; no duplicate codes.
  settings      structural validation of contracts/settings_schema.json (draft 2020-12);
                the property defaults validate against the schema; the cross-field rule
                stress_threshold < calm_threshold - 10 is exercised with 3 bad + 3 good
                samples; a few range/pattern negatives are checked as well.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"

REQUIRED_CODES = {
    "UNAUTHENTICATED": 401,
    "INVALID_CREDENTIALS": 401,
    "EMAIL_TAKEN": 409,
    "VALIDATION_ERROR": 422,
    "NOT_FOUND": 404,
    "RATE_LIMITED": 429,
    "CSRF_HEADER_MISSING": 403,
    "PIN_REQUIRED": 409,
    "PIN_INVALID": 422,
    "PAIRING_CODE_INVALID": 422,
    "PAIRING_CODE_EXPIRED": 410,
    "DEVICE_TOKEN_INVALID": 401,
    "DEVICE_REVOKED": 401,
    "SESSION_NOT_ACTIVE": 409,
    "BATCH_TOO_LARGE": 413,
    "COMMAND_EXPIRED": 410,
    "INTERNAL_ERROR": 500,
}

ROW = re.compile(r"^\|\s*`?([A-Z_]+)`?\s*\|\s*(\d{3})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$")


def check_error_codes() -> int:
    text = (CONTRACTS / "error_codes.md").read_text()
    found: dict = {}
    duplicates: list = []
    for line in text.splitlines():
        match = ROW.match(line.strip())
        if not match:
            continue
        code, http, meaning, copy = match.groups()
        if code in found:
            duplicates.append(code)
        found[code] = (int(http), meaning, copy)

    errors = []
    for code in duplicates:
        errors.append(f"duplicate code: {code}")
    for code, http in sorted(REQUIRED_CODES.items()):
        if code not in found:
            errors.append(f"missing code: {code}")
        elif found[code][0] != http:
            errors.append(f"{code}: expected HTTP {http}, found {found[code][0]}")
        elif not found[code][2].strip():
            errors.append(f"{code}: empty user-facing copy")

    if errors:
        print("error_codes.md:")
        for error in errors:
            print(f"  ERROR {error}")
        print("check_contracts error-codes: FAIL")
        return 1
    print(
        f"error_codes.md: {len(found)} codes; all {len(REQUIRED_CODES)} required codes present "
        "with correct HTTP status and copy; no duplicates"
    )
    return 0


# ---- minimal JSON Schema validator (the subset settings_schema.json uses) ----


def validate(obj, schema, path="$", errors=None):
    if errors is None:
        errors = []
    kind = schema.get("type")
    if kind == "object":
        if not isinstance(obj, dict):
            errors.append(f"{path}: expected object")
            return errors
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in obj:
                errors.append(f"{path}.{key}: required")
        if schema.get("additionalProperties") is False:
            for key in obj:
                if key not in props:
                    errors.append(f"{path}.{key}: not allowed by additionalProperties:false")
        for key, value in obj.items():
            if key in props:
                validate(value, props[key], f"{path}.{key}", errors)
    elif kind == "array":
        if not isinstance(obj, list):
            errors.append(f"{path}: expected array")
            return errors
        items = schema.get("items")
        if items:
            for index, item in enumerate(obj):
                validate(item, items, f"{path}[{index}]", errors)
    elif kind == "string":
        if not isinstance(obj, str):
            errors.append(f"{path}: expected string")
            return errors
        if "pattern" in schema and not re.search(schema["pattern"], obj):
            errors.append(f"{path}: {obj!r} does not match pattern {schema['pattern']!r}")
    elif kind == "integer":
        if isinstance(obj, bool) or not isinstance(obj, int):
            errors.append(f"{path}: expected integer")
            return errors
        if "minimum" in schema and obj < schema["minimum"]:
            errors.append(f"{path}: {obj} below minimum {schema['minimum']}")
        if "maximum" in schema and obj > schema["maximum"]:
            errors.append(f"{path}: {obj} above maximum {schema['maximum']}")
    elif kind == "boolean":
        if not isinstance(obj, bool):
            errors.append(f"{path}: expected boolean")
    else:
        errors.append(f"{path}: unsupported schema type {kind!r}")
    return errors


def cross_field_violated(sample: dict) -> bool:
    """The rule declared in settings_schema.json x-cross-field."""
    return sample["stress_threshold"] >= sample["calm_threshold"] - 10


def check_settings() -> int:
    schema = json.loads((CONTRACTS / "settings_schema.json").read_text())
    errors: list = []

    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("schema must declare the draft 2020-12 $schema")
    if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        errors.append("top level must be type object with additionalProperties false")
    rule = schema.get("x-cross-field", {})
    if rule.get("expr") != "stress_threshold < calm_threshold - 10":
        errors.append(
            'schema must declare x-cross-field {"expr": "stress_threshold < calm_threshold - 10"}'
        )

    props = schema.get("properties", {})
    if len(props) < 15:
        errors.append(f"expected >= 15 properties, found {len(props)}")

    # defaults must validate against the schema
    defaults = {key: spec["default"] for key, spec in props.items() if "default" in spec}
    errors += validate(defaults, schema, path="defaults")

    # cross-field rule: 3 bad samples (must be rejected), 3 good (must pass fully)
    bad_samples = [(35, 40), (50, 55), (60, 69)]
    good_samples = [(35, 70), (5, 50), (60, 95)]
    for stress, calm in bad_samples:
        sample = dict(defaults)
        sample["stress_threshold"] = stress
        sample["calm_threshold"] = calm
        if not cross_field_violated(sample):
            errors.append(
                f"cross-field: stress={stress} calm={calm} violates the rule but was accepted"
            )
    for stress, calm in good_samples:
        sample = dict(defaults)
        sample["stress_threshold"] = stress
        sample["calm_threshold"] = calm
        if cross_field_violated(sample):
            errors.append(
                f"cross-field: stress={stress} calm={calm} satisfies the rule but was rejected"
            )
        else:
            errors += validate(sample, schema, path=f"good({stress},{calm})")

    # range + pattern negatives
    for key, value in (("good_bonus_min", 0), ("cooldown_min", 16), ("calm_threshold", 96)):
        sample = dict(defaults)
        sample[key] = value
        if not validate(sample, schema, path=f"range({key}={value})"):
            errors.append(f"range: {key}={value} is out of bounds but was accepted")
    sample = dict(defaults)
    sample["blocked_packages"] = ["9lives"]
    if not validate(sample, schema, path="pattern(bad)"):
        errors.append("pattern: blocked_packages ['9lives'] should be rejected")
    sample = dict(defaults)
    sample["allowed_packages"] = ["com.android.dialer", "com.android.emergency"]
    if validate(sample, schema, path="pattern(good)"):
        errors.append("pattern: emergency dialer packages should be accepted")

    if errors:
        print("settings_schema.json:")
        for error in errors:
            print(f"  ERROR {error}")
        print("check_contracts settings: FAIL")
        return 1
    print(
        "settings_schema.json: valid draft-2020-12 structure; defaults validate; "
        "cross-field rule holds on 3 bad + 3 good samples; range/pattern negatives behave"
    )
    return 0


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "error-codes":
        return check_error_codes()
    if mode == "settings":
        return check_settings()
    print("usage: check_contracts.py error-codes|settings", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
