from __future__ import annotations

from app.modules.copilot.tool_registry import ToolRegistry


class InvestigationNoteWriter:
    def write(
        self,
        registry: ToolRegistry,
        *,
        incident_id: str,
        agent_role: str,
        summary: str,
        evidence_ids: list[str],
    ) -> dict[str, object]:
        return registry.call(
            agent_role,
            "write_investigation_note",
            incident_id,
            agent_role,
            summary,
            evidence_ids,
        )
