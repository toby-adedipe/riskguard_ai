"""FastAPI routes for synchronous inline replay ingestion."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.evidence.db import (
    EvidenceConflictError,
    EvidenceRepository,
    get_evidence_repo,
)
from app.modules.ingestion.db import IngestionStateRepository, get_ingestion_repo
from app.modules.ingestion.schemas import IngestionRunSummary, ReplayIngestionRequest
from app.modules.ingestion.service import IngestionService
from app.modules.ingestion.source import ReplayValidationError
from app.modules.risk.db import RiskScoreRepository, get_risk_repo


router = APIRouter(prefix="/ingestion", tags=["ingestion"])


def get_service(
    evidence_repo: EvidenceRepository = Depends(get_evidence_repo),
    risk_repo: RiskScoreRepository = Depends(get_risk_repo),
    state_repo: IngestionStateRepository = Depends(get_ingestion_repo),
) -> IngestionService:
    return IngestionService(evidence_repo, risk_repo, state_repo)


@router.post("/replay", response_model=IngestionRunSummary)
def ingest_replay(
    request: ReplayIngestionRequest,
    service: IngestionService = Depends(get_service),
) -> IngestionRunSummary:
    try:
        return service.ingest_replay(request)
    except ReplayValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "invalid_replay",
                "message": str(exc),
                "source_name": exc.source_name,
                "row_number": exc.row_number,
                "hint": (
                    "Check the replay format, required canonical fields, and "
                    "source-to-canonical column_mapping."
                ),
            },
        ) from exc
    except EvidenceConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "evidence_id_conflict",
                "message": str(exc),
                "hint": (
                    "Use a stable evidence_id only for an identical normalized "
                    "observation, or omit it so replay ingestion derives one."
                ),
            },
        ) from exc


@router.get("/status", response_model=IngestionRunSummary)
def get_status(
    run_id: str | None = Query(default=None),
    state_repo: IngestionStateRepository = Depends(get_ingestion_repo),
) -> IngestionRunSummary:
    summary = state_repo.get(run_id) if run_id is not None else state_repo.latest()
    if summary is None:
        subject = f"ingestion run {run_id!r}" if run_id is not None else "ingestion run"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{subject} not found; submit POST /ingestion/replay first",
        )
    return summary
