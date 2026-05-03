from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.core.schemas import InvestigationTrigger
from app.modules.copilot.schemas import CopilotQueryRequest
from tests.modules.copilot.fixtures import build_seeded_agent


class MainInvestigationAgentTestCase(unittest.TestCase):
    def test_manual_network_query_returns_grounded_response(self) -> None:
        agent, _ = build_seeded_agent()
        request = CopilotQueryRequest(
            role="network_risk",
            incident_id="INC-2025-IKEJA-001",
            query="Why is Ikeja high risk?",
        )

        response = agent.query_role(request)

        self.assertEqual(response.agent_role, "network_risk")
        self.assertEqual(response.validation_status, "passed")
        self.assertGreaterEqual(len(response.facts), 1)
        self.assertIn("get_incident_context", response.tools_called)
        self.assertIn("get_risk_snapshot", response.tools_called)
        self.assertIn("get_signal_evidence", response.tools_called)

    def test_threshold_trigger_runs_multi_agent_investigation(self) -> None:
        agent, run_repo = build_seeded_agent()
        trigger = InvestigationTrigger(
            trigger_id="trigger-001",
            lga_id="ikeja",
            incident_id="INC-2025-IKEJA-001",
            trigger_type="threshold",
            score=87.0,
            confidence=0.91,
            time_to_breach_minutes=47,
            triggered_domains=["network", "billing"],
            reason="Risk score breached the threshold with network and billing anomalies.",
            created_at=datetime.now(timezone.utc),
        )

        run = agent.investigate_trigger(trigger)

        self.assertEqual(run.status, "completed")
        self.assertIn("network_risk", run.selected_roles)
        self.assertIn("revenue_assurance", run.selected_roles)
        self.assertIn("mitigation", run.selected_roles)
        self.assertIsNotNone(run.summary)
        self.assertIsNotNone(run_repo.get(run.run_id))


if __name__ == "__main__":
    unittest.main()
