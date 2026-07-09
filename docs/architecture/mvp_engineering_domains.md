# MVP Engineering Domains

> **Historical team-ownership map.** This describes the one-week hackathon
> split and the retired deterministic/Semantic Kernel path. It is retained for
> context, not as current `dev` behavior. Follow the layer specs and
> `AGENT_PRODUCT_PLAN.md` for new implementation work.

The one-week MVP should be built as four connected domains. Each engineer owns a clear surface area and integrates through stable contracts.

## Engineer 1: Data and Risk Engine

Owns the source of truth for early detection.

- `SyntheticEventGenerator`: produces baseline, Ikeja incident, recovery, and reset modes.
- `EventNormalizer`: converts generated events into canonical `SignalEvent` objects.
- `EntityResolver`: maps sites and raw locations to canonical LGA/cluster IDs.
- `FeatureEngine`: computes rolling z-scores, deltas, and co-occurrence signals across network, BTS, billing, sales, recharge, complaints, and device sessions.
- `RiskScoringEngine`: produces score, severity, confidence, and time-to-breach.
- `IncidentImpactBuilder`: produces incident details, affected subscribers, enterprise lines, revenue at risk, and NCC exposure.
- `RecoveryModel`: moves risk from 87 toward 42 after approved mitigation.

Primary contract:

- Writes `RiskScore` and `Incident` state through repository interfaces owned by Engineer 2.

## Engineer 2: API, State, Audit, and Compliance

Owns the backend integration surface.

- `FastAPI App`: shared routing, schemas, CORS, and configuration.
- Public frontend routes:
  - `GET /me`
  - `POST /simulation/start`
  - `POST /simulation/trigger/ikeja`
  - `POST /simulation/mitigate`
  - `POST /simulation/reset`
  - `GET /risk/map`
  - `GET /incidents/{incident_id}`
  - `POST /copilot/query`
  - `GET /actions/options/{incident_id}`
  - `POST /actions/simulate`
  - `POST /actions/approve`
  - `GET /compliance/pack/{incident_id}`
- Backend services/controllers behind those routes:
  - `SimulationController`: start, trigger, mitigate, and reset.
  - `RiskController`: risk map and incident detail reads.
  - `CopilotController`: role-specific copilot query entrypoint and response validation boundary.
  - `ActionController`: mitigation options, simulation, and human approval flow.
  - `ComplianceController`: NCC pack generation endpoint.
  - `ApprovalService`: logs approved actions and triggers recovery.
  - `CompliancePackService`: assembles structured NCC sections.
  - `Repositories`: risk state, incident state, audit log, playbook, operator, and pack storage.
- Agent tool surface for Engineer 4. These are backend functions, not public routes:
  - `get_incident_context`
  - `get_signal_evidence`
  - `estimate_impact`
  - `get_mitigation_playbook`
  - `run_pre_action_simulation`
  - `get_audit_trail`
  - `generate_ncc_pack_draft`
  - `validate_claims_against_context`
  - `write_investigation_note`

Primary contract:

- Exposes stable REST endpoints to Engineer 3 and stable tool/service/repository functions to Engineer 4. Not every backend capability is a route.

## Engineer 3: Frontend Dashboard

Owns the operator-facing demo.

- `React App Shell`: single demo route and API client.
- `SimulationControls`: start stream, trigger Ikeja, approve recovery path, reset.
- `RiskRadar/List`: shows LGA severity and score changes.
- `IncidentPanel`: shows cause, time-to-breach, affected subscribers, revenue at risk, and NCC exposure.
- `CopilotPanel`: role selector, query input, validated structured answers.
- `MitigationPanel`: ranked actions, do-nothing baseline, projected curves, approval button.
- `NccPackView`: renders seven pack sections.

Primary contract:

- Calls Engineer 2's REST endpoints and renders only the returned API shapes.

## Engineer 4: Real Agentic Copilot

Owns narrow, working agents that call real tools.

- `SemanticKernelOrchestrator`: routes selected role/query to the right agent plugin.
- `AzureOpenAIChatService`: Semantic Kernel chat completion service configuration.
- `RoleAgents`: Network, Revenue Assurance, Customer Experience, Mitigation, and Compliance.
- `AgentTools` (SK functions): reads incident context, signal evidence, impact estimates, playbooks, simulations, audit trail, and pack drafts.
- `ClaimValidator`: rejects unsupported KPI, subscriber, money, site, and action claims.
- `InvestigationNoteWriter`: writes validated agent summaries into the incident timeline/audit trail.

Primary contract:

- Uses Engineer 2's tools/repositories, returns structured validated answers to the copilot API, and writes incident-scoped notes.

## Main Demo Path

1. Operator uses the frontend to start the stream and trigger Ikeja.
2. API forwards the command to the synthetic generator.
3. Risk engine computes features, score, breach probability, and incident impact.
4. API stores materialized risk and incident state.
5. Frontend polls risk and incident endpoints.
6. Operator asks a role-specific copilot question.
7. Agent orchestrator routes to the right agent, which calls real backend tools.
8. Claim validator checks the output before the UI renders it.
9. Operator reviews mitigation options from `GET /actions/options/{incident_id}`.
10. API returns comparative projections (`POST /actions/simulate`) against do-nothing.
11. Mitigation agent retrieves playbooks and runs pre-action simulations before recommendation.
12. Operator approves the selected action.
13. Approval service writes audit log and triggers recovery.
14. Risk engine updates the score downward.
15. Compliance service generates the NCC pack from incident state, audit log, and validated agent notes.
