# RiskGuard agent brains

This directory contains the system prompts ("brains") for the RiskGuard agent system. They are runtime artifacts, not documentation: the harness loads them verbatim. See [`../AGENT_PRODUCT_PLAN.md`](../AGENT_PRODUCT_PLAN.md) for the architecture around them.

## Composition rule

Every agent's system prompt = [`_shared.md`](_shared.md) + its own file, concatenated in that order. `_shared.md` is the law common to all agents (grounding, confidence, injection defense, output format). Agent files add identity, goal, domain heuristics, and tool guidance. If a rule appears in both, the agent file wins (it is more specific).

## Placeholders

Prompts use `{{double_brace}}` placeholders filled by the runtime at session start:
`{{incident_id}}`, `{{sector}}` (e.g. "telecom"), `{{regulator}}` (e.g. "NCC"), `{{currency}}` (e.g. "NGN"), `{{brief}}` (orchestrator-provided goal + context slice), `{{budget}}` (tool-call/iteration limits as text), `{{now_utc}}`.

## Roster

| File | Agent | Tool subset |
|---|---|---|
| [`orchestrator.md`](orchestrator.md) | Incident commander | get_incident_context, list_evidence, get_audit_trail, write_investigation_note, request_human_attention (+ delegation, which is runtime, not a tool) |
| [`network-forensics.md`](network-forensics.md) | Cause investigation | get_incident_context, list_evidence, get_feature_windows, get_topology, write_investigation_note |
| [`impact-exposure.md`](impact-exposure.md) | Quantification | get_incident_context, list_evidence, get_lga_profile, estimate_impact, get_feature_windows, write_investigation_note |
| [`mitigation-planner.md`](mitigation-planner.md) | Response options | get_incident_context, get_mitigation_playbook, run_pre_action_simulation, get_audit_trail, write_investigation_note |
| [`compliance-officer.md`](compliance-officer.md) | Rulepack + evidence pack | get_incident_context, get_rulepack, classify_against_rulepack, get_audit_trail, list_evidence, write_investigation_note |
| [`critic.md`](critic.md) | Pre-publication review | list_evidence, get_feature_windows, get_lga_profile, classify_against_rulepack (verification-only; no writes) |

## Editing discipline

- Prompts are versioned with the code; a prompt change is a PR with eval results attached (see plan §9 — no merge below baseline).
- Keep sector-specific heuristics in clearly marked sections so a NERC/CBN variant is a copy-and-edit of one section, not a rewrite.
- Never add a tool to a prompt that the runtime doesn't actually register for that agent — an agent told about tools it can't call will waste budget trying.
