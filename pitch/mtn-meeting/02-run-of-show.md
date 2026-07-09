# Meeting run-of-show + objection cheat-sheet

_Exploratory call with MTN (60 min). Objective: leave with a defined, paid next step — not a signature._

## Before the call
- [x] Reply to Zee within 24h, confirm slot, signal we'll bring 3 collaboration pathways.
- [ ] Reconcile demo numbers (use one set everywhere: 18,420 subs / ₦8.7m at risk / ₦2.1m compensation).
- [ ] **Recall what Ebuka asked/critiqued as a judge — that's his real concern list. Pre-empt each point in the demo/architecture section.**
- [ ] Rehearse the 4-beat productized demo (see 03-product-and-demo.md §5). Time it: ≤8 min. Ebuka has seen the hackathon demo — show the *productized* version, don't replay.
- [ ] Bring the one-pager (01) ready to forward. Have entity/roadmap/ask crisp.
- [ ] Assign roles (below).

## Who attends & who leads
- **Business lead (you):** opens, runs discovery, frames pathways, closes. Talks to Chinyelu (money) and Zee.
- **Architecture lead (Eng 2 or 4):** answers integration, data contract, agent design. Talks to Ebuka.
- Two people max. Not four engineers all talking Semantic Kernel.
- **Ebuka judged us and ranked us top-4 → treat him as a co-owner, not a gatekeeper.** Acknowledge it, thank him, and invite him to help shape the pilot data interface. He wins internally if we win.

## Agenda (60 min)
1. **0–5 — warm open.** Thank them; thank Ebuka for judging and the panel for the top-4 recognition; one line on why the timing is real (NCC regime + outage numbers).
2. **5–20 — discovery (ask, don't pitch).** Questions below. Take notes; mirror their language back in the demo.
3. **20–33 — demo.** The 4 beats. End on exposure number + NCC pack.
4. **33–45 — architecture & fit.** Where we sit vs the NOC; read-only ingestion; TM Forum APIs; what we'd need for a pilot.
5. **45–55 — the 3 pathways.** Lead with the paid pilot; accelerator + design-partner in parallel.
6. **55–60 — close.** Agree the next step + owner + date.

## Discovery questions (ask these first)
1. How do you detect today that an incident has crossed the NCC "major outage" threshold?
2. Who assembles the NCC evidence pack, and how long does it take?
3. How are you calculating consumer-compensation exposure under the new QoS regime?
4. When an incident hits, how do ops and compliance coordinate — one system or several?
5. What would have to be true for something like this to run in your environment?
6. Is this a compliance-office problem, a NOC problem, or both — and who owns the budget?
7. (To Ebuka) When you judged us, what did you most want to see proven before this could run at MTN? — turns his judge role into our pilot roadmap.

## Objection cheat-sheet
| They say | We say |
|---|---|
| "It's on synthetic data — does it work on our network?" | "Correct, and we won't pretend otherwise. It's a working end-to-end slice on synthetic data. Proving it on your telemetry is exactly the paid pilot." |
| "We could build this internally." | "You'll build the deep monitoring. We're the compliance-and-exposure layer above it — the part you don't want to hand-assemble for 64 incidents a month. Live in weeks, not a roadmap quarter." |
| "How hard is it to integrate?" (Ebuka's #1) | "You don't integrate us into your systems — we subscribe to signals you already emit. We can even start on a file of one past incident, zero live access. See the integration ladder below." |
| "What's the ROI?" (Chinyelu) | "Every major outage is now a quantifiable compensation liability. Cut pack turnaround and triage by exposure and the pilot pays for itself on one well-managed major incident." |
| "You're a small team." | "We're the team your own panel ranked top-4 for solving your #1 operational problem — in a weekend. The accelerator and a design-partner arrangement are how we scale that safely, together." |
| "Let's just put you in the accelerator." | "We'd love the accelerator in parallel — and the fastest way to create real value is a scoped paid pilot alongside it, so we're proving on your data from day one." |

## Ebuka's #1 question: "how hard is integration?" (his judging question — lead with the answer)
Frame it: **you don't integrate us into your systems — we subscribe to signals you already emit.** Then walk the ladder:
- **Rung 0 — replay, zero integration:** run on an exported file of one past major incident. Proves value in week 1 with no access to live systems.
- **Rung 1 — read-only feed (the pilot):** one region's alarm + KPI stream (Kafka topic / webhook / periodic export) + a static inventory & subscriber export. No writes, no OSS/BSS changes, no touching network elements.
- **Rung 2 — productionized (post-pilot):** TM Forum Open API connectors (TMF642/639/628), multi-region, push outputs to ServiceNow + the NCC portal.

Ownership: **we write the adapter; your only lift is read access to one feed + one historical incident. We adapt to your data — you don't adapt to us.** An autonomous listener is a tap, not a transplant — which is exactly why it's cheap to integrate.

## The close (say this)
> "If this resonates, the concrete next step we'd propose is a scoped paid pilot on fibre-cut incidents in one region. We'll send a one-page pilot outline with a success metric and timeline within 48 hours. We'd love Ebuka's input on the data interface and Chinyelu's read on whether the accelerator should run in parallel."

Then get: the next step, an owner on their side, and a date.

## Follow-up email (send within 48h)
> Subject: RiskGuard AI × MTN — pilot outline + next step
>
> Hi Zee (cc Ebuka, Chinyelu, Aanu),
> Thank you all for the time today. As discussed, RiskGuard turns a major network incident into a regulator-ready NCC pack and a live compensation-exposure figure, sitting on top of your existing monitoring.
> Attached is a one-page pilot outline: an 8–12 week paid proof-of-value on fibre-cut incidents in one region, with [agreed success metric] and a read-only data interface. We've also noted where the MTN Cloud Accelerator could run in parallel.
> Could we agree a next step by [date]? Happy to walk Ebuka's team through the data contract whenever suits.

## Do-not-say (guardrails)
- Don't promise integration timelines, security posture, or ROI beyond evidence.
- Don't imply the MVP already runs on live MTN data.
- Don't present as students hoping to be adopted — present as a company with a roadmap and an ask.
