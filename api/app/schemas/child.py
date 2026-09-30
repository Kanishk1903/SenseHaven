"""Child-facing schemas (P2.4)."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .child_settings import ChildSettings


class ChildIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    birth_year: int | None = Field(default=None, ge=1990, le=2030)
    avatar_key: str = Field(default="orb-1", pattern=r"^orb-[1-8]$")


class ChildPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    birth_year: int | None = Field(default=None, ge=1990, le=2030)
    avatar_key: str | None = Field(default=None, pattern=r"^orb-[1-8]$")


class ChildOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    birth_year: int | None
    avatar_key: str
    settings: dict[str, Any]
    created_at: datetime


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    settings: dict[str, Any]

    @field_validator("settings")
    @classmethod
    def valid(cls, value: dict[str, Any]) -> dict[str, Any]:
        ChildSettings.model_validate(value)
        return value
