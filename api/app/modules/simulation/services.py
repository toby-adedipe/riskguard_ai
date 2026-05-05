from app.modules.simulation.db import SimulationRepository
from app.modules.simulation.schemas import SimulationStatus
from app.engine import runtime


class SimulationService:
    def __init__(self, repo: SimulationRepository) -> None:
        self._repo = repo
        # Use shared runtime generator/repositories
        self._generator = runtime.generator

    def start(self) -> SimulationStatus:
        runtime.generator.start()
        status = SimulationStatus(mode="baseline", incident_id=None)
        self._repo.set(status)
        return status

    def trigger_ikeja(self) -> SimulationStatus:
        runtime.generator.trigger_ikeja()
        status = SimulationStatus(mode="incident", incident_id="INC-2025-IKEJA-001")
        self._repo.set(status)
        return status

    def mitigate(self) -> SimulationStatus:
        current = self._repo.get()
        # Start recovery via generator
        runtime.generator.enter_recovery()
        status = SimulationStatus(mode="recovery", incident_id=current.incident_id)
        self._repo.set(status)
        return status

    def reset(self) -> SimulationStatus:
        runtime.generator.reset()
        status = SimulationStatus(mode="idle", incident_id=None)
        self._repo.set(status)
        return status
