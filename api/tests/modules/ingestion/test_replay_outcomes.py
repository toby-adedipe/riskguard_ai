from pathlib import Path
import unittest

from app.modules.evidence.db import EvidenceRepository
from app.modules.ingestion.db import IngestionStateRepository
from app.modules.ingestion.schemas import ReplayIngestionRequest
from app.modules.ingestion.service import IngestionService
from app.modules.risk.db import RiskScoreRepository


FIXTURE_DIR = (
    Path(__file__).resolve().parents[3] / "app" / "demo_data" / "replays"
)


class ReplayOutcomeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.evidence_repo = EvidenceRepository()
        self.risk_repo = RiskScoreRepository()
        self.service = IngestionService(
            self.evidence_repo,
            self.risk_repo,
            IngestionStateRepository(),
        )

    def ingest(self, filename: str, replay_format: str):
        return self.service.ingest_replay(
            ReplayIngestionRequest.model_validate(
                {
                    "format": replay_format,
                    "content": (FIXTURE_DIR / filename).read_text(encoding="utf-8"),
                    "source_name": filename,
                }
            )
        )

    def test_cross_lga_replays_derive_distinct_scores_and_evidence(self) -> None:
        ikeja = self.ingest("ikeja_fibre_cliff.csv", "csv")
        surulere = self.ingest("surulere_congestion.jsonl", "jsonl")
        normal = self.ingest("normal_noisy_control.csv", "csv")

        ikeja_score = ikeja.scores[0]
        surulere_score = surulere.scores[0]
        normal_score = normal.scores[0]

        self.assertEqual(
            (ikeja_score.lga_id, ikeja_score.severity),
            ("ikeja", "red"),
        )
        self.assertEqual(
            (surulere_score.lga_id, surulere_score.severity),
            ("surulere", "red"),
        )
        self.assertEqual(
            (normal_score.lga_id, normal_score.severity),
            ("eti-osa", "green"),
        )
        self.assertNotEqual(ikeja_score.score, surulere_score.score)
        self.assertNotIn(87.0, {ikeja_score.score, surulere_score.score})
        self.assertLess(normal_score.score, 1.0)
        self.assertEqual(ikeja.evidence_persisted, 4)
        self.assertEqual(surulere.evidence_persisted, 4)
        self.assertEqual(normal.evidence_persisted, 0)
        self.assertEqual(len(self.evidence_repo.list_for_lga("ikeja")), 4)
        self.assertEqual(len(self.evidence_repo.list_for_lga("surulere")), 4)
        self.assertEqual(self.evidence_repo.list_for_lga("eti-osa"), [])

    def test_identical_replay_is_deterministic_and_evidence_idempotent(self) -> None:
        first = self.ingest("ikeja_fibre_cliff.csv", "csv")
        second = self.ingest("ikeja_fibre_cliff.csv", "csv")

        self.assertEqual(first.scores, second.scores)
        self.assertEqual(first.evidence_ids, second.evidence_ids)
        self.assertNotEqual(first.run_id, second.run_id)
        self.assertEqual(len(self.evidence_repo.list_for_lga("ikeja")), 4)


if __name__ == "__main__":
    unittest.main()
