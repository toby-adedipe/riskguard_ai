from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.schemas import (
    AgentFact,
    AgentInference,
    AgentRecommendation,
    AgentResponse,
)


AgentRole = Literal[
    "network_risk",
    "revenue_assurance",
    "customer_experience",
    "mitigation",
    "compliance",
]

AgentRuntimeRole = Literal[
    "orchestrator",
    "network_forensics",
    "impact_exposure",
    "mitigation_planner",
    "compliance_officer",
    "critic",
]


class CopilotQueryRequest(BaseModel):
    role: AgentRole
    incident_id: str
    query: str


CopilotQueryResponse = AgentResponse


class AgentEnvelope(BaseModel):
    """Extended v2 agent output before mapping to the stable core contract."""

    model_config = ConfigDict(extra="forbid")

    agent_role: AgentRuntimeRole
    incident_id: str
    narrative: str
    facts: list[AgentFact] = Field(default_factory=list)
    inferences: list[AgentInference] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
