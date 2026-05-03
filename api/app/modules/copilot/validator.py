from app.core.schemas import AgentResponse


class ClaimValidator:
    @staticmethod
    def validate(response: AgentResponse, context_id: str) -> str:
        # Simple rules:
        # - must have called at least one tool
        # - must include at least one fact or inference to pass
        if not response.tools_called:
            return "rejected"
        if response.facts or response.inferences:
            return "passed"
        return "revised"
