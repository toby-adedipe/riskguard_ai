from functools import lru_cache
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "riskguard-api"
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"
    openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment_name: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-10-21"

    model_config = SettingsConfigDict(env_file=API_ROOT / ".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @computed_field
    @property
    def resolved_azure_openai_deployment_name(self) -> str | None:
        return self.azure_openai_deployment_name or self.azure_openai_deployment

    @computed_field
    @property
    def azure_openai_configured(self) -> bool:
        return bool(
            self.azure_openai_endpoint
            and self.azure_openai_api_key
            and self.resolved_azure_openai_deployment_name
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
