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


class CopilotRuntimeStatus(BaseModel):
    stage: Literal["w0_spike"] = "w0_spike"
    interactive_runtime: bool = False
    verified_capabilities: list[str] = Field(
        default_factory=lambda: [
            "prompt_composition",
            "strict_output_schema",
            "response_extraction",
            "grounded_fact_validation",
            "transcript_persistence",
        ]
    )
    pending_capabilities: list[str] = Field(
        default_factory=lambda: [
            "model_tool_loop",
            "event_wakeup",
            "multi_agent_orchestration",
            "runtime_budgets",
        ]
    )
