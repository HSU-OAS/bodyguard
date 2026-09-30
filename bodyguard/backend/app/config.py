"""NFR-08: explicit settings, no test credentials or production fallback."""

from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BODYGUARD_", extra="forbid")

    environment: Literal["development", "production", "test"] = "production"
    database_url: SecretStr
    security_key: SecretStr
    origin: str
    smtp_username: SecretStr | None = None
    smtp_password: SecretStr | None = None

    @model_validator(mode="after")
    def safe_configuration(self) -> Settings:
        parsed = urlsplit(self.origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Exact origin required")
        if not self.database_url.get_secret_value().startswith("postgresql+psycopg://"):
            raise ValueError("PostgreSQL/psycopg required")
        if len(self.security_key.get_secret_value()) < 43:
            raise ValueError("At least 32 random bytes required for security key")
        if self.environment == "production":
            if parsed.scheme != "https" or parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
                raise ValueError("Production HTTPS origin required")
            if not self.mail_configured:
                raise ValueError("Production mail configuration required")
        elif self.environment == "development" and parsed.hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            raise ValueError("Development HTTP only on loopback")
        return self

    @classmethod
    def from_environment(cls) -> Settings:
        try:
            settings = cls()
            if settings.environment == "test":
                raise ValueError("Test settings cannot launch the server")
            return settings
        except ValidationError, ValueError:
            raise RuntimeError(
                "Invalid BODYGUARD configuration; check required variables"
            ) from None

    @property
    def mail_configured(self) -> bool:
        return bool(
            self.smtp_username
            and self.smtp_username.get_secret_value()
            and self.smtp_password
            and self.smtp_password.get_secret_value()
        )

    @property
    def cookie_name(self) -> str:
        return (
            "__Host-bodyguard_session" if self.environment == "production" else "bodyguard_session"
        )

    @property
    def secure_cookie(self) -> bool:
        return self.environment == "production"
