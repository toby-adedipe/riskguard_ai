from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.compliance.schemas import NCCPack
from app.modules.incidents.db import IncidentRepository


class ComplianceService:
    def __init__(
        self,
        incidents: IncidentRepository,
        audit: AuditLogRepository,
        packs: CompliancePackRepository,
    ) -> None:
        self._incidents = incidents
        self._audit = audit
        self._packs = packs

    def build_pack(self, incident_id: str) -> NCCPack | None:
        incident = self._incidents.get(incident_id)
        if incident is None:
            return None

        approval_history = self._audit.for_incident(incident_id)

        timeline = [
            f"{incident.opened_at.isoformat()} — incident opened ({incident.cause}).",
            "Risk score peaked at 87 with 47-minute time to breach.",
        ]
        for entry in approval_history:
            timeline.append(
                f"{entry.timestamp.isoformat()} — operator {entry.operator} "
                f"approved {entry.action_id}."
            )
        if incident.phase in ("recovery", "mitigating"):
            timeline.append("Mitigation underway following operator approval.")
        if incident.phase == "resolved":
            timeline.append("Score returned to recovery floor (42).")

        affected_services = ["voice", "data", "sms"]
        if incident.impact.enterprise_lines > 0:
            affected_services.append("enterprise_lines")

        kpis = {
            "peak_risk_score": 87.0,
            "recovery_floor": 42.0,
            "time_to_breach_minutes": 47.0,
            "subscribers_affected": float(incident.impact.affected_subscribers),
            "enterprise_lines_affected": float(incident.impact.enterprise_lines),
            "revenue_at_risk_ngn": float(incident.impact.revenue_at_risk_ngn),
            "compensation_exposure_ngn": float(incident.impact.compensation_exposure_ngn),
        }

        corrective_actions = [
            f"{entry.action_id} — {entry.expected_impact or 'mitigation approved'}"
            for entry in approval_history
        ] or ["No corrective action approved yet."]

        evidence_logs = [f"audit:{entry.entry_id}" for entry in approval_history]

        pack = NCCPack(
            incident=incident,
            timeline=timeline,
            affected_services=affected_services,
            kpis=kpis,
            impacted_subscribers=incident.impact.affected_subscribers,
            root_cause=incident.cause,
            corrective_actions=corrective_actions,
            approval_history=approval_history,
            evidence_logs=evidence_logs,
        )
        self._packs.upsert(pack)
        return pack
