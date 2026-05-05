# RiskGuard AI — AI4Telco Hackathon Speaker Script

**Pitch length:** ~8 minutes  ·  **Slides:** 12  ·  **Deck:** `AI4Telco_RiskGuardAI.pptx`

Read each block out loud. Time targets are guides, not gates. Numbers in **bold** are load-bearing — say them clearly. The transition cue is what cues the next click.

---

## Slide 1 — Title  ·  ~25s

**On screen:** "RiskGuard AI — the agentic AI risk officer." Detects · Predicts · Mitigates · Reports to NCC.

> Good [morning / afternoon] judges. We're Team RiskGuard.
> The MTN Nigeria challenge asks: *can AI proactively detect operational risk and enhance compliance across siloed telecom data?*
> Our answer is **RiskGuard AI** — an agentic AI risk officer, built on Microsoft Azure OpenAI and Semantic Kernel, that watches every signal across the network, billing, and customer channels, and acts before the outage.
> Let me show you the problem we're solving — and the working product we built this week.

**Cue:** "the working product we built this week" → click.

---

## Slide 2 — The Challenge  ·  ~45s

**On screen:** MTN problem statement quote (left). Four silos: Network & BTS · Billing & Revenue · Customer Channels · Devices & Sales. Bottom strip: service disruption · revenue leakage · churn · NCC penalties.

> This is the problem in MTN's own words. Operators are sitting on rich telemetry — but it lives in **four siloed worlds**: the network team watches BTS health, the revenue team watches recharge and billing, the contact centre watches complaints, the sales team watches devices and SIM swaps.
> No single human, and no current dashboard, fuses all four in real time.
> So risks slip through. And when they do, the operator pays four times: lost service, leaked revenue, churned customers, and NCC penalties.

**Cue:** "pays four times" → click.

---

## Slide 3 — What It Costs  ·  ~35s

**On screen:** **47 min** delay  ·  **NGN-bn** in NCC penalties  ·  **1 in 3** subscribers will switch.

> The cost is measurable. Industry-reported numbers: operators lose roughly **47 minutes** between the first weak signal and a confirmed incident. NCC has issued **billions of naira** in QoS-related penalties to Nigerian telcos in recent years. And **one in three** Nigerian subscribers names poor service as their number-one reason to switch network.
> The hard truth: today's tools are dashboards. Dashboards wait to be looked at. Risk doesn't.

**Cue:** "Risk doesn't." → click.

---

## Slide 4 — Introducing RiskGuard AI  ·  ~50s

**On screen:** "Not a dashboard. An always-on agent that reads, predicts, recommends, and files the NCC report — with a human always in the loop." Four steps: Sense · Reason · Recommend · Report.

> So we built something different. **Not a dashboard. An agent.**
> RiskGuard AI is an always-on AI risk officer. It does four things, continuously.
> **One — Sense.** It ingests seven signal domains in real time: network, BTS, billing, recharge, sales, complaints, devices.
> **Two — Reason.** Agentic LLMs reason over that data using grounded tools — never raw CSVs, never free-form guesses.
> **Three — Recommend.** It compares mitigation options against the do-nothing baseline, and ranks them.
> **Four — Report.** And when the operator approves an action, it auto-assembles the regulatory pack the NCC asks for.
> Crucially — a human is always in the loop. RiskGuard recommends. The operator approves. That's the only path.

**Cue:** "That's the only path." → click.

---

## Slide 5 — Architecture  ·  ~35s

**On screen:** 4 stacked layers. Bottom badge: "Built on Microsoft Azure OpenAI · Semantic Kernel · FastAPI · React."

> Architecturally, four layers, one Microsoft AI stack.
> Signals come in. The risk engine computes a per-LGA score, time-to-breach, and an impact model. The agentic copilot — five role agents running on **Semantic Kernel and Azure OpenAI** — reasons over the engine's output. And the operator console gives the human everything they need to act.
> We deliberately built this on the host's stack. Microsoft AI is our foundation.

**Cue:** "is our foundation." → click.

---

## Slide 6 — Live Demo Story  ·  ~75s

**On screen:** 5-step Ikeja timeline + risk score line chart climbing 22 → 87 then dropping → 42.

> Let me show you the demo. Lagos. Ikeja LGA.
> **Time zero** — baseline. Every LGA is green.
> **Fifteen seconds in** — we trigger an Ikeja incident. BTS deviation, plus a complaint spike. Two siloed signals.
> **Thirty seconds** — the engine fuses them, and Ikeja's risk score climbs to **87**. The agent tells the operator: **47 minutes** to SLA breach, **18,420** subscribers exposed, **NGN 8.7 million** in revenue at risk.
> **One minute** — the operator reviews three mitigation options the Mitigation Agent has already simulated. They approve the traffic reroute. The action is logged in the audit trail.
> **One minute thirty** — the recovery model takes over. Risk drops to **42**. The NCC compliance pack is ready before the operator even asks for it.
> Ninety seconds. Green to recovered. With a human always in the loop.

**Cue:** "With a human always in the loop." → click.

---

## Slide 7 — The Agentic Copilot  ·  ~45s

**On screen:** 5 agents — Network · Revenue · Customer · Mitigation · Compliance. Bottom strap: every claim traces to a tool call.

> Behind that demo are five specialist agents.
> The **Network Agent** localizes the fault and pulls BTS evidence. The **Revenue Agent** spots leakage in recharge and billing. The **Customer Agent** reads complaints and projects churn. The **Mitigation Agent** simulates options and ranks them. The **Compliance Agent** drafts NCC notes and assembles the evidence pack.
> Here's what makes them real, not theatrical: **every claim — every KPI, every naira figure, every subscriber count — must trace to a tool call.** Our ClaimValidator strips anything else out before it reaches the operator. No hallucinated numbers. Ever.

**Cue:** "No hallucinated numbers. Ever." → click.

---

## Slide 8 — Trust by Design  ·  ~35s

**On screen:** Four pillars — Grounded answers · Human-in-the-loop · Append-only audit · Regulator-ready output. Strap: "Autonomous enough to be useful. Constrained enough to be deployed."

> Telcos can't deploy AI they can't trust. So trust isn't a feature — it's the design.
> Agents only speak from tool results. No mitigation runs without operator approval. The audit log is append-only — who, when, why, expected and actual impact. And every report is in the format NCC already accepts.
> **Autonomous enough to be useful. Constrained enough to be deployed.**

**Cue:** "Constrained enough to be deployed." → click.

---

## Slide 9 — Business Impact  ·  ~40s

**On screen:** 47 min · NGN 8.7m · NGN 2.1m · 10 sec. Comparison chart below.

> What does that mean per incident?
> **47 minutes** earlier detection versus dashboards. **NGN 8.7 million** in revenue at risk surfaced before it leaks. **NGN 2.1 million** in subscriber compensation avoided. And the NCC compliance pack assembles in **10 seconds** instead of three days.
> One Ikeja-class incident, prevented or compressed, pays for the platform many times over.

**Cue:** "pays for the platform many times over." → click.

---

## Slide 10 — Why We Win  ·  ~45s

**On screen:** Three columns — Legacy NMS · Generic LLM chat · RiskGuard AI (highlighted).

> So why isn't this just another monitoring tool, or another LLM chatbot?
> **Legacy network monitoring** sees one domain, with static thresholds. No mitigation guidance. Manual NCC reporting.
> **Generic LLM chat** hallucinates KPIs, has no live data tools, no audit trail — not safe for a regulated telco.
> **RiskGuard AI** fuses seven signal domains, predicts breach **47 minutes** ahead, recommends and simulates the fix, and auto-files the NCC pack.
> A new category. And we built it on the host's stack: Microsoft Azure OpenAI plus Semantic Kernel.

**Cue:** "Azure OpenAI plus Semantic Kernel." → click.

---

## Slide 11 — Roadmap  ·  ~40s

**On screen:** Now · 90 days · 12 months · 24 months. Business model strap.

> Our path from this hackathon to a West African telco standard.
> **Now** — the vertical slice is live. Real risk engine, real agentic copilot, real NCC pack. End-to-end.
> **90 days** — we want a pilot with one MNO. Read-only data, one Lagos region, measure the detection lift.
> **12 months** — multi-LGA SaaS across all of Lagos, plus fraud and SIM-swap agents.
> **24 months** — a regional platform for tier-2 and tier-3 operators across West Africa.
> Business model: SaaS license per operator, plus a per-incident NCC compliance fee. Avoiding **one** hundred-million-naira penalty pays for the year.

**Cue:** "pays for the year." → click.

---

## Slide 12 — Team & Ask  ·  ~30s

**On screen:** RiskGuard AI · Detect · Mitigate · Prove. Team — Favour · Ladipo · Marvelous · Tobi. Ask bar.

> We're four engineers — Favour on the data and risk engine, Ladipo on the API and compliance layer, Marvelous on the operator dashboard, and Tobi on the agentic copilot.
> Our ask is simple: **the win, a pilot conversation with MTN, and the runway to ship this to production.**
> Detect risk earlier. Mitigate it faster. Prove it to the regulator.
> Thank you.

**Cue:** Pause. Open the floor for Q&A.

---

## Total time: ~8 min  ·  Cushion for pauses & emphasis: ~30s  ·  Hard ceiling: 9 min

### Practical tips for delivery
- **Slides 6 (demo) is the centerpiece.** Slow down. Let the chart climb and fall do the storytelling.
- **Numbers are sticky** — repeat 87 → 42, 47 minutes, NGN 8.7m. Judges remember three numbers, not thirty.
- **Microsoft, MTN, NCC** — say each by name once per slide where they belong. Sponsors notice.
- **Don't read bullets verbatim.** The slides are scaffolding; the script is the performance.
- **If you have a working app on screen** — switch to it after slide 6 for 60 seconds, then come back to slide 7. The script still works.

### Q&A — likely judge questions and short answers
- *Where does the data come from in production?* Operator's existing data lake — read-only connectors per source. We never touch raw PII.
- *How do you stop hallucinated mitigations?* The Mitigation Agent must call the playbook tool *and* the simulation tool before it can recommend. The ClaimValidator drops any unsupported claim.
- *Is the recovery model real or scripted?* The demo path is calibrated for reproducibility. The recovery model itself is real and runs the same way against any incident the engine writes.
- *Why Semantic Kernel and not LangChain?* Semantic Kernel's plugin/function-calling model maps cleanly to our tool surface, runs first-class on Azure OpenAI, and gives us the structured output discipline we need for ClaimValidator.
- *How do you measure success?* Time-to-detection lift, NCC pack assembly time, and revenue-at-risk surfaced per incident — measured against the operator's own historical baseline during pilot.
