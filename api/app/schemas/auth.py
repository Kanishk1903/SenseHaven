"""Parent-facing request/response schemas (P2.3+)."""
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    display_name: str = Field(min_length=1, max_length=80)
    timezone: str

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except Exception as error:
            raise ValueError("unknown IANA timezone") from error
        return value


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.strip().lower()


class PinIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)
    pin: str = Field(pattern=r"^\d{6}$")


class ParentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    timezone: str
    has_pin: bool
    created_at: datetime
