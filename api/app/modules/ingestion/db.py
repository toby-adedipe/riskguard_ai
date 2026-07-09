"""Process-local status store for completed synchronous ingestion runs."""

from __future__ import annotations

from threading import RLock

from app.modules.ingestion.schemas import IngestionRunSummary


class IngestionStateRepository:
    def __init__(self) -> None:
        self._runs: dict[str, IngestionRunSummary] = {}
        self._latest_run_id: str | None = None
        self._lock = RLock()

    def save(self, summary: IngestionRunSummary) -> IngestionRunSummary:
        stored = summary.model_copy(deep=True)
        with self._lock:
            self._runs[stored.run_id] = stored
            self._latest_run_id = stored.run_id
        return stored.model_copy(deep=True)

    def get(self, run_id: str) -> IngestionRunSummary | None:
        with self._lock:
            summary = self._runs.get(run_id)
            return summary.model_copy(deep=True) if summary is not None else None

    def latest(self) -> IngestionRunSummary | None:
        with self._lock:
            if self._latest_run_id is None:
                return None
            summary = self._runs[self._latest_run_id]
            return summary.model_copy(deep=True)

    def clear(self) -> None:
        with self._lock:
            self._runs = {}
            self._latest_run_id = None


_repo = IngestionStateRepository()


def get_ingestion_repo() -> IngestionStateRepository:
    return _repo
