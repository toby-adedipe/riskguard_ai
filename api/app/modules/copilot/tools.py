from typing import List

from app.modules.incidents.db import get_incident_repo
from app.modules.risk.db import get_risk_repo
from app.modules.audit.db import get_audit_repo
from app.modules.compliance.db import get_compliance_repo
from app.modules.compliance.schemas import NCCPack
from app.core.schemas import SignalEvidence, Incident, IncidentImpact


def get_incident_context(lga_id: str) -> dict | None:
    incidents = get_incident_repo()
    # Search by lga_id
    for inc in incidents._incidents.values():
        if inc.lga_id == lga_id:
            return {
                "incident_id": inc.incident_id,
                "lga_id": inc.lga_id,
                "cause": inc.cause,
                "phase": inc.phase,
                "impact": inc.impact.dict() if isinstance(inc.impact, IncidentImpact) else {},
            }
    return None


def get_signal_evidence(lga_id: str, domains: List[str] | None = None) -> List[SignalEvidence]:
    # The repo for signal evidence isn't modelled; synthesize evidence from risk scores
    risk_repo = get_risk_repo()
    scores = [s for s in risk_repo.list_all() if s.lga_id == lga_id]
    evidence: List[SignalEvidence] = []
    for s in scores:
        ev = SignalEvidence(
            evidence_id=f"ev-{s.lga_id}",
            lga_id=s.lga_id,
            incident_id=None,
            domain="network",
            kpi="cell_availability_pct",
            current_value=0.0,
            baseline_value=None,
            delta_pct=None,
            anomaly_score=s.confidence,
            severity_hint=None,
            summary=f"Risk score {s.score} severity {s.severity}",
            source_system="risk_repo",
            timestamp=s.updated_at,
            related_event_ids=[],
        )
        evidence.append(ev)
    return evidence


def estimate_impact(incident_id: str) -> dict | None:
    incidents = get_incident_repo()
    inc = incidents.get(incident_id)
    if inc is None:
        return None
    return inc.impact.dict()


def get_mitigation_playbook(risk_type: str) -> list[dict]:
    # Return a tiny static playbook for demo purposes
    return [
        {"action_id": "act-1", "name": "Reroute Traffic", "description": "Reroute traffic away from affected cluster", "expected_risk_delta": -20, "cost_ngn": 100000, "time_to_effect_minutes": 10},
        {"action_id": "act-2", "name": "Throttle Non-essential Services", "description": "Reduce non-essential traffic", "expected_risk_delta": -10, "cost_ngn": 20000, "time_to_effect_minutes": 5},
    ]


def run_pre_action_simulation(incident_id: str, action_ids: List[str]) -> dict:
    # Stateless projections: return simple projected curves
    return {
        "incident_id": incident_id,
        "do_nothing_curve": [80, 82, 85, 87],
        "actions": [
            {"action_id": aid, "projected_score_curve": [70, 65, 60, 55], "confidence": 0.6, "time_to_effect_minutes": 10}
            for aid in action_ids
        ],
    }


def get_audit_trail(incident_id: str) -> list:
    audit = get_audit_repo()
    return [a for a in audit.for_incident(incident_id)]


def generate_ncc_pack_draft(incident_id: str) -> NCCPack | None:
    packs = get_compliance_repo()
    return packs.get(incident_id)


def validate_claims_against_context(text: str, context_id: str) -> dict:
    # Very small validator: ensure context exists and text is non-empty
    incidents = get_incident_repo()
    ok = incidents.get(context_id) is not None and bool(text.strip())
    return {"ok": ok, "reason": None if ok else "context-missing-or-empty"}


def write_investigation_note(incident_id: str, agent_role: str, summary: str, evidence_ids: List[str]) -> dict:
    packs = get_compliance_repo()
    pack = packs.get(incident_id)
    note = f"[{agent_role}] {summary} (evidence: {','.join(evidence_ids)})"
    if pack is None:
        return {"ok": False, "message": "pack-not-found"}
    pack.evidence_logs.append(note)
    packs.upsert(pack)
    return {"ok": True, "note": note}
