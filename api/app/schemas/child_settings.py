"""Child settings Pydantic model — the API-side twin of contracts/settings_schema.json (P2.4).

A parity test (tests/test_children.py) asserts this model stays in sync with the JSON Schema
contract: names, types, defaults, bounds and the blocked-package pattern.
"""
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PACKAGE_PATTERN = re.compile(r"^[a-zA-Z][\w.]*$")


class ChildSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    good_bonus_min: int = Field(10, ge=1, le=60)
    stress_penalty_min: int = Field(5, ge=1, le=30)
    cooldown_min: int = Field(5, ge=1, le=15)
    max_bonus_per_session_min: int = Field(30, ge=0, le=120)
    calm_threshold: int = Field(70, ge=50, le=95)
    stress_threshold: int = Field(35, ge=5, le=60)
    sustained_stress_s: int = Field(300, ge=60, le=900)
    sustained_calm_s: int = Field(900, ge=300, le=3600)
    penalty_lockout_s: int = Field(900, ge=300, le=3600)
    monitoring_enabled: bool = True
    activity_log_enabled: bool = True
    show_mood_to_child: bool = False
    blocked_packages: list[str] = Field(default_factory=list)
    allowed_packages: list[str] = Field(
        default_factory=lambda: ["com.android.dialer", "com.google.android.dialer", "com.android.emergency"]
    )
    config_version: int = Field(1, ge=0)

    @field_validator("blocked_packages", "allowed_packages")
    @classmethod
    def valid_packages(cls, value: list[str]) -> list[str]:
        for package in value:
            if not PACKAGE_PATTERN.match(package):
                raise ValueError(f"invalid package name: {package!r}")
        return value

    @model_validator(mode="after")
    def stress_below_calm(self) -> "ChildSettings":
        if self.stress_threshold >= self.calm_threshold - 10:
            raise ValueError("stress_threshold must be below calm_threshold - 10")
        return self
