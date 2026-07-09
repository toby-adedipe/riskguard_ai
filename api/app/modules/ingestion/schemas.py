"""HTTP and application contracts for synchronous replay ingestion."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.schemas import RiskScore
from app.modules.ingestion.source import ReplayFormat


class ReplayIngestionRequest(BaseModel):
    format: ReplayFormat
    content: str
    column_mapping: dict[str, str] | None = None
    source_name: str = Field(default="inline_replay", min_length=1, max_length=200)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("replay content must not be blank")
        return value

    @field_validator("source_name")
    @classmethod
    def source_name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("source_name must not be blank")
        return value


class IngestionRunSummary(BaseModel):
    run_id: str
    source_name: str
    format: ReplayFormat
    events_processed: int = Field(ge=0)
    evidence_persisted: int = Field(ge=0)
    evidence_ids: list[str] = Field(default_factory=list)
    scores: list[RiskScore] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    completed_at: datetime
