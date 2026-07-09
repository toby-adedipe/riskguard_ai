import unittest

from app.core.schemas import RiskScore
from app.engine import FeatureEngine
from app.modules.evidence.db import EvidenceRepository
from app.modules.ingestion.db import IngestionStateRepository
from app.modules.ingestion.schemas import ReplayIngestionRequest
from app.modules.ingestion.service import IngestionService
from app.modules.ingestion.source import ReplayValidationError
from app.modules.risk.db import RiskScoreRepository


CSV_REPLAY = """timestamp,lga_id,domain,kpi,value,baseline_value,source_system
2026-07-09T10:00:00Z,ikeja,network,cell_availability_pct,71,99,nms
2026-07-09T10:01:00Z,ikeja,network,dropped_call_rate_pct,18,1,nms
"""


class IngestionApplicationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.evidence_repo = EvidenceRepository()
        self.risk_repo = RiskScoreRepository()
        self.state_repo = IngestionStateRepository()
        self.created_engines: list[FeatureEngine] = []

        def feature_engine_factory() -> FeatureEngine:
            engine = FeatureEngine()
            self.created_engines.append(engine)
            return engine

        self.service = IngestionService(
            self.evidence_repo,
            self.risk_repo,
            self.state_repo,
            feature_engine_factory=feature_engine_factory,
        )

    def test_replay_persists_evidence_and_scores_only_touched_lgas(self) -> None:
        existing = RiskScore(
            lga_id="lekki",
            score=12,
            severity="green",
            confidence=0.8,
            updated_at="2026-07-09T09:00:00Z",
        )
        self.risk_repo.upsert(existing)

        summary = self.service.ingest_replay(
            ReplayIngestionRequest(
                format="csv",
                content=CSV_REPLAY,
                source_name="operator-export.csv",
            )
        )

        self.assertEqual(summary.events_processed, 2)
        self.assertEqual(summary.evidence_persisted, 2)
        self.assertEqual([score.lga_id for score in summary.scores], ["ikeja"])
        self.assertEqual(self.risk_repo.get("lekki"), existing)
        self.assertIsNotNone(self.risk_repo.get("ikeja"))
        self.assertEqual(
            [item.evidence_id for item in self.evidence_repo.list_for_lga("ikeja")],
            summary.evidence_ids,
        )
        self.assertEqual(self.state_repo.latest(), summary)
        self.assertTrue(any("does not open incidents" in item for item in summary.limitations))

    def test_each_run_receives_a_fresh_feature_engine(self) -> None:
        request = ReplayIngestionRequest(format="csv", content=CSV_REPLAY)

        first = self.service.ingest_replay(request)
        second = self.service.ingest_replay(request)

        self.assertNotEqual(first.run_id, second.run_id)
        self.assertEqual(len(self.created_engines), 2)
        self.assertIsNot(self.created_engines[0], self.created_engines[1])
        self.assertEqual(len(self.evidence_repo.list_for_lga("ikeja")), 2)

    def test_invalid_later_row_leaves_repositories_unchanged(self) -> None:
        invalid = CSV_REPLAY + "2026-07-09T10:02:00Z,ikeja,network,,50,99,nms\n"

        with self.assertRaises(ReplayValidationError):
            self.service.ingest_replay(
                ReplayIngestionRequest(format="csv", content=invalid)
            )

        self.assertEqual(self.evidence_repo.list_for_lga("ikeja"), [])
        self.assertEqual(self.risk_repo.list_all(), [])
        self.assertIsNone(self.state_repo.latest())

    def test_header_only_replay_is_rejected_without_writes(self) -> None:
        with self.assertRaises(ReplayValidationError) as raised:
            self.service.ingest_replay(
                ReplayIngestionRequest(
                    format="csv",
                    content="timestamp,lga_id,domain,kpi,value\n",
                )
            )

        self.assertIn("did not contain any data rows", str(raised.exception))
        self.assertEqual(self.risk_repo.list_all(), [])
        self.assertIsNone(self.state_repo.latest())


if __name__ == "__main__":
    unittest.main()
