"""Evidence persistence boundary used by ingestion and agent tools."""

from app.modules.evidence.db import (
    EvidenceConflictError,
    EvidenceRepository,
    get_evidence_repo,
)

__all__ = [
    "EvidenceConflictError",
    "EvidenceRepository",
    "get_evidence_repo",
]
