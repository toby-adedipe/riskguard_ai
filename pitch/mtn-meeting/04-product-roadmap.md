# RiskGuard — product roadmap & market expansion

_Sober version. Assumes the MTN meeting may be due diligence (all top-4 teams invited). The product must be worth building even if MTN converts slowly or not at all._

## 1. What the final product is

**An autonomous incident-to-exposure-to-evidence operator for regulated, signal-rich operations.**

The generalized loop, independent of telco:

```
[signals the business already emits]
  → detect & correlate an emerging incident (unprompted)
  → classify it against the regulator's thresholds
  → quantify exposure (₦: compensation, penalty, revenue at risk)
  → recommend + simulate responses (human approves)
  → produce regulator-ready evidence + append-only audit trail
```

Telco/NCC is the first instantiation. The product thesis: **any regulated operator whose downtime is now billable needs this loop**, and in Nigeria regulators are converging on exactly this pattern (NCC compensation regime; NERC penalties for DisCos; CBN incident reporting for banks; NDPC 72-hour breach notification).

### What "done" looks like (capability list)
| Layer | Final-product capability |
|---|---|
| **Ingestion** | Pluggable adapters: file replay → webhook/Kafka → TM Forum APIs (TMF642/639/628). Normalization to `SignalEvent`. Entity resolution (site→LGA→region) from customer inventory. **Replay engine for historical incidents.** |
| **Detection** | Streaming feature engine on *noisy real* data (not calibrated fixtures): rolling baselines, anomaly scoring, cross-signal correlation, incident lifecycle (emerging→active→recovery), time-to-breach estimation with stated confidence. |
| **Classification** | **Configurable regulator rulepacks** — NCC major-outage thresholds first; NERC/CBN/NDPC later. Rules as data, not code. |
| **Exposure** | Pluggable exposure calculators (subscribers × ARPU × LGA for NCC; penalty schedules for others), validated against the customer's finance numbers. |
| **Reasoning** | A **reason→act loop, not a pipeline**: agents fire machine-initiated on incident events, then iteratively decide which tool to call next based on what they've learned (tool registry, working memory, confidence/budget stopping criteria). Specialist agents = same loop, different goal + tool subset; an orchestrator delegates and merges. Claim validator gates every output. Query mode secondary. |
| **Decision** | Customer-editable mitigation playbooks, pre-action simulation, mandatory human approval, RBAC. |
| **Evidence** | Templated regulator packs (NCC first), consumer-notice drafts, append-only audit log, export/e-file. |
| **Enterprise plumbing** | SSO, roles, persistence (real DB), deployable in customer VPC/on-prem, observability, data-protection posture (NDPR), multi-tenant control plane. |

## 2. Gap analysis — MVP → product (honest)

| # | Gap | Severity | Why |
|---|---|---|---|
| 1 | **Detection is theatrical**: deterministic generator, calibrated to hit 87/42; hardcoded Ikeja numbers | **Critical — the moat** | The demo *asserts* detection; the product must *perform* it on messy real data. Everything else is buildable engineering; this is the part that earns the pilot fee. |
| 2 | **No replay engine** — can't ingest a customer's historical incident file | Critical | This is rung 0 of the integration ladder and the cheapest way to prove value to *any* company, not just MTN. |
| 3 | **Copilot is query-driven**, not machine-initiated | High | The autonomy positioning ("no one prompts it") is currently marketing, not behavior. |
| 3b | **Agents aren't agentic** — the design (even before the stub) is a fixed role-by-role sequence with pre-assigned tools; no agent decides *what to do next* based on what it just learned | High | A pipeline can't handle incidents that don't match the script — ambiguous cause, conflicting signals, missing data. The reason→act loop (assess → choose tool → observe → repeat until confident or budget spent) is what makes the "autonomous operator" claim real, and it's the demo moment that separates us from dashboard vendors. |
| 4 | **NCC thresholds/exposure not actually implemented as rules** — the pack is template prose (compliance doc is aspirational) | High | Classification-against-regulation is the wedge; it must be real logic with citable thresholds. |
| 5 | Single playbook, single incident type, single LGA path | Medium | Fine for demo; product needs playbooks-as-data. |
| 6 | No auth, in-memory/SQLite state, no deployment story, no security posture | Medium | Blocks any real pilot; standard engineering. |
| 7 | Azure OpenAI dependency + prompt determinism | Low-Med | Fine for MTN (Azure-aligned); revisit for other buyers. |

**The strategic read:** gaps 2+4 are cheap and high-leverage; gap 1 is the real work; gap 3 is a small change with big narrative payoff. Gaps 5–6 are known engineering.

## 3. Roadmap (phased, pipeline-independent)

### Phase 0 — before the MTN meeting (this week)
Goal: demo integrity. **Ship the replay adapter (CSV/JSON of incident telemetry → SignalEvent stream) and one machine-initiated agent run** (incident event triggers the Network+Impact agents unprompted). Then the demo's "feed, not a button" and "no one prompts it" beats are true, and "send us any past incident file and we'll show you your own outage in RiskGuard" becomes a real offer — to MTN *or anyone else*.

> Full engineering spec, grounded in the actual `api/app` modules: [`docs/PHASE0_REPLAY_AUTONOMY_SPEC.md`](../../docs/PHASE0_REPLAY_AUTONOMY_SPEC.md).

### Phase 1 — pilot-ready core (4–8 weeks, regardless of who signs)
- Real streaming detection on noisy data: rolling baselines + anomaly scoring + correlation, tested on degraded/imperfect replay data (inject noise, gaps, clock skew).
- NCC rulepack as data: the ≥5% subscribers / ≥5 LGAs / ≥100-sites thresholds implemented and citable; exposure calculator parameterized (ARPU, affected counts).
- **Agentic runtime (gap 3b):** replace the fixed role sequence with a reason→act loop — Semantic Kernel auto function-calling against the tool registry, working memory per investigation, stopping criteria (confidence reached / tool budget / max iterations), full tool-call trace persisted for audit. Specialist agents share the loop with different goals + tool subsets. Claim validator stays a hard gate *after* the loop. Detection stays deterministic and non-LLM — the loop reasons *about* incidents, it doesn't detect them.
- Machine-initiated end-to-end (event → loop → validated conclusion); query mode secondary.
- De-hardcode: any region, any incident type from playbook config.
- Auth, Postgres persistence, Dockerized deploy, basic observability.
- **Exit criterion:** feed it a historical incident file from any operator and it detects, classifies, quantifies, and produces the pack — without us touching code.

### Phase 2 — first paid pilot (8–12 weeks, MTN or whoever moves first)
- One live read-only feed (Kafka/webhook/exports) for one region.
- Tune detection against their ground truth; publish accuracy: detection lead time, false-positive rate, exposure-vs-finance delta, pack turnaround.
- Their playbooks, their operators, their sign-off workflow.
- **Exit criterion:** a written result memo with the three metrics — that memo is the sales asset for every next customer.

### Phase 3 — product & second vertical (post-pilot)
- Multi-tenant control plane, TMF connector library, ServiceNow push, NCC portal integration.
- **Second regulator rulepack** (NERC or CBN — chosen by whichever pipeline conversation is warmest) to prove the rulepack abstraction.
- Security/compliance posture (NDPR documentation, SOC2 path if pursuing banks).

## 4. Beyond MTN — the pipeline (sequenced, not scattershot)

Principle: **expand along the axis of least product change.** Each ring reuses more of what exists.

**Ring 1 — same product, zero change (start outreach now):**
- **Airtel Nigeria, Globacom, 9mobile** — identical NCC regime, identical pain (54 of December's 118 outages were theirs collectively). The MTN meeting itself is leverage: being top-4 at MTN's own hackathon is a credential, and competitors move faster when MTN is sniffing.
- **Tower/infra cos: IHS Towers, American Tower Nigeria** — NCC's enforcement explicitly puts QoS investment obligations on TowerCos; they sit on power/uptime telemetry and pay for failures.
- **ISPs / fixed-wireless (Spectranet, FiberOne, Starlink resellers)** — same regulator, smaller checks, faster cycles; good early logos.

**Ring 2 — new rulepack + adapter, same engine:**
- **Power DisCos (Ikeja Electric, EKEDC, AEDC)** — NERC penalties, outage reporting, feeder-level SCADA signals. Structurally the closest cousin to telco.
- **Banks & fintechs (ops incidents)** — CBN incident-reporting obligations + channel-downtime pain (USSD/app outages are public scandals); NDPC's 72-hour breach notification is the same "incident → evidence pack under deadline" loop.

**Ring 3 — later, only with traction:** oil & gas pipeline monitoring, insurance (NAICOM), pan-African telcos (same NCC-style regimes in Ghana NCA, Kenya CA).

**Sequencing rule:** don't open Ring 2 until Phase 1 exits (the replay demo makes Ring 1 conversations cheap to run in parallel with MTN). One paid pilot in Ring 1 is worth more than five meetings across rings.

**Conflict note:** courting Airtel/Glo while talking to MTN is normal at this stage — but if MTN ever raises exclusivity, that's a *paid* feature of the pilot contract, not a favor.

## 5. How this changes the MTN meeting
Nothing in the room changes — same wedge, same demo, same three pathways. What changes:
- **Measure intent, don't assume it.** Real interest = they accept a concrete next step with a named owner and a date. Warmth without commitment = due diligence; redirect energy to Ring 1.
- **The replay offer is the intent test.** "Send us one historical incident export under NDA and we'll show you your own outage in RiskGuard within two weeks" costs them almost nothing. If they won't do that, they were never buying.
- Build Phase 0/1 for the *market*, not for MTN. MTN is the first at-bat, not the plan.
