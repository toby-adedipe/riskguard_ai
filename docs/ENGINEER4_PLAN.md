# Engineer 4 Wake-On-Signal Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Engineer 4 copilot runtime for RiskGuard AI using Semantic Kernel and Azure OpenAI so a main investigation agent can wake on risk thresholds, delegate to sub-agents, compare mitigations, and return a validated answer quickly.

**Architecture:** Keep prediction and simulation in the risk engine, and keep reasoning and orchestration in the copilot. A main investigation agent wakes from deterministic backend signals, invokes narrow sub-agents through approved backend tools, merges their findings, validates all named claims, and persists short investigation notes for the incident timeline and NCC pack.

**Tech Stack:** FastAPI, Pydantic, Semantic Kernel (Python), Azure OpenAI, in-memory repositories for MVP, pytest for backend tests.

---

## Why This Plan Uses The Microsoft Accelerator Pattern

Use the Microsoft Multi-Agent Custom Automation Engine Solution Accelerator as an orchestration reference, not as the base app. The useful parts are:

- event-driven wake-up
- specialized agents
- orchestration across agents
- persisted run state
- validation before presenting results

What we keep in this repo instead:

- FastAPI backend in `api/app/`
- React/Vite frontend in `client/`
- Semantic Kernel plus Azure OpenAI for the copilot runtime
- tool contracts provided by Engineer 2, prediction logic provided by Engineer 1

This keeps the hackathon stack aligned with the local MVP docs while still using the accelerator's best idea: signals wake a bounded investigation workflow that returns an operator-ready answer fast.

## Scope And Guardrails

- Prediction stays in Engineer 1's domain.
- Tool implementations and REST/state wiring stay in Engineer 2's domain.
- Frontend rendering stays in Engineer 3's domain.
- Engineer 4 owns the main investigation agent, sub-agent orchestration, tool invocation, validation, and investigation-note generation.
- No agent reads raw CSVs or arbitrary database rows.
- No autonomous mitigation execution.
- No open-ended multi-agent debate.
- No long-running background loop. Wake-up should be one bounded investigation run per trigger.

## File Map

### Files Engineer 4 should modify

- Modify: `api/pyproject.toml`
- Modify: `api/.env.example`
- Modify: `api/app/core/config.py`
- Modify: `api/app/core/schemas.py`
- Modify: `api/app/modules/copilot/db.py`
- Modify: `api/app/modules/copilot/routes.py`
- Modify: `api/app/modules/copilot/schemas.py`
- Modify: `api/app/modules/copilot/services.py`
- Modify: `docs/MVP_BLUEPRINT.md` only if the tool contracts or runtime boundaries materially change

### Files Engineer 4 should create

- Create: `api/app/modules/copilot/kernel.py`
- Create: `api/app/modules/copilot/tool_contracts.py`
- Create: `api/app/modules/copilot/tool_registry.py`
- Create: `api/app/modules/copilot/role_plugins.py`
- Create: `api/app/modules/copilot/orchestrator.py`
- Create: `api/app/modules/copilot/triggering.py`
- Create: `api/app/modules/copilot/validation.py`
- Create: `api/app/modules/copilot/investigation_notes.py`
- Create: `api/tests/modules/copilot/test_kernel.py`
- Create: `api/tests/modules/copilot/test_validation.py`
- Create: `api/tests/modules/copilot/test_orchestrator.py`
- Create: `api/tests/modules/copilot/test_triggering.py`

### Files Engineer 2 will own but Engineer 4 must define contracts for

- Modify later by Engineer 2: `api/app/modules/risk/services.py`
- Modify later by Engineer 2: `api/app/modules/incidents/services.py`
- Modify later by Engineer 2: `api/app/modules/actions/services.py`
- Modify later by Engineer 2: `api/app/modules/compliance/services.py`
- Create later by Engineer 2 if needed: `api/app/modules/copilot/tools_backend.py`

## Runtime Design

### Agent breakdown

- **Main Investigation Agent**
  - receives threshold or manual-query trigger
  - selects sub-agents
  - gathers outputs
  - ensures simulation runs before recommendations
  - validates the final answer
  - returns one operator-facing result
- **Sub-agents**
  - `NetworkRiskSubAgent`
  - `RevenueRiskSubAgent`
  - `CustomerImpactSubAgent`
  - `MitigationSubAgent`
  - `ComplianceSubAgent`
- **Rule:** prediction stays outside the agent layer. The agents investigate, explain, compare options, and recommend. They do not compute the risk score or breach estimate themselves.

### Wake-up flow

1. Engineer 1 writes updated `RiskScore`, `FeatureWindow`, `SignalEvidence`, and `Incident` state.
2. Engineer 2 calls the wake-up boundary after a meaningful risk write.
3. `WakeConditionEvaluator` checks deterministic thresholds.
4. If a threshold is met, the `MainInvestigationAgent` creates an `InvestigationRun`.
5. The main agent selects the minimum set of sub-agents needed.
6. Each sub-agent calls only approved SK functions backed by Engineer 2's services.
7. `ClaimValidator` validates facts, numbers, sites, and actions against evidence.
8. The orchestrator stores a short summary and optional investigation note.
9. Frontend and operator can view the result through the existing copilot/query and incident surfaces.

### Manual query flow

1. Frontend calls `POST /copilot/query`.
2. `CopilotService` resolves the relevant incident context.
3. The `MainInvestigationAgent` routes to the requested sub-agent.
4. The sub-agent calls tools.
5. `ClaimValidator` revises or rejects unsupported claims.
6. The validated `AgentResponse` returns to the UI.

### Wake thresholds

These must be deterministic and configuration-backed:

- `score >= 65` and `confidence >= 0.75`
- `time_to_breach_minutes <= 60`
- `score delta over 15 minutes >= 10`
- at least `2` domains have `anomaly_score >= 0.8`
- an incident is already `active` and a new domain joins the anomaly set

### Latency budgets

- Threshold evaluation after risk write: under `1s`
- First triage answer after wake-up: under `5s`
- Full mitigation recommendation: under `12s`
- Compliance/NCC exposure answer: under `15s`

## New Shared Shapes Engineer 4 Needs

These should live in `api/app/core/schemas.py` if they become cross-domain contracts.

### `InvestigationTrigger`

```python
class InvestigationTrigger(BaseModel):
    trigger_id: str
    lga_id: str
    incident_id: str | None = None
    trigger_type: Literal["threshold", "manual_query", "phase_change"]
    score: float | None = None
    confidence: float | None = None
    time_to_breach_minutes: int | None = None
    triggered_domains: list[SignalDomain] = Field(default_factory=list)
    reason: str
    created_at: datetime
```

### `InvestigationRun`

```python
class InvestigationRun(BaseModel):
    run_id: str
    lga_id: str
    incident_id: str | None = None
    trigger: InvestigationTrigger
    selected_roles: list[str] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
    status: Literal["queued", "running", "completed", "failed", "rejected"]
    summary: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
```

## Tool Schemas To Hand Engineer 2

These are backend functions, not public routes. Engineer 4 owns the interface requirements; Engineer 2 owns implementation.

### `get_risk_snapshot`

```json
{
  "name": "get_risk_snapshot",
  "description": "Return the latest risk score and breach estimate for one LGA.",
  "input": {
    "type": "object",
    "properties": {
      "lga_id": { "type": "string" }
    },
    "required": ["lga_id"]
  },
  "output": {
    "type": "object",
    "properties": {
      "lga_id": { "type": "string" },
      "score": { "type": "number" },
      "severity": { "type": "string" },
      "confidence": { "type": "number" },
      "time_to_breach_minutes": { "type": ["integer", "null"] },
      "updated_at": { "type": "string" }
    },
    "required": ["lga_id", "score", "severity", "confidence", "updated_at"]
  }
}
```

### `get_incident_context`

```json
{
  "name": "get_incident_context",
  "description": "Return the active incident summary and identifiers for one LGA or incident.",
  "input": {
    "type": "object",
    "properties": {
      "lga_id": { "type": ["string", "null"] },
      "incident_id": { "type": ["string", "null"] }
    }
  }
}
```

Expected output fields:

- `incident_id`
- `lga_id`
- `cause`
- `phase`
- `opened_at`
- `affected_subscribers`
- `enterprise_lines`
- `revenue_at_risk_ngn`
- `compensation_exposure_ngn`
- `ncc_exposure_summary`

### `get_signal_evidence`

```json
{
  "name": "get_signal_evidence",
  "description": "Return normalized evidence summaries for selected domains in one LGA.",
  "input": {
    "type": "object",
    "properties": {
      "lga_id": { "type": "string" },
      "domains": {
        "type": "array",
        "items": { "type": "string" }
      },
      "limit": { "type": "integer", "default": 10 }
    },
    "required": ["lga_id", "domains"]
  }
}
```

Expected output item shape:

```json
{
  "evidence_id": "evd-ikeja-bts-014",
  "domain": "bts",
  "kpi": "site_availability_pct",
  "current_value": 61.2,
  "baseline_value": 98.5,
  "delta_pct": -37.9,
  "anomaly_score": 0.94,
  "severity_hint": "critical",
  "summary": "BTS-IKJ-014 site availability dropped sharply over the last 15 minutes.",
  "source_system": "synthetic",
  "timestamp": "2026-05-03T10:30:00Z"
}
```

### `get_feature_windows`

```json
{
  "name": "get_feature_windows",
  "description": "Return rolling feature windows and breach-oriented aggregates for selected domains.",
  "input": {
    "type": "object",
    "properties": {
      "lga_id": { "type": "string" },
      "domains": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["lga_id", "domains"]
  }
}
```

### `estimate_impact`

Expected output fields:

- `affected_subscribers`
- `enterprise_lines`
- `revenue_at_risk_ngn`
- `compensation_exposure_ngn`
- `ncc_exposure_summary`

### `get_mitigation_playbook`

Expected output fields per option:

- `action_id`
- `name`
- `description`
- `expected_risk_delta`
- `estimated_cost_ngn`
- `time_to_effect_minutes`
- `side_effects`
- `source_playbook`

### `run_pre_action_simulation`

Expected output fields:

- `incident_id`
- `do_nothing_curve`
- `actions[]`

Expected action item fields:

- `action_id`
- `projected_score_curve`
- `confidence`
- `time_to_effect_minutes`

### `get_audit_trail`

Expected output fields:

- `entry_id`
- `incident_id`
- `operator`
- `action_id`
- `expected_impact`
- `rationale`
- `timestamp`

### `generate_ncc_pack_draft`

Expected output fields:

- `incident`
- `timeline`
- `affected_services`
- `kpis`
- `impacted_subscribers`
- `root_cause`
- `corrective_actions`
- `approval_history`
- `evidence_logs`

### `validate_claims_against_context`

Expected output fields:

- `status`: `passed | revised | rejected`
- `unsupported_claims`
- `revised_text`
- `evidence_ids`

### `write_investigation_note`

Expected output fields:

- `note_id`
- `incident_id`
- `agent_role`
- `summary`
- `evidence_ids`
- `created_at`

## Sub-Agent Design

### `NetworkRiskAgent`

Use when the anomaly is led by `network` or `bts`.

Allowed tools:

- `get_risk_snapshot`
- `get_incident_context`
- `get_signal_evidence`
- `get_feature_windows`

Expected output:

- explain why the LGA is high risk
- separate facts from inferences
- cite evidence ids

### `RevenueAssuranceAgent`

Use when `billing`, `sales`, or `recharge` anomalies are present.

Allowed tools:

- `get_incident_context`
- `get_signal_evidence`
- `estimate_impact`

Expected output:

- explain possible leakage or commercial degradation
- quantify money exposure only from tool output

### `CustomerExperienceAgent`

Use when `complaints` or `device_sessions` anomalies are present.

Allowed tools:

- `get_incident_context`
- `get_signal_evidence`
- `estimate_impact`

Expected output:

- explain customer-facing impact
- quantify affected subscribers only from tool output

### `MitigationPlanningAgent`

Use when the run is expected to produce an action recommendation.

Allowed tools:

- `get_incident_context`
- `get_mitigation_playbook`
- `run_pre_action_simulation`
- `write_investigation_note`

Expected output:

- compare at least one option against do-nothing
- recommend one action
- always mark `requires_approval = true`

### `ComplianceAgent`

Use when severity is high, the incident is active, or approval has happened.

Allowed tools:

- `get_incident_context`
- `estimate_impact`
- `get_audit_trail`
- `generate_ncc_pack_draft`
- `validate_claims_against_context`

Expected output:

- explain NCC exposure
- produce compliance-ready summary
- persist a short note if useful for the pack

## Main-Agent Policy

The orchestrator should not call every agent every time.

### Wake-up selection policy

- If `network` or `bts` dominates, run `NetworkRiskAgent` first.
- If `billing`, `sales`, or `recharge` also exceed threshold, run `RevenueAssuranceAgent` second.
- If `complaints` or `device_sessions` are elevated, run `CustomerExperienceAgent`.
- If `score >= 75` or `time_to_breach_minutes <= 60`, run `MitigationPlanningAgent`.
- If `score >= 80`, `phase == active`, or mitigation is approved, run `ComplianceAgent`.

### Limits

- max `5` role-plugin invocations per wake-up run
- max `3` tool calls per role-plugin invocation
- max `2` response revisions in claim validation

## Eval Strategy

Engineer 4 should use eval-driven development from the start. The repo should contain:

- a deterministic backend test harness for main-agent and sub-agent behavior
- a JSONL eval slice covering the canonical agent capabilities
- a JSONL eval slice covering the wake-on-signal investigation harness
- a command that can run the slice locally before live Azure OpenAI integration is enabled

### Initial eval slice

- File: `api/evals/eval-source-copilot-agent-capabilities.jsonl`
- Coverage:
  - network risk explanation
  - revenue risk explanation
  - customer impact explanation
  - mitigation recommendation with simulation
  - compliance/NCC exposure response
  - phrasing variants per role

### Harness eval slice

- File: `api/evals/eval-source-copilot-harness.jsonl`
- Runtime path: `api/app/modules/copilot/harness.py`
- Coverage:
  - bad or disallowed tool choices are blocked by role-scoped tool policy
  - unsupported claims and missing evidence ids fail validation
  - mitigation recommendations must come after playbook lookup and pre-action simulation
  - threshold-triggered runs select the correct sub-agent set
  - the main agent follows the ordered playbook: collect context, run sub-agents, verify mitigation/compliance, compile report

### Minimum assertions per eval

- required tools were called
- at least one grounded fact is returned
- validation status is `passed`
- mitigation cases include a recommendation backed by simulation
- harness cases include ordered steps, selected roles, evidence ids, and final recommendation checks

### Local command

```bash
cd api
poetry run python -m unittest discover -s tests -p 'test_*.py'
```

### Live harness smoke

```bash
cd api
poetry run python -u -m evals.run_live_harness_evals --limit 1
```

## Task Breakdown

### Task 1: Semantic Kernel Bootstrap

**Files:**
- Modify: `api/pyproject.toml`
- Modify: `api/.env.example`
- Modify: `api/app/core/config.py`
- Create: `api/app/modules/copilot/kernel.py`

- [ ] Add `semantic-kernel[azure]` to `api/pyproject.toml`.
- [ ] Add Azure OpenAI settings to `api/.env.example`:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT_NAME`
  - `AZURE_OPENAI_API_VERSION`
- [ ] Add corresponding settings fields to `api/app/core/config.py`.
- [ ] Implement `build_kernel(settings)` in `api/app/modules/copilot/kernel.py` using `AzureChatCompletion`.
- [ ] Use automatic function calling in the kernel configuration.

### Task 2: Copilot State And Schemas

**Files:**
- Modify: `api/app/core/schemas.py`
- Modify: `api/app/modules/copilot/schemas.py`
- Modify: `api/app/modules/copilot/db.py`

- [ ] Add `InvestigationTrigger` and `InvestigationRun` to `api/app/core/schemas.py`.
- [ ] Extend `CopilotQueryRequest` if needed to support `trigger_source`.
- [ ] Add in-memory storage for investigation runs in `api/app/modules/copilot/db.py`.
- [ ] Provide repository methods:
  - `create_run`
  - `get_run`
  - `list_runs_for_incident`
  - `complete_run`
  - `fail_run`

### Task 3: Tool Contracts And Registry

**Files:**
- Create: `api/app/modules/copilot/tool_contracts.py`
- Create: `api/app/modules/copilot/tool_registry.py`

- [ ] Define Python-side input/output contracts for each approved tool.
- [ ] Register tool metadata in one place so the orchestrator and validators agree on names.
- [ ] Reject any attempt to invoke an unapproved tool.
- [ ] Add tool categories:
  - `read`
  - `simulate`
  - `audit_write`

### Task 4: Claim Validation

**Files:**
- Create: `api/app/modules/copilot/validation.py`
- Create: `api/tests/modules/copilot/test_validation.py`

- [ ] Implement `ClaimValidator` with three outcomes:
  - `passed`
  - `revised`
  - `rejected`
- [ ] Validate:
  - KPI values
  - money values
  - subscriber counts
  - site identifiers
  - recommended actions
- [ ] Reject any claim that does not map to evidence ids or tool outputs.
- [ ] Test fabricated subscriber counts and unsupported mitigation actions.

### Task 5: Role Plugins

**Files:**
- Create: `api/app/modules/copilot/role_plugins.py`
- Create: `api/tests/modules/copilot/test_orchestrator.py`

- [ ] Implement the five role plugins as Semantic Kernel plugins.
- [ ] Keep prompts narrow and task-specific.
- [ ] Hard-code allowed tool lists per plugin.
- [ ] Make the mitigation plugin require both playbook lookup and simulation before recommending.
- [ ] Make the compliance plugin require audit/evidence tools before answering.

### Task 6: Investigation Orchestrator

**Files:**
- Create: `api/app/modules/copilot/orchestrator.py`
- Modify: `api/app/modules/copilot/services.py`

- [ ] Implement `InvestigationOrchestrator`.
- [ ] Add manual query entrypoint:
  - `query_role(request)`
- [ ] Add wake-up entrypoint:
  - `investigate_trigger(trigger)`
- [ ] Record runs in the copilot repository.
- [ ] Route to the minimum set of role plugins based on trigger domains and thresholds.
- [ ] Return a final `AgentResponse` for manual queries and a persisted run summary for autonomous wake-ups.

### Task 7: Wake-On-Threshold Triggering

**Files:**
- Create: `api/app/modules/copilot/triggering.py`
- Modify later by Engineer 2: `api/app/modules/risk/services.py`

- [ ] Implement `WakeConditionEvaluator`.
- [ ] Accept:
  - latest `RiskScore`
  - related `FeatureWindow` list
  - related `Incident`
- [ ] Return either `None` or an `InvestigationTrigger`.
- [ ] Define a handoff method Engineer 2 can call after risk writes:
  - `maybe_create_investigation(score, feature_windows, incident)`
- [ ] Ensure duplicate wake-ups for the same active incident are suppressed for a short cooldown window.

### Task 8: Investigation Notes

**Files:**
- Create: `api/app/modules/copilot/investigation_notes.py`
- Modify: `api/app/modules/copilot/services.py`

- [ ] Build a small helper for validated note-writing.
- [ ] Only mitigation and compliance flows should write notes in MVP.
- [ ] Store note metadata alongside the investigation run until Engineer 2's backend write tool is ready.

### Task 9: Route Integration

**Files:**
- Modify: `api/app/modules/copilot/routes.py`
- Modify: `api/app/modules/copilot/services.py`

- [ ] Keep `POST /copilot/query` as the public route.
- [ ] Do not expose wake-up as a public route.
- [ ] Add internal service methods for autonomous investigations.
- [ ] Make the route always return validated structured output.

### Task 10: Tests And Demo Hardening

**Files:**
- Create: `api/tests/modules/copilot/test_kernel.py`
- Create: `api/tests/modules/copilot/test_triggering.py`
- Modify: `api/tests/modules/copilot/test_orchestrator.py`

- [ ] Test kernel boot with config only.
- [ ] Test wake threshold pass/fail behavior.
- [ ] Test manual query routing.
- [ ] Test mitigation flow refuses to recommend before simulation.
- [ ] Test compliance flow refuses to answer without audit/evidence.
- [ ] Test investigation cooldown behavior.

## Day-By-Day Execution Order

### Day 1

- lock tool schemas with Engineer 2
- add Semantic Kernel dependency and Azure OpenAI config
- create kernel bootstrap
- create copilot state models and investigation repository

### Day 2

- create tool registry and claim validator
- implement role plugin skeletons
- wire manual `POST /copilot/query` path through the orchestrator

### Day 3

- connect real read tools from Engineer 2
- implement wake thresholds and trigger orchestration
- run network, revenue, and customer-experience investigations end to end

### Day 4

- implement mitigation flow using playbook plus simulation
- implement compliance flow using audit and pack-draft tools
- persist validated investigation notes

### Day 5

- trim latency
- tune prompts for determinism
- rehearse threshold wake-up to answer path

## Cut Line If Time Slips

Keep these:

- manual query path
- network, revenue, mitigation, and compliance role plugins
- claim validation
- mitigation recommendation based on simulation
- short persisted investigation notes

Cut these first:

- automatic cooldown sophistication
- feature-window-heavy routing logic beyond the basic thresholds
- customer-experience wake-up branch if it blocks the main demo

## Handoffs

### From Engineer 2 to Engineer 4

- finalized tool names
- tool input/output JSON shapes
- real tool implementations for read paths
- audit and note-writing backend support

### From Engineer 4 to Engineer 2

- exact tool contract document
- required trigger integration point
- copilot validation expectations
- investigation-note payload format

## Success Criteria

- A risk threshold crossing creates one bounded investigation run.
- The copilot can answer manual questions with real tool calls.
- The mitigation agent always uses playbook plus simulation before recommending.
- The compliance agent always uses audit/evidence tools before answering.
- Fabricated KPI or money claims are rejected or revised.
- The system returns an operator-ready answer in a short, predictable time window.
