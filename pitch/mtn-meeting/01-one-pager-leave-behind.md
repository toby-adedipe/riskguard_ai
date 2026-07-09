# RiskGuard AI
### Incident-to-Compliance autopilot for telecom operations

**The problem MTN faces now.** Nigeria recorded 9,000+ fibre cuts in 2025 and 100+ major outages a month. Under the NCC's new major-outage regime, every qualifying incident must be reported through the Uptime portal, and — since November 2025 — carries a **quantifiable consumer-compensation liability** tied to affected subscribers and ARPU. Detection, evidence assembly, and exposure calculation are largely manual and reactive.

**What RiskGuard does.** It sits on top of your existing monitoring and, for any incident, automatically:
- **Detects & classifies** it against NCC major-outage thresholds (≥5% subscribers / ≥5 LGAs / site-count) with an early time-to-breach warning.
- **Quantifies exposure** — affected subscribers, enterprise lines, revenue at risk, and NCC compensation liability, in real time.
- **Recommends mitigation** — simulates do-nothing vs. reroute/failover, ranked by cost and impact, with mandatory human approval.
- **Files** — assembles a regulator-ready NCC evidence pack and a consumer-notification draft, backed by an append-only audit trail.

**How it connects — designed to sit on top, not replace.** RiskGuard consumes a normalized event stream and reads inventory/subscriber context; it does not touch network elements.
- Ingests from fault/performance systems (e.g. Netcool, NCE, NetAct, ENIQ) via **TM Forum Open APIs** (TMF642/639/628) or a Kafka feed — read-only.
- Emits to an ops dashboard, a ServiceNow work order, and the NCC portal / evidence pack.
- Built on Azure OpenAI + Semantic Kernel — aligned with MTN's cloud stack.

**Grounded, agentic reasoning.** Five role agents — Network, Impact, Mitigation, Compliance, Investigation — work as a 24/7 virtual ops-and-compliance team. A claim validator ensures **every number in an answer traces back to a system of record** — no hallucinated figures reach an operator or a regulatory filing.

**Current maturity — stated plainly.** RiskGuard is a working, end-to-end vertical slice on synthetic data — a **top-4 winner at the AI4Telco Hackathon** (Microsoft AI Skills Week Lagos, with MTN Foundation as telecom partner). The pilot is where we prove it on MTN telemetry.

**Proposed collaboration.**
1. **Paid proof-of-value pilot** — 8–12 weeks, one region and one incident type (fibre-cut), one agreed success metric. Read-only feed, one past incident to replay, NDA.
2. **MTN Cloud Accelerator** — run in parallel for GTM support and API access.
3. **Design partnership** — harden the model against real (anonymized-first) incident data.

**The ask.** A scoped paid pilot on fibre-cut incidents in one region. We'll send a one-page pilot outline with a success metric and timeline within 48 hours of our call.

---
_Team Sentinel · RiskGuard AI · [contact email] · [website]_
