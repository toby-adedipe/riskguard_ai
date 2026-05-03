from __future__ import annotations

from app.core.schemas import InvestigationRun


class InvestigationRunRepository:
    def __init__(self) -> None:
        self._runs: dict[str, InvestigationRun] = {}

    def create(self, run: InvestigationRun) -> InvestigationRun:
        self._runs[run.run_id] = run
        return run

    def get(self, run_id: str) -> InvestigationRun | None:
        return self._runs.get(run_id)

    def list_for_incident(self, incident_id: str) -> list[InvestigationRun]:
        return [run for run in self._runs.values() if run.incident_id == incident_id]

    def update(self, run: InvestigationRun) -> InvestigationRun:
        self._runs[run.run_id] = run
        return run


_repo = InvestigationRunRepository()


def get_investigation_run_repo() -> InvestigationRunRepository:
    return _repo
