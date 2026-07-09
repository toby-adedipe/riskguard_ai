import unittest

from app.modules.actions.schemas import ActionApproveRequest, ActionSimulateRequest
from app.modules.actions.services import ActionService
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.compliance.services import ComplianceService
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository
from app.modules.simulation.db import SimulationRepository
from app.modules.simulation.services import SimulationService


class DemoJourneyConsistencyTest(unittest.TestCase):
    def test_selected_projection_drives_risk_and_compliance_pack(self) -> None:
        risk_repo = RiskScoreRepository()
        incident_repo = IncidentRepository()
        simulation_repo = SimulationRepository()
        audit_repo = AuditLogRepository()
        pack_repo = CompliancePackRepository()

        simulation = SimulationService(
            simulation_repo,
            risk_repo,
            incident_repo,
        )
        simulation.start()
        status = simulation.trigger_ikeja()
        self.assertIsNotNone(status.incident_id)
        incident_id = status.incident_id or ""

        actions = ActionService(
            audit_repo=audit_repo,
            incident_repo=incident_repo,
            risk_repo=risk_repo,
            simulation_repo=simulation_repo,
        )
        result = actions.simulate(ActionSimulateRequest(incident_id=incident_id))
        selected = result.actions[0]
        projected_target = selected.projected_score_curve[-1]
        expected_delta = selected.projected_score_curve[0] - projected_target
        self.assertEqual(selected.risk_reduction, expected_delta)

        actions.approve(
            ActionApproveRequest(
                incident_id=incident_id,
                action_id=selected.action_id,
                expected_impact=f"Risk score reaches {projected_target:g}",
            )
        )

        current_risk = risk_repo.get("ikeja")
        self.assertIsNotNone(current_risk)
        assert current_risk is not None
        self.assertEqual(current_risk.score, projected_target)

        pack = ComplianceService(
            incident_repo,
            audit_repo,
            pack_repo,
            risk_repo,
        ).build_pack(incident_id)
        self.assertIsNotNone(pack)
        assert pack is not None
        self.assertEqual(
            pack.kpis["current_risk_score"],
            projected_target,
        )


if __name__ == "__main__":
    unittest.main()
