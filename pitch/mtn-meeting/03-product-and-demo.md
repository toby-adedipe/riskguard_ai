# Product, integration & demo design

_How the hackathon MVP becomes a product MTN can connect to — and what to actually put on screen._

## 1. The reframe: what we're selling
Not a dashboard. An **Incident-to-Compliance autopilot** — an agentic layer on top of MTN's existing monitoring that turns a live incident into: (1) an early warning with time-to-breach, (2) a ranked, simulated mitigation, (3) a regulator-ready NCC pack, and (4) a live compensation-exposure number. Same MVP, productized as a *layer*, not a platform.

**What MTN is buying:** not "an agent platform" (too abstract) and not "a risk dashboard" (too undifferentiated) — an **autonomous risk-and-compliance operator**. The wedge is that no one prompts it: it listens to the signals the network already emits and concludes on its own. Risk/compliance is the value (Chinyelu's budget); the agentic autonomy is the differentiator (what excites Ebuka, a platforms architect). Honest caveat: the MVP copilot is query-driven, so the productized demo must show the *machine-initiated* path — the incident emerges from the stream and the system raises it unprompted — not a human typing a question.

## 2. Why productizing is easy for us (the load-bearing fact)
Our architecture already separates the data **source** from the **reasoning**. `SignalEvent` is a canonical, normalized record; the synthetic generator is swappable. So connecting to MTN is *replacing the generator with an adapter* — the risk engine, agents, and compliance pack don't change. Lead with this when Ebuka asks "how does this touch our world."

Three planes:
| Plane | Status | What it is |
|---|---|---|
| Ingestion / adapters | new, thin | Connectors that map MTN feeds → `SignalEvent`. Read-only. |
| Reasoning | exists | Risk engine + 5 role agents + claim validator. Source-agnostic. |
| Output / action | exists + extend | NCC pack, exposure, recommendations → dashboard / ServiceNow / NCC portal. |

**Pilot integration contract:** consume a Kafka topic (or near-real-time export) of alarms + KPIs, plus read-only inventory + subscriber context; emit structured outputs. We never touch network elements.

## 3. What MTN runs — where each adapter plugs in
| MTN system (examples) | Category | Feeds our… |
|---|---|---|
| IBM Netcool, Huawei NCE, Nokia NetAct | Fault / alarm mgmt (OSS) | alarm stream → Network agent |
| Ericsson ENIQ, Nokia NetAct, Huawei PRS | Performance mgmt (OSS) | KPI stream (latency, loss, uptime) |
| Netcracker, Amdocs, GE Granite | Inventory / topology (OSS) | site → LGA → cluster mapping |
| BMC Remedy, ServiceNow | Ticketing / field dispatch | mitigation → work order (output) |
| Amdocs, Ericsson/MATRIXX, Huawei CBS, Salesforce | BSS billing / charging / CRM | subscribers, enterprise lines, ARPU → exposure |
| Subex, Mobileum, WeDo | Revenue assurance / fraud | adjacency for Revenue agent |
| NETSCOUT, EXFO, Infovista | Probes / QoE | QoS ground truth |
| NCC Uptime / major-outage portal | Regulator | evidence pack + notice (output) |

**The glue:** TM Forum Open APIs — TMF642 (alarm mgmt), TMF639 (resource inventory), TMF628 (performance). Plus SID / eTOM / ODA. Say these; they signal we understand enterprise telco integration. Our copilot is Azure OpenAI + Semantic Kernel, so we're already aligned with MTN's Microsoft/Azure stack.

## 4. The agents as a 24/7 virtual ops-and-compliance team (mapped to money)
Every claim traces to a tool call; the **Claim Validator** is our enterprise-trust story (no hallucinated numbers reach the operator).

| Agent | Real MTN problem | Catches it… | The money |
|---|---|---|---|
| Network Risk | fibre cut / transport / power fault | early — correlates weak signals into an emerging incident + time-to-breach | faster MTTR, avoided major-outage classification |
| Impact / Revenue | who's affected + what it costs | in real time | subscribers, enterprise lines, revenue-at-risk, **NCC compensation exposure** |
| Mitigation Planning | which action, at what cost | before acting — simulates do-nothing vs reroute/failover, ranks by cost/impact | least-cost recovery, human-approved |
| Compliance | NCC filing + consumer notice | at breach — classifies vs thresholds, drafts the pack | avoided fines, hours→minutes filing |
| Investigation / Audit | RCA + defensible record | throughout — grounded note + append-only audit | non-repudiable evidence, dispute defence |

## 5. What to demo (productized demo, not the hackathon script)
Evolve the demo in four beats so it reads as a *system that consumes telemetry*, not a scripted story:

1. **Feed, not a button.** Show a (realistic mock) live alarm/KPI stream flowing in: "this is where your Netcool alarms and ENIQ KPIs land." The incident **emerges from the stream** instead of "click Trigger."
2. **A "before it happens" beat (honest predictive).** The system flags an *emerging* incident from weak signals — latency creeping + packet loss + a power dip + complaint spike — with "≈47 minutes to SLA breach, act now." This is early breach prediction, not clairvoyance. Say it that way.
3. **Agents visibly working as a team.** Surface each agent's tool calls: Network correlates alarms → Impact computes exposure → Mitigation simulates options → Compliance drafts the pack. The visible multi-agent choreography is the wow, and the Claim Validator badge is the trust.
4. **End on money + regulator.** The compensation-exposure figure, the NCC pack, and the consumer-notification draft. Payload for Chinyelu (money) and the compliance office (mandatory).

Keep the Ikeja fibre-cut as the scenario — it's their #1 problem — but present it as "one incident type; the adapter is the same for the rest."

## 6. Productization roadmap (honest, land-and-expand)
- **Now (MVP):** synthetic, deterministic, end-to-end. Proves the reasoning + outputs.
- **Pilot (8–12 wks, paid):** one adapter (their fault + PM feed, one region), real data behind the same reasoning, NCC pack + exposure validated against a real past incident. Success metric: pack turnaround, exposure accuracy, early-warning lead time.
- **Product (post-pilot):** multi-region, more adapters, push to ServiceNow + NCC portal, revenue-assurance/fraud expansion.

## Integration effort ladder — answering Ebuka's #1 question
Message: **you don't integrate us into your systems; we subscribe to signals you already emit.** Because it's an event-driven listener, integration is a tap, not a transplant.

| Rung | What connects | MTN's lift |
|---|---|---|
| 0 · Replay | an exported file of one past major incident — zero live access | hand us one export |
| 1 · Read-only feed (pilot) | one region's alarm + KPI stream (Kafka / webhook / export) + static inventory & subscriber export | grant read access to one feed |
| 2 · Productionized | TM Forum Open APIs (TMF642/639/628), multi-region, push to ServiceNow + NCC portal | standard connector config |

We write the adapter; you never modify your systems. Start on a file, prove it, then connect a live read-only feed. **We adapt to your data — you don't adapt to us.**

## 7. What we need from MTN for the pilot (the "yes" list, low-commitment)
- A read-only feed (Kafka topic or export) of alarms + KPIs for one region.
- Inventory mapping (site → LGA) and subscriber/ARPU context (can start anonymized/aggregated).
- One past major incident to replay and validate against.
- An NDA + a named technical point of contact (Ebuka's team).
