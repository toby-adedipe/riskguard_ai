from __future__ import annotations

import unittest

from app.core.schemas import AgentFact, AgentInference, AgentRecommendation, AgentResponse
from app.modules.copilot.validation import ClaimValidator


class ClaimValidatorTestCase(unittest.TestCase):
    def test_rejects_response_without_tool_calls(self) -> None:
        validator = ClaimValidator()
        response = AgentResponse(
            agent_role="network_risk",
            incident_id="INC-2025-IKEJA-001",
            facts=[],
            inferences=[],
            recommendations=[],
            tools_called=[],
        )

        validated = validator.validate(response)

        self.assertEqual(validated.validation_status, "rejected")

    def test_revises_response_with_unknown_evidence_ids(self) -> None:
        validator = ClaimValidator()
        response = AgentResponse(
            agent_role="revenue_assurance",
            incident_id="INC-2025-IKEJA-001",
            facts=[
                AgentFact(claim="Known fact", evidence_id="evd:known"),
                AgentFact(claim="Unknown fact", evidence_id="evd:unknown"),
            ],
            inferences=[
                AgentInference(
                    claim="Revenue at risk is NGN 8,700,000.",
                    confidence=0.9,
                )
            ],
            recommendations=[
                AgentRecommendation(action="reroute_traffic", requires_approval=True),
                AgentRecommendation(action="unsupported_action", requires_approval=True),
            ],
            tools_called=["estimate_impact", "get_signal_evidence"],
        )

        validated = validator.validate(
            response,
            known_evidence_ids={"evd:known"},
            allowed_actions={"reroute_traffic"},
        )

        self.assertEqual(validated.validation_status, "revised")
        self.assertEqual([fact.evidence_id for fact in validated.facts], ["evd:known"])
        self.assertEqual(
            [recommendation.action for recommendation in validated.recommendations],
            ["reroute_traffic"],
        )


if __name__ == "__main__":
    unittest.main()
