# RiskGuard AI Architecture Diagrams

This folder contains three Excalidraw diagrams for the RiskGuard AI system.

For the structural narrative tying these diagrams to the four engineering domains, see [`../MVP_BLUEPRINT.md`](../MVP_BLUEPRINT.md).

Architecture decisions are recorded in [`decisions/`](decisions/). The current
runtime reset and W0 boundary are documented in
[`decisions/0001-w0-agent-runtime-reset.md`](decisions/0001-w0-agent-runtime-reset.md).

## Diagrams

1. `riskguard-infrastructure.excalidraw`

   Infrastructure and data-flow view. This shows signal sources, ingestion, stream processing, risk scoring, materialized state, APIs, agentic workflows, mitigation, audit logging, and compliance pack generation.

2. `riskguard-modules-classes.excalidraw`

   Module and class interaction view. This shows the major code modules/classes, what each one does, and how they interact to implement early detection, investigation, mitigation, recovery monitoring, and compliance evidence generation.

3. `riskguard-mvp-engineering-domains.excalidraw`

   One-week MVP ownership view. This splits the system by the four engineer domains and shows how frontend, API/state, risk engine, and real agentic copilot work together through explicit contracts.

## Design Emphasis

- Early detection and risk scoring are the source of truth.
- AI agents investigate, plan, validate, and document from structured context.
- Mitigation remains human-approved.
- Audit logs and evidence packs prove what happened and what action was taken.
