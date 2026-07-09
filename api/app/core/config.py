from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "riskguard-api"
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"
    openrouter_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=API_ROOT / ".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
