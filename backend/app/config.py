"""Application configuration loaded from environment variables.

`session_secret` signs the auth cookie. `encryption_key` is a Fernet key that
wraps every per-user platform secret before it lands in PostgreSQL.
Both are mandatory in production but auto-generated for local dev so the
project still boots with an empty .env.
"""
import secrets

from cryptography.fernet import Fernet
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/contentsync"
    )
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    scheduler_poll_seconds: int = 60

    # Auth / crypto secrets. Optional in dev (auto-generated), required in prod.
    session_secret: str = ""
    encryption_key: str = ""

    # Password reset token signing (separate salt so it can't be used as a session cookie).
    # If blank, falls back to session_secret.
    reset_secret: str = ""

    # Base URL the reset email should link back to (the frontend).
    reset_url_base: str = "http://localhost:3000"

    # How long a reset token stays valid (seconds). 30 minutes is the usual default.
    reset_token_max_age_seconds: int = 60 * 30

    def resolved_session_secret(self) -> str:
        if self.session_secret:
            return self.session_secret
        # Memoize so every call inside the same process uses the same key.
        global _DEV_SESSION_SECRET
        if not _DEV_SESSION_SECRET:
            _DEV_SESSION_SECRET = secrets.token_urlsafe(48)
        return _DEV_SESSION_SECRET

    def fernet(self) -> Fernet:
        key = self.encryption_key
        if not key:
            global _DEV_FERNET_KEY
            if not _DEV_FERNET_KEY:
                _DEV_FERNET_KEY = Fernet.generate_key().decode()
            key = _DEV_FERNET_KEY
        try:
            return Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            # A bad key in .env should not brick local dev; fall back to a fresh key.
            return Fernet(Fernet.generate_key())


# Module-level memoization for dev-mode auto-generated secrets.
_DEV_SESSION_SECRET: str = ""
_DEV_FERNET_KEY: str = ""

settings = Settings()
