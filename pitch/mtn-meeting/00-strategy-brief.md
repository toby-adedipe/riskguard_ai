# RiskGuard AI × MTN Nigeria — strategy brief

_Internal. Prepared for the exploratory call (week of 14 July 2026). Goal: land a paid pilot._

## The opportunity in one line
Warm inbound from MTN. They put a senior **technical architect** and a **CEO-office strategy head** on the thread and asked us to propose the shape of collaboration. We were a **top-4 winner** at their own foundation's hackathon, and one of the judges — Ebuka — is in the room. Our product happens to sit on top of MTN's single most painful 2025–26 problem. Don't fumble it by under-selling (getting absorbed cheap) or over-selling (promising a production system we don't have).

> Confirm internally before use: (a) that we were officially top-4, and (b) Ebuka's exact judging role. Both are our own facts — get them exactly right.

## Who is in the room
- **Zeinab "Zee" Maduagwu (MTN)** — champion / coordinator. Owns the relationship, decides whether it keeps moving. Give her something clean to forward.
- **Chukwuebuka "Ebuka" Ezewuzie — Senior Manager, Growth & New Business Platforms (IT).** Enterprise Architect (ex-integration/design lead, ex-UN Foundation). **He was a judge at the hackathon** — he has already seen the demo, scored it, and ranked us top-4. That makes him a warm champion with reputational skin in the game, not a cold skeptic; his success case is our success. Don't re-pitch the concept to him — go straight to "here's how it becomes something you can run." His real question is integration feasibility (data contract, where we sit vs the NOC), not "is the idea good." **Mine his judging feedback** — whatever he probed or doubted as a judge is your exact prep list. Give him ammunition to keep vouching internally; never over-claim in a way that could later embarrass him.
- **Chinyelu Chikwendu (FCCA) — Head, Strategy & Innovation, CEO's Office.** Chartered accountant, ex-Vatebra Tech Hub. Directly involved in the **MTN Cloud Accelerator**. The commercial sponsor and bridge to money. Speak quantified liability and revenue protection.
- **aanu@datasciencenigeria.ai (Data Science Nigeria)** — ally / facilitator; DSN ran the AI4Telco hackathon. Credibility multiplier. Keep looped.

## Why we're unusually well-timed (our leverage)
- MTN's CEO disclosed **9,218 fibre cuts in 2025**; fibre cuts are >50% of all Nigerian outages. Our canonical demo (Ikeja backbone fibre cut) is literally their #1 problem.
- **MTN accounted for 64 of the industry's 118 outages in December 2025** — the most of any operator.
- **NCC now mandates major-outage reporting** (Uptime portal). "Major outage" = ≥5% of subscribers or ≥5 LGAs, or ≥100 sites / 5% of sites for ≥30 min. That threshold model maps directly onto our LGA-level detection + time-to-breach.
- **From Nov 2025 the NCC enforces consumer compensation** for QoS breaches (airtime credits from subscriber ARPU per affected LGA). Every major outage is now a **quantifiable liability** — exactly what our "revenue-at-risk / compensation-exposure" numbers model.

## The wedge (what to push)
**NCC major-outage compliance + compensation-exposure automation** — a decision-support and evidence layer that sits *on top of* existing telemetry and, for any qualifying incident: classifies it against NCC thresholds, auto-assembles the NCC evidence pack + consumer notice, and computes live compensation exposure so ops prioritise the incidents that cost the most.

Why this wins the room: tied to a mandatory regime (must-do budget), quantifies money (Chinyelu's language), sits on top of the NOC rather than replacing it (low integration risk, Ebuka can say yes), and it's the part of our MVP that's most real already.

Roadmap framing (mention as future, not the ask): (A) predictive NOC copilot — phase 2; (C) fibre-cut/vandalism prediction — phase 3 once we have a data partnership. Story: _start where the pain is mandatory and provable, then expand into prediction as we earn access to your data._

**What they're buying (positioning):** an *autonomous risk-and-compliance operator* — not an agent platform, not a risk dashboard. The wedge is autonomy: no one prompts it; it listens to signals the network already emits and concludes on its own. Risk/compliance = the value & budget (Chinyelu); agentic autonomy = the differentiator (Ebuka, a platforms architect who could see the event-driven pattern reused across MTN). One-liner: _"It works while your NOC sleeps — listens to your signals, decides when something is becoming a reportable, costly incident, and hands your team the conclusion, the exposure, and the fix before anyone thought to ask."_ The autonomy is also the integration answer: a listener is a tap, not a transplant.

## Product & integration architecture (see 03-product-and-demo.md + diagram)
Our architecture already does the one thing that makes productization easy: `SignalEvent` is a canonical normalized record and the synthetic generator is swappable. The product is three planes:
1. **Ingestion / adapter plane (new, thin):** connectors that turn MTN feeds into our `SignalEvent` stream. Read-only.
2. **Reasoning plane (exists):** risk engine + agentic copilot + claim validator. Unchanged whether data is synthetic or real.
3. **Output / action plane (exists + extend):** NCC pack, exposure, recommendations → dashboard, ServiceNow ticket, NCC Uptime portal.

Pilot integration contract: **consume a Kafka topic (or near-real-time export) of alarms + KPIs, plus read-only inventory + subscriber context; emit structured outputs. Never touch network elements.** That's a yes Ebuka can give.

### What MTN runs (say these words)
- Fault/alarms (OSS): IBM Netcool/OMNIbus, Huawei NCE, Nokia NetAct, Ericsson OSS.
- Performance KPIs (OSS): Ericsson ENIQ, Nokia NetAct, Huawei PRS.
- Inventory/topology (OSS): Netcracker, Amdocs, GE Granite → site→LGA→cluster.
- Ticketing/field dispatch: BMC Remedy, ServiceNow → where our recommendation becomes a work order.
- BSS billing/charging/CRM: Amdocs, Ericsson/MATRIXX, Huawei CBS; Salesforce → subscribers, enterprise lines, ARPU for compensation.
- Revenue assurance/fraud: Subex, Mobileum, WeDo → adjacency for our Revenue agent.
- Probes/QoE: NETSCOUT, EXFO, Infovista.
- **The glue: TM Forum Open APIs** (TMF642 alarms, TMF639 inventory, TMF628 performance), SID/eTOM/ODA. Saying "TM Forum Open APIs" instantly de-risks us with Ebuka.
- Cloud/data: MTN is on cloud + Azure analytics; our copilot is Azure OpenAI + Semantic Kernel — we're already stack-aligned (the hackathon was Microsoft-run). Call it out.

## Commercial (maximize upside → paid pilot)
Bring three pathways (they asked for them):
1. **Paid proof-of-value pilot (primary ask).** 8–12 weeks, one region + one incident type (fibre-cut), agreed success metric, paid. Revenue + logo + a real dataset.
2. **MTN Cloud Accelerator (parallel, Chinyelu's program).** ₦100M non-dilutive, no equity, GTM support, API access. Position for next cohort; let her champion it.
3. **Design-partner / data arrangement (Ebuka's lane).** Harden RiskGuard on anonymized/synthetic-first MTN data under NDA. Low-commitment yes that enables 1 and 2.

Protect upside: show up as a company (entity, roadmap, clear ask), not a hackathon team. Don't let it collapse into "just do the free accelerator."

## Guardrails (protect credibility)
Synthetic + deterministic MVP; do not promise integration timelines, security posture, or ROI beyond evidence. Under-promising earns the pilot. Reconcile the numbers before the call: MVP demo uses 18,420 subscribers / ₦8.7m at risk; the compliance doc lists 145,800 for Ikeja. Pick one set, keep it consistent.

## Opportunity score
Pain 5/5 · Budget/owner 4/5 · Urgency 4/5 · Fit 4/5 (wedge) · Trust/proof 3/5 → ~20/25. Real. Move fast, stay narrow.

## Sources
- MTN 9,218 fibre cuts 2025 — Punch, BusinessDay
- MTN 64 of 118 Dec 2025 outages — Technext
- NCC major-outage mandate + thresholds — NCC press release
- NCC consumer compensation (Nov 2025 enforcement) — BusinessDay, Leadership
- MTN Cloud Accelerator (₦100M, non-dilutive) — mtnaccelerate.com, Technext
- People — RocketReach, ZoomInfo, LinkedIn, The Org
