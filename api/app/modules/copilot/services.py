from app.core.schemas import AgentResponse, AgentFact, AgentRecommendation
from app.modules.copilot.schemas import CopilotQueryRequest
from app.modules.copilot import tools
from app.modules.copilot.validator import ClaimValidator


class CopilotService:
    """Lightweight orchestrator for demo: call local tool surface and run ClaimValidator."""

    def query(self, request: CopilotQueryRequest) -> AgentResponse:
        # Resolve incident context
        incident = None
        ctx = None
        # tools expect lga_id for incident context; try to derive
        try:
            ctx = tools.get_incident_context(request.incident_id)
        except Exception:
            ctx = None

        tools_called: list[str] = []
        facts: list[AgentFact] = []
        recommendations: list[AgentRecommendation] = []

        if ctx is not None:
            tools_called.append("get_incident_context")
            lga = ctx.get("lga_id")
            evidence = tools.get_signal_evidence(lga)
            if evidence:
                tools_called.append("get_signal_evidence")
                # build a simple fact from first evidence
                ev = evidence[0]
                facts.append(AgentFact(claim=ev.summary, evidence_id=ev.evidence_id))

        # Suggest a mitigation recommendation from playbook
        playbook = tools.get_mitigation_playbook("default")
        if playbook:
            tools_called.append("get_mitigation_playbook")
            rec = playbook[0]
            recommendations.append(AgentRecommendation(action=rec["name"], requires_approval=True))

        response = AgentResponse(
            agent_role=request.role,
            incident_id=request.incident_id,
            facts=facts,
            inferences=[],
            recommendations=recommendations,
            tools_called=tools_called,
            validation_status="revised",
        )

        # Run claim validation
        validation = ClaimValidator.validate(response, request.incident_id)
        response.validation_status = validation
        return response
