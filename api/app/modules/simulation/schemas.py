from typing import Literal

from pydantic import BaseModel, Field


SimulationMode = Literal["idle", "baseline", "incident", "mitigating", "recovery"]


class SimulationStatus(BaseModel):
    mode: SimulationMode
    incident_id: str | None = None


class SimulationCommandResponse(BaseModel):
    ok: bool
    status: SimulationStatus
    session_id: str | None = None


class SimulationTriggerRequest(BaseModel):
    agent_threshold: float = Field(default=65.0, ge=0, le=100)


class SimulationEventsResponse(BaseModel):
    session_id: str | None
    events: list[dict]
    last_event_id: int
