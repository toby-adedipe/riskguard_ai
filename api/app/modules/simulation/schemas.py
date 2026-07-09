from typing import Literal

from pydantic import BaseModel


SimulationMode = Literal["idle", "baseline", "incident", "mitigating", "recovery"]


class SimulationStatus(BaseModel):
    mode: SimulationMode
    incident_id: str | None = None


class SimulationCommandResponse(BaseModel):
    ok: bool
    status: SimulationStatus
