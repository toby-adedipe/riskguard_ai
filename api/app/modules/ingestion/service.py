"""Application service that drives replay events through the pure engine."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from typing import TypeAlias
from uuid import uuid4

from app.core.schemas import SignalEvidence
from app.engine import FeatureEngine, RiskScorer
from app.modules.evidence.db import EvidenceConflictError, EvidenceRepository
from app.modules.ingestion.db import IngestionStateRepository
from app.modules.ingestion.replay import ReplaySource
from app.modules.ingestion.schemas import IngestionRunSummary, ReplayIngestionRequest
from app.modules.ingestion.source import (
    ReplayFormat,
    ReplayValidationError,
    SignalEventSource,
)
from app.modules.risk.db import RiskScoreRepository


FeatureEngineFactory: TypeAlias = Callable[[], FeatureEngine]
RiskScorerFactory: TypeAlias = Callable[[], RiskScorer]

RUN_LIMITATIONS = [
    "Replay execution and repositories are process-local in this slice.",
    "This slice derives evidence and risk scores; it does not open incidents or invoke agents.",
    "Replay content is buffered in the request body and has no Phase 0A size limit.",
    "Rows are processed in source order; gap, skew, and late-event handling are not implemented.",
]


class IngestionService:
    def __init__(
        self,
        evidence_repo: EvidenceRepository,
        risk_repo: RiskScoreRepository,
        state_repo: IngestionStateRepository,
        *,
        feature_engine_factory: FeatureEngineFactory = FeatureEngine,
        risk_scorer_factory: RiskScorerFactory = RiskScorer,
    ) -> None:
        self._evidence_repo = evidence_repo
        self._risk_repo = risk_repo
        self._state_repo = state_repo
        self._feature_engine_factory = feature_engine_factory
        self._risk_scorer_factory = risk_scorer_factory

    def ingest_replay(self, request: ReplayIngestionRequest) -> IngestionRunSummary:
        source = ReplaySource(
            content=request.content,
            format=request.format,
            column_mapping=request.column_mapping,
            source_name=request.source_name,
        )
        return self.run(
            source,
            source_name=request.source_name,
            replay_format=request.format,
        )

    def run(
        self,
        source: SignalEventSource,
        *,
        source_name: str,
        replay_format: ReplayFormat,
    ) -> IngestionRunSummary:
        """Synchronously process one source with fresh, run-local engine state.

        Evidence and risk repositories are updated only after the complete
        source has streamed successfully. A malformed later row therefore does
        not leave externally visible partial replay state.
        """

        feature_engine = self._feature_engine_factory()
        risk_scorer = self._risk_scorer_factory()
        events_processed = 0
        touched_lgas: set[str] = set()
        updated_at_by_lga: dict[str, datetime] = {}
        pending_evidence: dict[str, SignalEvidence] = {}

        for event in source.stream():
            events_processed += 1
            touched_lgas.add(event.lga_id)
            previous_timestamp = updated_at_by_lga.get(event.lga_id)
            if previous_timestamp is None or event.timestamp > previous_timestamp:
                updated_at_by_lga[event.lga_id] = event.timestamp

            _feature, evidence = feature_engine.update(event)
            if evidence is not None:
                existing = pending_evidence.get(evidence.evidence_id)
                if existing is not None and existing != evidence:
                    raise EvidenceConflictError(
                        "evidence id "
                        f"{evidence.evidence_id!r} identifies conflicting replay observations"
                    )
                pending_evidence[evidence.evidence_id] = evidence

        if events_processed == 0:
            raise ReplayValidationError(
                "replay did not contain any data rows",
                source_name=source_name,
            )

        scores = [
            risk_scorer.score(
                lga_id,
                feature_engine.latest_for_lga(lga_id),
                updated_at=updated_at_by_lga.get(lga_id),
            )
            for lga_id in sorted(touched_lgas)
        ]

        self._evidence_repo.add_many(
            pending_evidence[evidence_id] for evidence_id in sorted(pending_evidence)
        )
        for score in scores:
            self._risk_repo.upsert(score)

        summary = IngestionRunSummary(
            run_id=f"ingestion:{uuid4()}",
            source_name=source_name,
            format=replay_format,
            events_processed=events_processed,
            evidence_persisted=len(pending_evidence),
            evidence_ids=sorted(pending_evidence),
            scores=scores,
            limitations=list(RUN_LIMITATIONS),
            completed_at=datetime.now(timezone.utc),
        )
        return self._state_repo.save(summary)
