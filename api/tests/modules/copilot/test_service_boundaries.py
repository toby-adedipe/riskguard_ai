from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException

from app.core.schemas import InvestigationTrigger, Operator
from app.demo_data.dataset import load_demo_scenario
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.routes import require_operator_access
from app.modules.copilot.report_documents import report_markdown
from app.modules.copilot.schemas import CopilotFollowUpRequest
from app.modules.copilot.services import CopilotService
from app.modules.copilot.semantic_runtime import SemanticKernelReportDocumentRunner
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


class OfflineSettings:
    azure_openai_configured = False


class CopilotServiceBoundaryTestCase(unittest.TestCase):
    def test_investigate_persists_report_and_supports_multi_turn_follow_up(self) -> None:
        service = self._build_offline_service()
        try:
            report = service.investigate(self._trigger())

            self.assertIsNotNone(service.get_report(report.harness_run_id))
            self.assertEqual(
                [item.harness_run_id for item in service.list_reports_for_incident(report.incident_id or "")],
                [report.harness_run_id],
            )
            self.assertGreaterEqual(len(report.evidence), 1)
            self.assertIsNotNone(report.mitigation_simulation)
            self.assertTrue(report.approval_required)

            why_response = service.follow_up(
                report.harness_run_id,
                CopilotFollowUpRequest(
                    follow_up_type="why_this_action",
                    message="Why should we do this?",
                ),
            )
            self.assertIsNotNone(why_response)
            assert why_response is not None
            self.assertEqual(why_response.follow_up_type, "why_this_action")
            self.assertGreaterEqual(len(why_response.evidence), 1)

            freeform_response = service.follow_up(
                report.harness_run_id,
                CopilotFollowUpRequest(
                    conversation_id=why_response.conversation_id,
                    message="Can you explain the decision another way for the incident room?",
                ),
            )
            self.assertIsNotNone(freeform_response)
            assert freeform_response is not None
            self.assertEqual(freeform_response.follow_up_type, "freeform")
            self.assertEqual(freeform_response.conversation_id, why_response.conversation_id)
        finally:
            service.close()

    def test_investigation_report_includes_social_media_evidence(self) -> None:
        service = self._build_offline_service()
        try:
            report = service.investigate(self._trigger())

            self.assertIn("social_media", {evidence.domain for evidence in report.evidence})
            self.assertTrue(
                any("social" in evidence.source_system for evidence in report.evidence if evidence.source_system)
            )
        finally:
            service.close()

    def test_compile_report_document_returns_downloadable_pdf(self) -> None:
        service = self._build_offline_service()
        try:
            report = service.investigate(self._trigger())

            document = service.compile_report_document(report.harness_run_id)

            self.assertIsNotNone(document)
            assert document is not None
            self.assertEqual(document.media_type, "application/pdf")
            self.assertTrue(document.filename.endswith(".pdf"))
            self.assertGreater(len(document.content), 1000)
            self.assertTrue(document.content.startswith(b"%PDF"))
        finally:
            service.close()

    def test_report_copy_hides_internal_identifiers(self) -> None:
        service = self._build_offline_service()
        try:
            report = service.investigate(self._trigger())
            _, body = report_markdown(report)

            self.assertIn("Network risk specialist", body)
            self.assertIn("Reroute traffic", body)
            self.assertNotIn("network_risk", body)
            self.assertNotIn("revenue_assurance", body)
            self.assertNotIn("reroute_traffic", body)
            self.assertNotIn("mvp-wake-on-signal-investigation", body)
        finally:
            service.close()

    def test_compile_report_document_uses_precompiled_cache_without_live_compiler(self) -> None:
        class FailingDocumentRunner:
            calls = 0

            def run(self, *, report):
                self.calls += 1
                raise ValueError("Semantic Kernel role response was not valid JSON")

            def close(self) -> None:
                pass

        service = self._build_offline_service()
        failing_runner = FailingDocumentRunner()
        service._document_runner = failing_runner
        try:
            report = service.investigate(self._trigger())

            document = service.compile_report_document(report.harness_run_id)

            self.assertIsNotNone(document)
            assert document is not None
            self.assertEqual(document.media_type, "application/pdf")
            self.assertGreater(len(document.content), 1000)
            self.assertTrue(document.content.startswith(b"%PDF"))
            self.assertEqual(failing_runner.calls, 0)
        finally:
            service.close()

    def test_live_role_runner_failure_falls_back_to_deterministic_plugin(self) -> None:
        class FailingRoleRunner:
            def run(self, role_name, context, registry):
                raise TimeoutError("role model timed out")

        service = self._build_offline_service()
        service._agent._role_runner = FailingRoleRunner()
        try:
            with self.assertLogs("app.modules.copilot.orchestrator", level="WARNING"):
                report = service.investigate(self._trigger())

            self.assertEqual(report.status, "passed")
            self.assertIn("network_risk", report.selected_roles)
            self.assertGreaterEqual(len(report.evidence), 1)
        finally:
            service.close()

    def test_report_document_parser_accepts_multiline_json_like_llm_output(self) -> None:
        payload = '''{
  "title": "Incident Report: Ikeja Multi-Domain Service Degradation (INC-2026-IKEJA-001)",
  "body_markdown": "## Executive Summary
On 2026-05-05, RiskGuard AI detected and investigated a multi-domain service degradation.

- **Core/network access degradation:** Cell availability fell from a normal baseline to 72.4% [evd:1].

---PAGE BREAK---

## Open Risks and Next Actions
The operator should preserve evidence."
}'''

        parsed = SemanticKernelReportDocumentRunner._parse_response(payload)

        self.assertEqual(parsed.title, "Incident Report: Ikeja Multi-Domain Service Degradation (INC-2026-IKEJA-001)")
        self.assertIn("---PAGE BREAK---", parsed.body_markdown)
        self.assertIn("72.4%", parsed.body_markdown)

    def test_report_document_parser_accepts_truncated_body_markdown(self) -> None:
        payload = '''{
  "title": "Incident Report: Ikeja Cluster Service Degradation and Billing/Commercial Impact (INC-2026-IKEJA-001)",
  "body_markdown": "Executive Summary

Incident INC-2026-IKEJA-001 was triggered when the Risk score crossed the selected threshold.

Evidence Review
Network degradation and customer complaints were correlated with BTS telemetry [evd:network-1].
BT'''

        parsed = SemanticKernelReportDocumentRunner._parse_response(payload)

        self.assertEqual(
            parsed.title,
            "Incident Report: Ikeja Cluster Service Degradation and Billing/Commercial Impact (INC-2026-IKEJA-001)",
        )
        self.assertIn("Executive Summary", parsed.body_markdown)
        self.assertIn("BT", parsed.body_markdown)

    def test_maybe_investigate_from_signal_respects_wake_threshold(self) -> None:
        service = self._build_offline_service()
        scenario = load_demo_scenario()
        score = scenario.risk_scores[0]
        incident = scenario.incidents[0]
        try:
            report = service.maybe_investigate_from_signal(
                score,
                scenario.feature_windows,
                incident.incident_id,
            )
            self.assertIsNotNone(report)
            assert report is not None
            self.assertEqual(report.incident_id, incident.incident_id)

            low_score = score.model_copy(
                update={
                    "score": 42.0,
                    "confidence": 0.6,
                    "time_to_breach_minutes": 120,
                }
            )
            low_windows = [
                window.model_copy(update={"anomaly_score": 0.3})
                for window in scenario.feature_windows[:1]
            ]
            self.assertIsNone(
                service.maybe_investigate_from_signal(
                    low_score,
                    low_windows,
                    incident.incident_id,
                )
            )
        finally:
            service.close()

    def test_rbac_boundary_blocks_disallowed_role_capability(self) -> None:
        operator = Operator(
            operator_id="op-001",
            name="Revenue Reviewer",
            role="revenue_assurance",
        )

        with self.assertRaises(HTTPException):
            require_operator_access(operator, "mitigation")

        require_operator_access(operator, "reports")

    @staticmethod
    def _trigger() -> InvestigationTrigger:
        return InvestigationTrigger(
            trigger_id="test-trigger-001",
            lga_id="ikeja",
            incident_id="INC-2026-IKEJA-001",
            trigger_type="threshold",
            score=87.0,
            confidence=0.91,
            time_to_breach_minutes=47,
            triggered_domains=["network", "billing", "complaints"],
            reason="Risk score breached threshold with network, billing, and complaints anomalies.",
            created_at=datetime.now(timezone.utc),
        )

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
