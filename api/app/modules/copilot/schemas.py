from typing import Literal
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.schemas import AgentRecommendation, AgentResponse, SignalDomain
from app.modules.copilot.harness import EvidenceReference


AgentRole = Literal[
    "network_risk",
    "revenue_assurance",
    "customer_experience",
    "mitigation",
    "compliance",
]
FollowUpType = Literal["why_this_action", "show_evidence", "what_if_we_wait", "freeform"]


class CopilotQueryRequest(BaseModel):
    role: AgentRole
    incident_id: str
    query: str


CopilotQueryResponse = AgentResponse


class CopilotInvestigateRequest(BaseModel):
    lga_id: str
    incident_id: str | None = None
    score: float | None = Field(default=None, ge=0, le=100)
    confidence: float | None = Field(default=None, ge=0, le=1)
    time_to_breach_minutes: int | None = None
    triggered_domains: list[SignalDomain] = Field(default_factory=list)
    reason: str


class CopilotFollowUpRequest(BaseModel):
    message: str
    follow_up_type: FollowUpType | None = None
    conversation_id: str | None = None


class CopilotFollowUpResponse(BaseModel):
    harness_run_id: str
    conversation_id: str
    follow_up_type: FollowUpType
    answer: str
    evidence: list[EvidenceReference] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)
    validation_status: Literal["passed", "revised", "rejected"] = "passed"


class FollowUpExchange(BaseModel):
    conversation_id: str
    follow_up_type: FollowUpType
    user_message: str
    assistant_answer: str
    evidence_ids: list[str] = Field(default_factory=list)
    created_at: datetime
