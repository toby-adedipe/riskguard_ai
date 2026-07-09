# RiskGuard AI One-Week MVP Plan

> **Historical demo plan.** This document preserves the original one-week,
> deterministic hackathon scope. It does not describe current `dev` behavior
> or the target runtime. Use `AGENT_PRODUCT_PLAN.md` and the layer specs as the
> implementation north star.

## Reality Check

Four people cannot build the full production architecture in one week. The realistic goal is a convincing vertical slice that proves the product value:

1. Detect an emerging Ikeja risk before breach.
2. Explain why it is happening using multiple signal domains.
3. Quantify business and regulatory impact.
4. Simulate mitigation options before approval.
5. Log the approved action.
6. Show recovery.
7. Generate an NCC-ready evidence pack.

Everything outside that demo path should be stubbed, simplified, or deferred.

## Capacity Assumption

Assume 4 people, 5 build days, 6 focused engineering hours per day.

- Raw capacity: 120 ideal hours.
- 20% buffer for bugs, integration, setup, and demo rehearsal: 24 hours.
- Usable build capacity: about 96 hours.

That means the MVP must stay small, deterministic, and demo-script driven.

## MVP Scope

### Must Be Real

- Synthetic event generator with baseline, incident, mitigation, and reset modes.
- Deterministic feature computation for the Ikeja scenario.
- Transparent risk scoring formula.
- Materialized risk and incident state.
- FastAPI endpoints for simulation, risk map, incident detail, copilot query, action approval, simulation, and compliance generation.
- React dashboard with simulation controls, risk radar/list, incident panel, copilot panel, mitigation panel, and compliance view.
- Grounded copilot responses from structured context.
- Pre-action simulation using simple action coefficients.
- Append-only audit log.
- NCC pack rendered from structured incident and audit data.

### Can Be Simplified

- Use deterministic z-scores instead of a full ML anomaly model.
- Use a simple Lagos/LGA visual layout instead of exact production GIS.
- Use SQLite or in-memory state instead of distributed storage.
- Use a minimal real agent runtime instead of a complex autonomous multi-agent system.
- Generate the NCC pack as structured HTML/JSON first; PDF export is optional.
- Support only the canonical Ikeja incident path.

### Out of Scope

- Real MTN integrations.
- Real customer PII.
- Fully automated mitigation.
- Production authentication and RBAC.
- Full NCC legal validation.
- General-purpose Q&A over arbitrary incidents.
- Real Isolation Forest, SHAP, or model training unless everything else is already done.

## Sprint Goal

By the end of the week, the team can run an 8-10 minute demo where RiskGuard AI detects the Ikeja incident early, explains the risk, compares mitigation options, records human approval, shows recovery, and generates an NCC-ready evidence pack.

## Team Split

### Engineer 1: Backend Data and Risk Engine

Owns:

- Synthetic event generator.
- Baseline, incident, recovery, and reset modes.
- Entity resolution for LGA/site mapping.
- Feature computation.
- Risk scoring.
- Incident state.
- Impact estimates.

Done when:

- Triggering Ikeja moves risk from green to red.
- Peak score reaches 87.
- Incident detail returns 47 minutes to breach, 18,420 subscribers, 312 enterprise lines, NGN 8.7m revenue at risk, and NGN 2.1m compensation exposure.
- Mitigation moves score toward 42.

### Engineer 2: API, State, Audit, and Compliance

Owns:

- FastAPI app.
- API contracts.
- In-memory or SQLite repositories.
- Audit log.
- Compliance pack generator.
- Integration between approval and recovery mode.

Done when:

- All demo endpoints work.
- Approved actions are written to audit log.
- Compliance pack returns all required sections in under 10 seconds.

### Engineer 3: Frontend Dashboard

Owns:

- React app shell.
- Simulation control bar.
- Risk radar/list.
- Incident detail panel.
- Risk cascade component.
- Mitigation approval UI.
- Before/after recovery view.
- NCC pack view.

Done when:

- A judge can follow the demo visually without reading backend logs.
- The UI clearly shows green -> red -> mitigation -> recovery.

### Engineer 4: AI, Agentic Workflow, and Demo Integration

Owns:

- Minimal real agent runtime.
- Role-specific agents.
- Context assembler.
- Tool interfaces over internal backend functions.
- Claim validation checks.
- Mitigation recommendation wording.
- Canonical demo questions.
- End-to-end demo script and rehearsal.

Done when:

- Each demo agent calls at least one real tool before answering.
- Copilot answers the required demo questions with facts, inferences, and recommendations separated.
- Answers cite only values present in structured context.
- Mitigation agent actually retrieves playbooks and runs pre-action simulations.
- Compliance agent actually assembles evidence from incident state and audit log.
- The demo can be rehearsed end to end without improvising.

## Minimal Real Agentic Copilot

The agent layer should be real, but tightly bounded. The goal is not autonomous network control. The goal is a working agentic copilot that can inspect structured system state, call tools, produce grounded outputs, and hand the operator an approval-ready recommendation.

### Agent Runtime Shape

Use an orchestrator-workers pattern:

1. `SemanticKernelOrchestrator` receives a user query or system event.
2. It routes to one role agent based on selected role or intent.
3. The role agent can call approved tools.
4. The agent returns structured output.
5. `ClaimValidator` checks that named KPIs, entities, counts, money values, and actions came from tool results.
6. The UI renders the validated answer.

Stack requirement for the hackathon demo: Semantic Kernel SDK + Azure OpenAI.

Each agent run should have:

- Maximum 3 turns.
- Maximum 3 tool calls.
- Required structured output.
- Required citation/evidence IDs for facts.
- No direct access to raw CSVs.
- No write tools except explicitly approved audit/investigation-note tools.

### Minimum Agents

Implement five role agents, but keep their capability narrow:

1. `NetworkRiskAgent`

   Job: explain why the LGA is high risk from network and BTS evidence.

   Required tools:

   - `get_incident_context(lga_id)`
   - `get_signal_evidence(lga_id, domains=["network", "bts", "complaints"])`

   Demo query:

   - "Why is Ikeja high risk?"

2. `RevenueAssuranceAgent`

   Job: identify billing, sales, recharge, and revenue leakage signals.

   Required tools:

   - `get_incident_context(lga_id)`
   - `estimate_impact(incident_id)`
   - `get_signal_evidence(lga_id, domains=["billing", "sales", "recharge"])`

   Demo query:

   - "Are there revenue leakage signals in this incident?"

3. `CustomerExperienceAgent`

   Job: explain customer impact and complaint/session evidence.

   Required tools:

   - `get_incident_context(lga_id)`
   - `get_signal_evidence(lga_id, domains=["complaints", "device_sessions"])`

   Demo query:

   - "How many subscribers are affected?"

4. `MitigationPlanningAgent`

   Job: compare mitigation options and prepare the operator approval recommendation.

   Required tools:

   - `get_incident_context(lga_id)`
   - `get_mitigation_playbook(risk_type)`
   - `run_pre_action_simulation(incident_id, action_ids)`
   - `write_investigation_note(incident_id, agent_role, summary, evidence_ids)`

   Demo query:

   - "What should we do now?"

5. `ComplianceAgent`

   Job: explain NCC exposure and prepare evidence for the compliance pack.

   Required tools:

   - `get_incident_context(lga_id)`
   - `estimate_impact(incident_id)`
   - `get_audit_trail(incident_id)`
   - `generate_ncc_pack_draft(incident_id)`
   - `validate_claims_against_context(text, context_id)`

   Demo query:

   - "What is our NCC exposure if this is not resolved?"

### Required Agent Output Schema

Every agent returns:

```json
{
  "agent_role": "network_risk",
  "incident_id": "INC-2025-0502-IKEJA-001",
  "facts": [
    {
      "claim": "7 BTS sites reported unstable power.",
      "evidence_id": "bts_alarm_summary:IKEJA:latest"
    }
  ],
  "inferences": [
    {
      "claim": "The pattern is consistent with compound fibre degradation and BTS power instability.",
      "confidence": 0.87
    }
  ],
  "recommendations": [
    {
      "action": "Run traffic reroute simulation and prepare field dispatch.",
      "requires_approval": true
    }
  ],
  "tools_called": [
    "get_incident_context",
    "get_signal_evidence"
  ],
  "validation_status": "passed"
}
```

### Real Agentic Behaviors That Must Work

These are the minimum behaviors that make the copilot agentic rather than decorative:

1. The selected agent must call backend tools to fetch current incident context.
2. The mitigation agent must call the playbook tool and the simulation tool before recommending an action.
3. The compliance agent must call audit/evidence tools before generating the NCC pack draft.
4. The claim validator must reject or revise unsupported KPI, money, subscriber, site, or action claims.
5. At least the mitigation and compliance agents should write an investigation note or audit-linked artifact that appears later in the incident timeline or pack.

### What Is Still Out of Scope

- Fully autonomous mitigation.
- Agents browsing arbitrary raw data.
- Agents creating new incidents without deterministic risk thresholds.
- Long-running autonomous loops.
- Multi-agent debate.
- Support for unlimited natural-language questions.
- Production-grade memory beyond incident-scoped notes.

## Day-by-Day Plan

### Day 1: Skeleton and Contracts

- Finalize API response shapes.
- Create backend and frontend app shells.
- Implement synthetic state fixtures for Ikeja.
- Stub all endpoints with expected response shapes.
- Build basic UI layout against mocked data.
- Define agent tool schemas and structured output schema.
- Implement `SemanticKernelOrchestrator` skeleton with mocked SK function calls and Azure OpenAI configuration.

Target demo by end of day:

- Dashboard loads.
- Risk map/list shows baseline state.
- Clicking Ikeja opens a mocked incident panel.

### Day 2: Detection Path

- Implement generator modes.
- Implement risk scoring and incident state.
- Wire simulation controls to backend.
- Make frontend poll risk map and incident APIs.
- Replace mocked agent tools with real backend read tools for incident context, signal evidence, and impact (registered as SK functions).

Target demo by end of day:

- Start stream.
- Trigger Ikeja.
- Score climbs toward 87.
- Incident panel shows impact numbers.

### Day 3: Copilot and Mitigation

- Implement context assembler.
- Implement five role agents as Semantic Kernel plugins with real tool calls.
- Implement claim validation for entity, KPI, money, subscriber, and action claims.
- Implement playbook registry.
- Implement pre-action simulator.
- Build mitigation panel.

Target demo by end of day:

- Ask "Why is Ikeja high risk?"
- See grounded answer produced after real tool calls.
- Review mitigation options.
- See do-nothing vs action projections.

### Day 4: Approval, Recovery, and Compliance

- Implement approval endpoint.
- Write audit log.
- Trigger recovery mode after approval.
- Build before/after comparison.
- Implement NCC pack generator and UI.
- Make mitigation and compliance agents write investigation/audit-linked notes.
- Ensure NCC pack includes agent-generated but validated root cause and corrective action sections.

Target demo by end of day:

- Approve traffic reroute.
- Score drops toward 42.
- Compliance pack renders with timeline, KPIs, root cause, actions, compensation, and evidence logs.

### Day 5: Integration, Polish, and Rehearsal

- Fix integration bugs.
- Improve loading states and error states.
- Lock demo data.
- Rehearse the full demo at least three times.
- Prepare fallback screenshots or static JSON responses.

Target demo by end of day:

- Full 8-10 minute demo runs without code changes.

## Critical Path

1. API contracts.
2. Synthetic generator.
3. Risk scoring and incident state.
4. Frontend polling and incident panel.
5. Copilot context assembly.
6. Mitigation simulation.
7. Approval and audit.
8. NCC pack generation.
9. End-to-end demo rehearsal.

## Biggest Risks

1. Scope creep.

   Mitigation: only support the canonical Ikeja demo path.

2. Frontend/backend integration slips.

   Mitigation: define response shapes on Day 1 and use mock data immediately.

3. Copilot hallucination.

   Mitigation: do not let the model inspect raw data. Give it structured context and validate named claims.

4. Risk score does not tell a clear story.

   Mitigation: calibrate the generator and risk formula before building extra features.

5. NCC pack takes too long or looks weak.

   Mitigation: make five sections data-only and use AI only for root cause and corrective action summaries.

## Cut Line

If the team falls behind, cut in this order:

1. PDF export.
2. Exact Lagos map polygons.
3. Arbitrary copilot questions.
4. Multiple incidents.
5. Real ML model.
6. Autonomous multi-agent loops.
7. Production auth/RBAC.

Do not cut:

- Ikeja detection.
- Risk score and time-to-breach.
- Impact numbers.
- Mitigation simulation.
- Human approval.
- Audit log.
- Real tool-using agents for the canonical demo questions.
- NCC evidence pack.
