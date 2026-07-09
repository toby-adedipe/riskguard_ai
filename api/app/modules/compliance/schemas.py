from pydantic import BaseModel, Field

from app.core.schemas import AuditLogEntry, Incident


class NCCPack(BaseModel):
    incident: Incident
    timeline: list[str] = Field(default_factory=list)
    affected_services: list[str] = Field(default_factory=list)
    kpis: dict[str, float] = Field(default_factory=dict)
    impacted_subscribers: int = 0
    root_cause: str = ""
    corrective_actions: list[str] = Field(default_factory=list)
    approval_history: list[AuditLogEntry] = Field(default_factory=list)
    evidence_logs: list[str] = Field(default_factory=list)
