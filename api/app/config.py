"""Application configuration (P2.1).

Reads environment variables (and a local .env when present). In production a missing
required variable fails fast with a clear message. In development/test, safe local defaults
are used so `make up` works from a fresh clone (DECISIONS.md D-16).
"""
import sys
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_DATABASE_URL = "postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven"
DEV_APP_SECRET = "dev-only-secret-replace-in-production"
DEV_PAIRING_PEPPER = "dev-only-pepper-replace-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    database_url: str = ""
    app_secret: str = ""
    pairing_pepper: str = ""
    allowed_origins: str = "http://localhost:5173,http://localhost:8000"
    device_base_url: str = "http://localhost:8000"

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def sqlalchemy_url(self) -> str:
        """Normalise postgres:// and postgresql:// to the psycopg driver (classic Render bug)."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    def resolved(self) -> "Settings":
        """Apply development defaults / fail fast in production."""
        missing = [n for n in ("database_url", "app_secret", "pairing_pepper") if not getattr(self, n)]
        if not missing:
            return self
        if self.is_production:
            raise RuntimeError(
                "missing required environment variables: "
                + ", ".join(name.upper() for name in missing)
                + " — set them in the environment (Render/Neon), never in code"
            )
        if "database_url" in missing:
            self.database_url = DEV_DATABASE_URL
        if "app_secret" in missing:
            self.app_secret = DEV_APP_SECRET
        if "pairing_pepper" in missing:
            self.pairing_pepper = DEV_PAIRING_PEPPER
        print(
            f"WARNING: using development defaults for: {', '.join(missing)} "
            f"(ENV={self.env}); copy .env.example to .env for real values",
            file=sys.stderr,
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings().resolved()
