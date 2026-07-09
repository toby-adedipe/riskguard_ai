"""Process-local repository for normalized signal evidence."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from threading import RLock

from app.core.schemas import SignalEvidence


class EvidenceConflictError(ValueError):
    """An evidence id was reused for a different observation."""


class EvidenceRepository:
    """Store evidence by stable id without silently rewriting prior facts.

    ``add`` is idempotent when the complete evidence payload is identical. A
    conflicting payload is rejected so a stable citation cannot change its
    meaning. Callers that intentionally own replacement semantics may use
    ``upsert`` explicitly.
    """

    def __init__(self) -> None:
        self._evidence: dict[str, SignalEvidence] = {}
        self._lock = RLock()

    def add(self, evidence: SignalEvidence) -> SignalEvidence:
        return self.add_many([evidence])[0]

    def add_many(self, evidence_items: Iterable[SignalEvidence]) -> list[SignalEvidence]:
        """Atomically add a batch after preflighting every stable id."""

        candidates = [item.model_copy(deep=True) for item in evidence_items]
        unique_candidates: dict[str, SignalEvidence] = {}
        for candidate in candidates:
            staged = unique_candidates.get(candidate.evidence_id)
            if staged is not None and staged != candidate:
                raise EvidenceConflictError(
                    _conflict_message(candidate.evidence_id)
                )
            unique_candidates[candidate.evidence_id] = candidate

        with self._lock:
            for evidence_id, candidate in unique_candidates.items():
                existing = self._evidence.get(evidence_id)
                if existing is not None and existing != candidate:
                    raise EvidenceConflictError(_conflict_message(evidence_id))

            for evidence_id, candidate in unique_candidates.items():
                if evidence_id not in self._evidence:
                    self._evidence[evidence_id] = candidate

            return [
                self._evidence[candidate.evidence_id].model_copy(deep=True)
                for candidate in candidates
            ]

    def upsert(self, evidence: SignalEvidence) -> SignalEvidence:
        candidate = evidence.model_copy(deep=True)
        with self._lock:
            self._evidence[candidate.evidence_id] = candidate
            return candidate.model_copy(deep=True)

    def get(self, evidence_id: str) -> SignalEvidence | None:
        with self._lock:
            evidence = self._evidence.get(evidence_id)
            return evidence.model_copy(deep=True) if evidence is not None else None

    def list_for_lga(self, lga_id: str) -> list[SignalEvidence]:
        with self._lock:
            matches = [
                evidence.model_copy(deep=True)
                for evidence in self._evidence.values()
                if evidence.lga_id == lga_id
            ]
        return sorted(
            matches,
            key=lambda item: (_utc_timestamp(item.timestamp), item.evidence_id),
        )

    def clear(self) -> None:
        with self._lock:
            self._evidence = {}


def _utc_timestamp(value: datetime) -> float:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).timestamp()


def _conflict_message(evidence_id: str) -> str:
    return (
        f"evidence id {evidence_id!r} already identifies a different observation"
    )


_repo = EvidenceRepository()


def get_evidence_repo() -> EvidenceRepository:
    return _repo
