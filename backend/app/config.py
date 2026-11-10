"""Application settings loaded from environment variables."""

from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Secrets come from .env — never hardcode them."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "production"
    public_base_url: str = "http://localhost:47391"
    # None = derive from public_base_url (https + real host → Secure cookies).
    # Set false for LAN HTTP; true once Nginx Proxy Manager serves HTTPS.
    cookie_secure: bool | None = None
    secret_key: str = "change_me_long_random_string"
    app_encryption_key: str = "change_me_fernet_key"

    @field_validator("cookie_secure", mode="before")
    @classmethod
    def _empty_cookie_secure(cls, value: Any) -> Any:
        if value == "" or value is None:
            return None
        return value

    postgres_db: str = "dotline"
    postgres_user: str = "dotline"
    postgres_password: str = "change_me"
    postgres_host: str = "db"
    postgres_port: int = 5432

    # Writable overlay for imported course YAML (falls back to packaged content)
    content_data_dir: str = "/app/data/content"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
