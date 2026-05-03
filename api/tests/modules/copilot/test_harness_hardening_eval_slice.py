from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.services import CopilotService
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository
from evals.run_live_harness_hardening_evals import _run_case


class OfflineSettings:
    azure_openai_configured = False


class CopilotHarnessHardeningEvalSliceTestCase(unittest.TestCase):
    def test_hardening_eval_slice_cases(self) -> None:
        eval_path = (
            Path(__file__).resolve().parents[3]
            / "evals"
            / "eval-source-copilot-harness-hardening.jsonl"
        )
        self.assertTrue(eval_path.exists(), f"Missing eval slice: {eval_path}")

        with eval_path.open("r", encoding="utf-8") as handle:
            cases = [json.loads(line) for line in handle if line.strip()]

        self.assertGreaterEqual(len(cases), 6)
        service = self._build_offline_service()
        try:
            for case in cases:
                with self.subTest(eval_id=case["evalId"]):
                    self.assertEqual(_run_case(service, case), [])
        finally:
            service.close()

    @staticmethod
    def _build_offline_service() -> CopilotService:
        with patch("app.modules.copilot.services.get_settings", return_value=OfflineSettings()):
            return CopilotService(
                risk_repo=RiskScoreRepository(),
                incident_repo=IncidentRepository(),
                audit_repo=AuditLogRepository(),
                compliance_repo=CompliancePackRepository(),
                run_repo=InvestigationRunRepository(),
            )


if __name__ == "__main__":
    unittest.main()
