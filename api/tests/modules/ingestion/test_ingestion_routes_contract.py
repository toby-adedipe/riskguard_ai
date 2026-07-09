import unittest

from fastapi import HTTPException

from app.modules.evidence.db import EvidenceConflictError
from app.modules.ingestion.db import IngestionStateRepository
from app.modules.ingestion.routes import get_status, ingest_replay
from app.modules.ingestion.schemas import ReplayIngestionRequest
from app.modules.ingestion.source import ReplayValidationError


class InvalidReplayService:
    def ingest_replay(self, _request: ReplayIngestionRequest) -> None:
        raise ReplayValidationError(
            "missing required fields: kpi",
            row_number=4,
            source_name="bad.csv",
        )


class ConflictingEvidenceService:
    def ingest_replay(self, _request: ReplayIngestionRequest) -> None:
        raise EvidenceConflictError(
            "evidence id 'evd:reused' already identifies a different observation"
        )


class IngestionRoutesContractTest(unittest.TestCase):
    def test_replay_validation_error_becomes_actionable_422(self) -> None:
        request = ReplayIngestionRequest(
            format="csv",
            content="timestamp,lga_id\n2026-07-09T10:00:00Z,ikeja\n",
            source_name="bad.csv",
        )

        with self.assertRaises(HTTPException) as raised:
            ingest_replay(request, InvalidReplayService())  # type: ignore[arg-type]

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail["code"], "invalid_replay")
        self.assertEqual(raised.exception.detail["row_number"], 4)
        self.assertIn("column_mapping", raised.exception.detail["hint"])

    def test_status_without_a_completed_run_is_actionable_404(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            get_status(run_id=None, state_repo=IngestionStateRepository())

        self.assertEqual(raised.exception.status_code, 404)
        self.assertIn("POST /ingestion/replay", str(raised.exception.detail))

    def test_evidence_id_conflict_becomes_actionable_409(self) -> None:
        request = ReplayIngestionRequest(
            format="csv",
            content="timestamp,lga_id,domain,kpi,value\n",
        )

        with self.assertRaises(HTTPException) as raised:
            ingest_replay(request, ConflictingEvidenceService())  # type: ignore[arg-type]

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(
            raised.exception.detail["code"],
            "evidence_id_conflict",
        )
        self.assertIn("omit it", raised.exception.detail["hint"])


if __name__ == "__main__":
    unittest.main()
