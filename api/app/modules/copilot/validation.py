from __future__ import annotations

import re

from app.core.schemas import AgentResponse


NUMBER_PATTERN = re.compile(r"\b\d[\d,]*(?:\.\d+)?\b")


class ClaimValidator:
    """Validates grounded outputs before they are returned to callers."""

    def validate(
        self,
        response: AgentResponse,
        *,
        known_evidence_ids: set[str] | None = None,
        allowed_actions: set[str] | None = None,
    ) -> AgentResponse:
        if not response.tools_called:
            return response.model_copy(update={"validation_status": "rejected"})

        evidence_ids = known_evidence_ids if known_evidence_ids is not None else None
        allowed = allowed_actions if allowed_actions is not None else None

        validated_facts = [
            fact
            for fact in response.facts
            if evidence_ids is None or fact.evidence_id in evidence_ids
        ]
        rejected_fact_count = len(response.facts) - len(validated_facts)

        validated_recommendations = [
            recommendation
            for recommendation in response.recommendations
            if allowed is None or recommendation.action in allowed
        ]
        rejected_recommendation_count = (
            len(response.recommendations) - len(validated_recommendations)
        )

        validated_inferences = []
        for inference in response.inferences:
            if self._contains_numeric_claim(inference.claim) and evidence_ids == set():
                continue
            validated_inferences.append(inference)

        rejected_inference_count = len(response.inferences) - len(validated_inferences)

        total_rejections = (
            rejected_fact_count + rejected_recommendation_count + rejected_inference_count
        )
        if total_rejections == 0:
            return response.model_copy(update={"validation_status": "passed"})

        if not validated_facts and response.facts:
            return response.model_copy(
                update={
                    "facts": [],
                    "inferences": validated_inferences,
                    "recommendations": validated_recommendations,
                    "validation_status": "rejected",
                }
            )

        return response.model_copy(
            update={
                "facts": validated_facts,
                "inferences": validated_inferences,
                "recommendations": validated_recommendations,
                "validation_status": "revised",
            }
        )

    @staticmethod
    def _contains_numeric_claim(claim: str) -> bool:
        return bool(NUMBER_PATTERN.search(claim))
