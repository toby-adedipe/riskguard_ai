# RiskGuard — demo-to-product plan: real agents, real reasoning

_Self-contained handoff document. A fresh engineering thread should be able to build from this bundle without access to prior conversations._

**Read order for the implementing thread:**
1. This document (the plan) — layer 4 (agents) + the whole-system spine.
2. [`docs/agents/README.md`](agents/README.md) — agent roster, prompt composition rules.
3. [`docs/agents/_shared.md`](agents/_shared.md) + the six agent prompt files — the brains.
4. [`docs/DETECTION_ENGINE_SPEC.md`](DETECTION_ENGINE_SPEC.md) — layer 3, real detection (what wakes the agents).
5. [`docs/rulepacks/README.md`](rulepacks/README.md) + [`docs/rulepacks/ncc.yaml`](rulepacks/ncc.yaml) — layer 5, the regulator as data.
6. [`docs/DELIVERY_SPEC.md`](DELIVERY_SPEC.md) — layer 6, evidence pack / approval gate / audit / filing.
7. [`docs/PHASE0_REPLAY_AUTONOMY_SPEC.md`](PHASE0_REPLAY_AUTONOMY_SPEC.md) — the replay scaffold Phase 0 ships; layers 3–6 above are the Phase 1 "real" versions.
8. [`pitch/mtn-meeting/04-product-roadmap.md`](../pitch/mtn-meeting/04-product-roadmap.md) — commercial phasing and market rings.
9. `api/app/core/schemas.py` — the canonical contracts. Do not redefine them.

**Layer coverage of this bundle** (numbering matches the architecture diagram):
| Layer | Where it's specified |
|---|---|
| 1 Signal sources / 2 Ingestion | `PHASE0_REPLAY_AUTONOMY_SPEC.md` (replay adapter + `SignalSource` seam for live feeds) |
| **3 Detection** | `DETECTION_ENGINE_SPEC.md` |
| **4 Agentic reasoning** | this document + `docs/agents/` |
| **5 Regulator rulepacks** | `docs/rulepacks/` |
| **6 Delivery** (pack, notice, approval, audit, filing) | `DELIVERY_SPEC.md` |
| 7 Platform substrate (tenancy, auth, deploy) | deferred until a pilot demands it — roadmap Phase 1/3 |

---

## 1. What we are building

**An autonomous incident-to-exposure-to-evidence operator for regulated, signal-rich operations.** Telecom/NCC first; power (NERC) and banking (CBN/NDPC) later via pluggable rulepacks.

The loop, end to end:

```
signals the business already emits (read-only)
  → deterministic detection opens an Incident (no LLM, always on)
  → IncidentOpened event wakes the agent system (no human prompt)
  → agents investigate: reason → pick a tool → observe → repeat
  → conclusions: cause, impact, exposure ₦, recommended mitigation
  → critic challenges, claim validator strips anything ungrounded
  → human approves any action; append-only audit records everything
  → regulator-ready evidence pack + consumer notice, on deadline
```

"Real agents" means: nothing in the investigation is a fixed sequence. Each agent decides *what to do next* based on what it just learned, within budgets, and can say "I don't know — escalate."

## 2. Non-negotiable design stances

These are load-bearing. The implementing thread must not relax them for convenience.

1. **Detection is deterministic and LLM-free.** Rolling stats, scoring, thresholds (`app/engine/`, Phase 0 spec). Agents reason *about* incidents; they never detect them. This is the cost, latency, and reliability story.
2. **Agents wake on events, not prompts.** `IncidentOpened` spawns an investigation. `POST /copilot/query` remains as secondary drill-down only.
3. **The claim validator is code, not an agent.** A deterministic gate after the loop: every `fact.evidence_id` must resolve in the evidence store; every number in a claim must match its evidence within tolerance. Unresolvable facts are stripped (`validation_status="revised"`) or the response is rejected.
4. **The critic reviews; it cannot rewrite.** Separation of author and reviewer is what makes the review meaningful.
5. **No agent executes actions.** Every recommendation carries `requires_approval=true`. The only path to recovery/mitigation is the human approval UI → `ApprovalService` → audit entry.
6. **Append-only audit, including agent traces.** Every tool call, every hypothesis update, every critic objection is persisted per investigation. The transcript is a compliance artifact, not debug output.
7. **Untrusted text is data.** Complaint text, dealer notes, log lines, and file contents can contain adversarial instructions. Prompts include injection defenses; evals include injection scenarios.
8. **Graceful degradation.** If the LLM provider is down, the system still detects, classifies (rulepack code), computes exposure (engine code), and assembles a template pack. Agents add reasoning and narrative; they are not a single point of failure.
9. **Contracts over internals.** Everything communicates through `AgentResponse`, the tool catalog, and the event seam. The harness, models, and prompts can all be swapped without touching consumers.

## 3. Runtime: the pi harness

Decision: use **pi** as the agent harness/runtime, with **Azure OpenAI as the model provider**.

**Why pi:** it gives us the agent loop (model ↔ tool-call iteration), a tool registry, session persistence (transcripts as files — which we want anyway as audit artifacts), and provider abstraction, without a heavyweight framework. We keep velocity and own the thin integration layer.

**Decision note (supersedes earlier stack language):** the MTN-facing claim was "Azure OpenAI + Semantic Kernel." The durable part of that claim is *Azure OpenAI + the customer's cloud alignment* — keep it true by pointing pi at Azure OpenAI deployments. Semantic Kernel was hackathon-stack alignment, not a commitment; if a customer's procurement ever mandates SK, the prompts, tools, and contracts port as-is.

**What pi owns:** the reason→act loop mechanics; tool schema registration and dispatch; session/transcript persistence; model provider config; streaming output.

**What we build around it (the integration layer, ~5 components):**
- **Event bridge:** subscribes to `IncidentOpened` (see Phase 0 `core/events.py`), spawns an orchestrator session with the incident id and the composed system prompt.
- **Tool adapter:** exposes the tool catalog (§6) as pi tools; each tool body is an HTTP/direct call into `api/app` repositories and engine functions. Enforces read-only scopes.
- **Budget middleware:** counts tool calls, iterations, tokens, wall time per session; injects a "budget exhausted — conclude now" turn when limits hit; kills runaway sessions.
- **Extractor + validator gate:** parses the agent's final JSON into `AgentResponse`, runs the deterministic claim validator, stamps `validation_status`, persists via `AgentRunRepository`.
- **Trace exporter:** streams the tool-call trace to the frontend investigation view and archives the full transcript to the audit store.

**W0 spike (2 days, before committing):** run one specialist agent on pi against Azure OpenAI with two real tools; verify (a) tool-call loop iterates correctly, (b) transcripts persist and are replayable, (c) budgets are enforceable from outside the loop, (d) structured JSON output is reliably extractable (use a final "emit your AgentResponse now" turn if needed). If any of these fail hard, fall back to a hand-rolled loop on the Azure OpenAI SDK — the prompts and contracts do not change.

## 4. The agent system

### 4.1 Roster

| Agent | Role in one line | Fires |
|---|---|---|
| **Orchestrator** (incident commander) | Owns the investigation: plans, delegates, reconciles, decides when done | On `IncidentOpened` |
| **Network forensics** | Establishes what is happening and the most probable cause, by differential diagnosis | Orchestrator brief |
| **Impact & exposure** | Quantifies who/what is affected and what it costs (₦), with stated assumptions | Orchestrator brief (parallel with forensics) |
| **Mitigation planner** | Compares simulated response options and recommends, never executes | After forensics converges |
| **Compliance officer** | Classifies against the regulator rulepack, tracks deadlines, assembles pack + notice | After impact converges |
| **Critic** | Adversarial pre-publication review of the assembled conclusion | Last, before validator |

Specialists are the **same loop with different goals and tool subsets** — adding a NERC or CBN specialist later is a new prompt + rulepack, not a new architecture.

### 4.2 Control flow

```
IncidentOpened
  → Orchestrator: reads incident context, forms initial hypothesis set,
    writes investigation plan to the investigation file
  → dispatches briefs: [network-forensics] and [impact-exposure] in parallel
  → each specialist runs its own reason→act loop, returns a Finding
  → Orchestrator reconciles (conflicts → targeted re-brief, max 2 rounds)
  → dispatches [mitigation-planner] (needs cause) and [compliance-officer] (needs impact)
  → composes the draft conclusion from Findings
  → dispatches [critic] on the draft
  → addresses critic objections (fix or annotate as accepted-risk)
  → final AgentResponse set → claim validator (code) → persist → publish
  → if any stop condition fails (budgets, unresolved conflict, low confidence
    + regulatory clock) → request_human_attention with a precise question
```

Parallelism is orchestrator-level (two pi sessions at once), not agent-internal. Delegation depth is 1: specialists cannot spawn agents.

### 4.3 Shared cognitive architecture

- **Investigation file** (working memory, persisted JSON per incident): hypothesis ledger (`hypothesis, status: open/supported/rejected, evidence for/against`), evidence ledger (ids seen so far), open questions, assumption register, tool log. The orchestrator owns it; specialists receive the relevant slice in their brief and return deltas.
- **Confidence scale** (uniform across agents): `≥0.90` multiple independent corroborating evidence lines; `0.70–0.89` one strong line, nothing contradicting; `0.50–0.69` plausible but a live alternative remains; `<0.50` do not assert — list as open question.
- **Budgets (defaults, tune in evals):** specialist ≤12 tool calls / ≤8 iterations / 120s; orchestrator ≤10 own tool calls, ≤6 delegations total (initial 4 + 2 re-briefs); investigation ≤150k tokens, cost alert at ~$2. On exhaustion: conclude with what is grounded, mark the rest open questions.
- **Stopping criteria (any):** goal answered at confidence ≥0.7; budget exhausted; new tool results stopped changing the hypothesis ledger (two consecutive non-informative observations).

### 4.4 Inter-agent protocol

Orchestrator → specialist **Brief**: `{incident_id, goal (one question), context_slice (relevant investigation-file entries), constraints (budget, deadline), prior_findings (if re-brief)}`.
Specialist → orchestrator **Finding**: the specialist's `AgentResponse` (§7) plus `hypothesis_deltas` and `open_questions`. Findings are appended to the investigation file verbatim — the orchestrator may weigh them, never edit them.

### 4.5 Reconciliation rules (orchestrator)

- Measured beats derived: direct evidence (a KPI reading) outranks a computed estimate when they conflict.
- Two specialists disagreeing → one targeted re-brief each with the specific contradiction quoted; if still unresolved, report both with confidences and escalate if material to classification or money.
- Never average confidences; the orchestrator's confidence in a claim is the strongest *supported* line of evidence, discounted by unresolved contradictions.

## 5. Failure modes and degradation ladder

| Failure | Behavior |
|---|---|
| LLM provider down / timeout | Publish deterministic bundle only (score, classification, exposure, template pack); mark analysis "unavailable — deterministic outputs only"; retry queue |
| Agent emits unparseable output | One repair turn ("emit valid AgentResponse JSON only"); then fail that agent's Finding, orchestrator proceeds without it |
| Validator rejects everything | Publish nothing from that agent; log; orchestrator notes the gap; escalate if the gap is cause or exposure |
| Budget exhausted mid-investigation | Conclude with grounded partials + open questions; never silently truncate |
| Tool error / empty data | The observation "this data is unavailable" is itself evidence — agents must state it, not retry >2× |
| Runaway cost | Budget middleware hard-kills; incident stays open with deterministic outputs; alert |

## 6. Tool catalog

All tools resolve to `api/app` repositories/engine functions. **Read-only unless marked.** Args/returns reference `core/schemas.py` shapes.

| Tool | Args → returns | Notes |
|---|---|---|
| `get_incident_context` | `incident_id` → Incident + RiskScore history + phase | First call of almost every agent |
| `list_evidence` | `lga_id, domains?, since?, limit?` → `SignalEvidence[]` | The grounding source; every fact cites an `evidence_id` from here |
| `get_feature_windows` | `lga_id, kpi?` → `FeatureWindow[]` | Z-scores, deltas, time-to-breach inputs |
| `get_topology` | `lga_id` → sites, clusters, corridors | Spatial pattern analysis (fibre corridor vs power feeder) |
| `get_lga_profile` | `lga_id` → subscribers, enterprise_lines, arpu_daily_ngn, sites | The finance inputs; single source of truth fixture |
| `estimate_impact` | `incident_id` → `IncidentImpact` | Deterministic engine calc; agents cite it, never recompute by hand |
| `get_rulepack` | `regulator` → thresholds, deadlines, clause ids, templates (versioned) | NCC first; NERC/CBN are new files |
| `classify_against_rulepack` | `incident_id, regulator` → `{is_major, thresholds_hit[], reasons[], deadlines[]}` | The only legitimate way to classify |
| `get_mitigation_playbook` | `risk_type` → `MitigationOption[]` | Customer-editable data |
| `run_pre_action_simulation` | `incident_id, action_ids[]` → projected score curves vs do-nothing | Mandatory before any recommendation |
| `get_audit_trail` | `incident_id` → `AuditLogEntry[]` | What has already been approved/done |
| `search_similar_incidents` | `query` → past incident summaries | Phase 2+ (needs history); prompts already reference it defensively |
| `write_investigation_note` | `incident_id, agent_role, summary, evidence_ids[]` → note id | **Write, append-only.** Surfaces in the pack |
| `request_human_attention` | `incident_id, reason, urgency, question` → ack | **Write.** The escalation path; must contain a specific answerable question |

## 7. Output contract

Core contract is `AgentResponse` in `core/schemas.py` — unchanged for all consumers. Agents emit the **extended v2 envelope**; the extractor maps it down:

```json
{
  "agent_role": "network_forensics",
  "incident_id": "INC-...",
  "narrative": "3-6 sentences a NOC shift lead can read in 20 seconds",
  "facts": [{"claim": "cell_availability_pct fell from 99.1 to 71.4 in IKJ-CL-04", "evidence_id": "EV-..."}],
  "inferences": [{"claim": "pattern consistent with backbone fibre cut on the Ikeja–Ojota corridor", "confidence": 0.82}],
  "recommendations": [{"action": "review reroute option RR-2 for approval", "requires_approval": true}],
  "open_questions": ["no power-domain evidence available for sites IKJ-07/08"],
  "assumptions": ["ARPU figure is the 2026-Q2 profile value"],
  "tools_called": ["get_incident_context", "list_evidence", "get_topology"]
}
```

`validation_status` is stamped by the validator, never self-assigned. Facts = tool-grounded observations only. Inferences = reasoning with calibrated confidence. Anything not grounded and not confidently inferable goes in `open_questions` — that list is a feature, not an apology.

## 8. Security and safety

- **Prompt injection:** shared prompt carries the data-not-instructions rule; tool adapter additionally strips/flags imperative patterns in free-text fields (complaint text, dealer notes); eval scenario 11 is a canary injection that must never surface in output.
- **Scopes:** agent service account has read-only DB scopes + the two append-only writes. No network-element access exists anywhere in the product.
- **Data protection (NDPR):** subscriber data enters agent context only as aggregates (counts, ARPU averages); no MSISDNs in prompts or transcripts; transcripts encrypted at rest; per-tenant retention config.
- **Cost controls:** per-incident and per-day budget caps in the middleware; dashboard for $/incident; model routing (cheap model for specialists' routine steps, strong model for orchestrator/critic) as a Phase 2 optimization.
- **Auditability:** transcript + tool log + validator report per investigation, exportable; this is a *selling point* for regulated buyers — design it as a first-class artifact.

## 9. Evaluation harness (build alongside, not after)

Golden scenario library (each = replay fixture + expected outcomes):

| # | Scenario | Must get right |
|---|---|---|
| 1 | Ikeja backbone fibre cut (canonical) | cause=fibre; major=yes; exposure within ±5% of golden; reroute recommended |
| 2 | Power failure (Agege pattern) | cause=power not fibre; different corrective actions |
| 3 | Event congestion (Eti-Osa pattern) | cause=congestion; likely *not* NCC-major; no fibre claims |
| 4 | DDoS (Surulere pattern) | cause=cyber; security actions; availability KPIs near-normal |
| 5 | Theft/vandalism (Alimosho pattern) | multi-site dark + security evidence; police/report actions |
| 6 | Billing leakage, network healthy | revenue path; no network-incident claims; not NCC-major |
| 7 | Ambiguous: simultaneous fibre + power signals | holds both hypotheses; confidence <0.7 on single cause; escalates or reports both |
| 8 | Self-recovering blip | no incident opened (detection), or agents conclude "monitor, no action" |
| 9 | Missing data: no LGA profile | impact says "cannot quantify subscribers — profile unavailable"; **invents nothing** |
| 10 | Conflicting subscriber counts across sources | flags the discrepancy explicitly; uses conservative bound; escalates if material |
| 11 | Injection: complaint text contains adversarial instructions | instructions ignored; canary string absent from all output |
| 12 | Multi-LGA at the ≥5-LGA threshold boundary | correct threshold arithmetic and citation |

**Deterministic graders:** JSON validity; grounding (every `evidence_id` resolves; numbers in claims match evidence within tolerance); classification vs golden; exposure tolerance; budget compliance; injection canary; **anti-script check** — tool-call sequences across scenarios 1–6 must differ materially (if the "agent" calls the same tools in the same order regardless of scenario, it's still a pipeline).
**Rubric graders (LLM):** differential diagnosis quality (were alternatives considered and ruled out with evidence?); confidence calibration; narrative usefulness.
**Gate:** no prompt/model/tool change merges without the eval suite ≥ baseline. Track per-scenario pass + cost + latency.

**Production telemetry (pilot metrics = sales assets):** validator strip-rate per agent; human edit-distance on packs; operator acceptance rate of recommendations; detection→conclusion latency; $/incident.

## 10. Build plan

| WS | What | Depends on | Exit criterion |
|---|---|---|---|
| **W0** | pi + Azure OpenAI spike (§3) | — | loop, transcripts, budgets, extraction verified |
| **W1** | Tool surface: implement §6 catalog against repos/engine; evidence store; read-only scopes | Phase 0 engine | every tool callable + contract-tested |
| **W2** | Agent brains: compose prompts from `docs/agents/`; extractor; validator gate; investigation file; orchestrator flow §4.2 | W0, W1 | scenario 1 passes end-to-end machine-initiated |
| **W3** | Detection hardening: Phase 0 engine on noisy/degraded replay data (gaps, clock skew, missing domains) | Phase 0 | scenarios 7–9 detect sensibly |
| **W4** | NCC rulepack as versioned data (thresholds, clause ids, deadlines, pack template, compensation formula); `classify_against_rulepack` | W1 | scenario 12 passes; clause citations in packs |
| **W5** | Frontend investigation view: live tool-call trace, hypothesis ledger, critic verdict, approval gate, pack render | W2 | a non-engineer can follow an investigation live |
| **W6** | Eval harness + CI gate + cost/trace dashboards (§9) | W2 | 12 goldens automated; gate enforced |

Suggested ownership matches existing domains: Eng1 → W3, Eng2 → W1+W4, Eng3 → W5, Eng4 (you) → W0+W2+W6.

**Sequencing against the commercial roadmap:** W0–W2 on scenario 1 is the Phase 1 centerpiece; W3/W4 complete Phase 1's exit criterion ("feed any operator's historical file → detect, classify, quantify, pack — no code changes"); W5/W6 make the pilot demo and the pilot *measurable*. The MTN meeting (Phase 0) does not wait for any of this.

**First PR for the implementing thread:** W0 spike + `docs/agents/` prompts loaded verbatim + scenario 1 fixture + the extractor. Everything else follows from there.

## 11. Definition of done (product, Phase 1 scope)

- An `IncidentOpened` event — from replay of *any* conforming telemetry file — produces, unprompted: a validated multi-agent conclusion (cause, impact, exposure, recommendation, classification) with a visible reasoning trace, a critic verdict, and a draft regulator pack, inside budget, with every fact traceable to evidence.
- Scenarios 1–12 pass their deterministic graders; rubric scores ≥ baseline; anti-script check passes.
- Kill the LLM provider mid-run → deterministic outputs still publish; audit shows the degradation.
- A second regulator rulepack can be added as data files only (prove with a NERC stub).
