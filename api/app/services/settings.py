"""Settings service (P2.4): defaults, deep merge, server-managed config_version."""
from ..schemas.child_settings import ChildSettings


def default_settings() -> dict:
    return ChildSettings().model_dump()


def deep_merge(base: dict, patch: dict) -> dict:
    """Recursively merge patch into a copy of base; lists and scalars replace."""
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def apply_settings_patch(current: dict, patch: dict) -> dict:
    """Validate a partial patch, deep-merge it, bump config_version, re-validate the whole."""
    body = {key: value for key, value in patch.items() if key != "config_version"}
    # Unknown / out-of-range keys must fail before touching the stored settings.
    ChildSettings.model_validate({**current, **body})
    merged = deep_merge(current, body)
    merged["config_version"] = int(current.get("config_version", 1)) + 1
    validated = ChildSettings.model_validate(merged)
    return validated.model_dump()
