// RiskGuard AI — AI4Telco Hackathon Pitch Deck
// Builds AI4Telco_RiskGuardAI.pptx

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const md = require("react-icons/md");
const hi = require("react-icons/hi");

// ---------- Palette (Microsoft Elevate brand system) ----------
const C = {
  navy:    "2A446F",   // Elevate Dark Blue — primary
  navy2:   "35517E",   // derived shade
  blue:    "0078D4",   // Elevate Blue — accent
  blueDk:  "1F5A9C",
  red:     "FF9176",   // Elevate Peach — warning / risk
  green:   "0078D4",   // collapse "good" into Blue for brand fidelity
  gold:    "FFBBA8",   // Elevate Light Peach — accent / surface
  lightBlue:"8DC8E8",  // Elevate Light Blue — supporting
  white:   "FFFFFF",
  paper:   "FFF8F3",   // Elevate Warm White — background
  ink:     "2A446F",
  muted:   "6B7E9B",
  line:    "EAD9C9",
};
const FONT_HEAD = "Segoe UI";
const FONT_BODY = "Segoe UI";
const FONT_CODE = "Consolas";

// ---------- Icon helper ----------
async function icon(IconComponent, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// ---------- Layout primitives ----------
function pageHeader(slide, kicker, title) {
  // small kicker bar
  slide.addShape("rect", { x: 0.5, y: 0.45, w: 0.18, h: 0.32, fill: { color: C.blue }, line: { color: C.blue } });
  slide.addText(kicker, {
    x: 0.78, y: 0.42, w: 8.7, h: 0.36,
    fontFace: "Segoe UI", fontSize: 11, bold: true, color: C.blue, charSpacing: 4, margin: 0,
  });
  slide.addText(title, {
    x: 0.5, y: 0.85, w: 9.5, h: 0.6,
    fontFace: "Segoe UI", fontSize: 26, bold: true, color: C.navy, margin: 0,
  });
  slide.addShape("line", {
    x: 0.5, y: 1.55, w: 9.0, h: 0,
    line: { color: C.line, width: 0.75 },
  });
}

function footer(slide, pageNo) {
  slide.addText("RiskGuard AI  ·  AI4Telco Hackathon  ·  AI Skills Week Lagos 2026", {
    x: 0.5, y: 5.30, w: 7.5, h: 0.25,
    fontFace: "Segoe UI", fontSize: 9, color: C.muted, margin: 0,
  });
  slide.addText(String(pageNo).padStart(2, "0"), {
    x: 9.0, y: 5.30, w: 0.5, h: 0.25,
    fontFace: "Segoe UI", fontSize: 9, color: C.muted, align: "right", margin: 0,
  });
}

// ---------- Speaker notes ----------
const NOTES = {
  1: `Good morning judges. We're Team RiskGuard.\n\nThe MTN Nigeria challenge asks: can AI proactively detect operational risk and enhance compliance across siloed telecom data?\n\nOur answer is RiskGuard AI — an agentic AI risk officer, built on Microsoft Azure OpenAI and Semantic Kernel, that watches every signal across the network, billing, and customer channels, and acts before the outage.\n\nLet me show you the problem we're solving — and the working product we built this week.`,
  2: `This is the problem in MTN's own words. Operators sit on rich telemetry, but it lives in four siloed worlds: the network team watches BTS health, the revenue team watches recharge and billing, the contact centre watches complaints, and the sales team watches devices and SIM swaps.\n\nNo single human, and no current dashboard, fuses all four in real time.\n\nSo risks slip through. And when they do, the operator pays four times: lost service, leaked revenue, churned customers, and NCC penalties.`,
  3: `The cost is measurable. Industry-reported numbers: operators lose roughly 47 minutes between the first weak signal and a confirmed incident. NCC has issued billions of naira in QoS-related penalties to Nigerian telcos in recent years. And one in three Nigerian subscribers names poor service as their number-one reason to switch network.\n\nThe hard truth: today's tools are dashboards. Dashboards wait to be looked at. Risk doesn't.`,
  4: `So we built something different. Not a dashboard. An agent.\n\nRiskGuard AI is an always-on AI risk officer. It does four things, continuously.\n\nOne — Sense. It ingests seven signal domains in real time: network, BTS, billing, recharge, sales, complaints, devices.\n\nTwo — Reason. Agentic LLMs reason over that data using grounded tools — never raw CSVs, never free-form guesses.\n\nThree — Recommend. It compares mitigation options against the do-nothing baseline, and ranks them.\n\nFour — Report. And when the operator approves an action, it auto-assembles the regulatory pack the NCC asks for.\n\nCrucially, a human is always in the loop. RiskGuard recommends. The operator approves. That's the only path.`,
  5: `Architecturally, four layers, one Microsoft AI stack.\n\nSignals come in. The risk engine computes a per-LGA score, time-to-breach, and an impact model. The agentic copilot — five role agents running on Semantic Kernel and Azure OpenAI — reasons over the engine's output. And the operator console gives the human everything they need to act.\n\nWe deliberately built this on the host's stack. Microsoft AI is our foundation.`,
  6: `Let me show you the demo. Lagos. Ikeja LGA.\n\nTime zero — baseline. Every LGA is green.\n\nFifteen seconds in — we trigger an Ikeja incident. BTS deviation, plus a complaint spike. Two siloed signals.\n\nThirty seconds — the engine fuses them, and Ikeja's risk score climbs to 87. The agent tells the operator: 47 minutes to SLA breach, 18,420 subscribers exposed, 8.7 million naira in revenue at risk.\n\nOne minute — the operator reviews three mitigation options the Mitigation Agent has already simulated. They approve the traffic reroute. The action is logged in the audit trail.\n\nOne minute thirty — the recovery model takes over. Risk drops to 42. The NCC compliance pack is ready before the operator even asks for it.\n\nNinety seconds. Green to recovered. With a human always in the loop.`,
  7: `Behind that demo are five specialist agents.\n\nThe Network Agent localizes the fault and pulls BTS evidence. The Revenue Agent spots leakage in recharge and billing. The Customer Agent reads complaints and projects churn. The Mitigation Agent simulates options and ranks them. The Compliance Agent drafts NCC notes and assembles the evidence pack.\n\nHere's what makes them real, not theatrical: every claim — every KPI, every naira figure, every subscriber count — must trace to a tool call. Our ClaimValidator strips anything else out before it reaches the operator. No hallucinated numbers. Ever.`,
  8: `Three layers, not two.\n\nThe agent itself is just an LLM with a personality. It can't read a database. It can't call a vendor API. The only thing it can do is invoke a tool: a typed Semantic Kernel function with a defined input and output shape.\n\nThat contract is the seam. The agent codes against the contract; the contract doesn't change. Behind it sits a thin adapter, a small piece of code that translates a call like get_signal_evidence into whatever the operator actually runs. A Kafka topic. A SQL view. An Ericsson NMS REST call. A Salesforce SOQL query.\n\nMoving from MTN to Airtel doesn't mean rewriting the agents or touching the prompts. We swap one adapter file. The contract holds.\n\nIt's the ports-and-adapters idea, but for LLM agents. The reasoning side is decoupled from the data side, so we get to keep the agents and the operators get to keep their stacks.`,
  9: `Telcos can't deploy AI they can't trust. So trust isn't a feature — it's the design.\n\nAgents only speak from tool results. No mitigation runs without operator approval. The audit log is append-only — who, when, why, expected and actual impact. And every report is in the format NCC already accepts.\n\nAutonomous enough to be useful. Constrained enough to be deployed.`,
  10: `What does that mean per incident?\n\n47 minutes earlier detection versus dashboards. 8.7 million naira in revenue at risk surfaced before it leaks. 2.1 million naira in subscriber compensation avoided. And the NCC compliance pack assembles in 10 seconds instead of three days.\n\nOne Ikeja-class incident, prevented or compressed, pays for the platform many times over.`,
  11: `So why isn't this just another monitoring tool, or another LLM chatbot?\n\nLegacy network monitoring sees one domain, with static thresholds. No mitigation guidance. Manual NCC reporting.\n\nGeneric LLM chat hallucinates KPIs, has no live data tools, no audit trail — not safe for a regulated telco.\n\nRiskGuard AI fuses seven signal domains, predicts breach 47 minutes ahead, recommends and simulates the fix, and auto-files the NCC pack.\n\nA new category. And we built it on the host's stack: Microsoft Azure OpenAI plus Semantic Kernel.`,
  12: `Our path from this hackathon to a West African telco standard.\n\nNow — the vertical slice is live. Real risk engine, real agentic copilot, real NCC pack. End-to-end.\n\n90 days — we want a pilot with one MNO. Read-only data, one Lagos region, measure the detection lift.\n\n12 months — multi-LGA SaaS across all of Lagos, plus fraud and SIM-swap agents.\n\n24 months — a regional platform for tier-2 and tier-3 operators across West Africa.\n\nBusiness model: SaaS license per operator, plus a per-incident NCC compliance fee. Avoiding one hundred-million-naira penalty pays for the year.`,
  13: `Our team. Ifunanya leads — product, strategy, and the pitch you're hearing now.\n\nOn engineering: Favour built the data and risk engine, Ladipo owns the API and compliance layer, Marvelous shipped the operator dashboard, and Tobi built the agentic copilot.\n\nOur ask is simple: the win, a pilot conversation with MTN, and the runway to ship this to production.\n\nDetect risk earlier. Mitigate it faster. Prove it to the regulator.\n\nThank you.`,
};

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "RiskGuard AI Team";
  pres.title = "RiskGuard AI — AI4Telco Hackathon";

  // Pre-render icons we'll reuse
  const ic = {
    bolt:      await icon(fa.FaBolt, "#FFFFFF"),
    shield:    await icon(fa.FaShieldAlt, "#FFFFFF"),
    network:   await icon(fa.FaNetworkWired, "#FFFFFF"),
    money:     await icon(fa.FaMoneyBillWave, "#FFFFFF"),
    users:     await icon(fa.FaUsers, "#FFFFFF"),
    gavel:     await icon(fa.FaGavel, "#FFFFFF"),
    cogs:      await icon(fa.FaCogs, "#FFFFFF"),
    brain:     await icon(fa.FaBrain, "#FFFFFF"),
    check:     await icon(fa.FaCheckCircle, "#FFFFFF"),
    cross:     await icon(fa.FaTimesCircle, "#FFFFFF"),
    file:      await icon(fa.FaFileAlt, "#FFFFFF"),
    alert:     await icon(fa.FaExclamationTriangle, "#FFFFFF"),
    chart:     await icon(fa.FaChartLine, "#FFFFFF"),
    lock:      await icon(fa.FaLock, "#FFFFFF"),
    map:       await icon(fa.FaMapMarkedAlt, "#FFFFFF"),
    robot:     await icon(fa.FaRobot, "#FFFFFF"),
    silo:      await icon(fa.FaDatabase, "#FFFFFF"),
    play:      await icon(fa.FaPlayCircle, "#FFFFFF"),
    azure:     await icon(fa.FaCloud, "#FFFFFF"),
    trophy:    await icon(fa.FaTrophy, "#FFFFFF"),
    headset:   await icon(fa.FaHeadset, "#FFFFFF"),
    rocket:    await icon(fa.FaRocket, "#FFFFFF"),
  };

  // ------------------------------------------------------------------
  // SLIDE 1 — TITLE
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addNotes(NOTES[1]);

    // accent bar
    s.addShape("rect", { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.blue }, line: { color: C.blue } });

    // kicker
    s.addText("AI4TELCO HACKATHON  ·  MTN NIGERIA CHALLENGE", {
      x: 0.6, y: 0.7, w: 8, h: 0.35,
      fontFace: "Segoe UI", fontSize: 11, bold: true, color: C.gold, charSpacing: 6, margin: 0,
    });

    // brand
    s.addText("RiskGuard AI", {
      x: 0.55, y: 1.15, w: 9, h: 1.0,
      fontFace: "Segoe UI", fontSize: 60, bold: true, color: C.white, margin: 0,
    });

    // tagline
    s.addText("The agentic AI risk officer that watches every network,\nbilling, and customer signal — and acts before the outage.", {
      x: 0.6, y: 2.3, w: 8.8, h: 1.1,
      fontFace: "Segoe UI", fontSize: 20, color: C.white, margin: 0, paraSpaceAfter: 2,
    });

    // pill row — what it does
    const pills = [
      { t: "Detects", c: C.blue },
      { t: "Predicts", c: C.gold },
      { t: "Mitigates", c: C.green },
      { t: "Reports to NCC", c: C.red },
    ];
    let px = 0.6;
    pills.forEach(p => {
      const w = 1.55;
      s.addShape("roundRect", {
        x: px, y: 3.55, w, h: 0.42,
        fill: { color: p.c }, line: { color: p.c }, rectRadius: 0.21,
      });
      s.addText(p.t, {
        x: px, y: 3.55, w, h: 0.42,
        fontFace: "Segoe UI", fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
      });
      px += w + 0.18;
    });

    // sponsor / event line
    s.addShape("line", { x: 0.55, y: 4.55, w: 9, h: 0, line: { color: C.blue, width: 0.75 } });
    s.addText("Built on Microsoft Azure OpenAI + Semantic Kernel  ·  AI Skills Week Lagos 2026", {
      x: 0.55, y: 4.7, w: 9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 12, color: C.white, margin: 0,
    });
    s.addText("Microsoft  ·  MTN Foundation Nigeria  ·  Data Science Nigeria", {
      x: 0.55, y: 5.0, w: 9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 11, italic: true, color: C.gold, margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 2 — THE PROBLEM (MTN challenge restated)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[2]);
    pageHeader(s, "THE CHALLENGE  ·  MTN NIGERIA", "Risk hides between the silos.");

    // left column — problem statement quote
    s.addShape("rect", { x: 0.5, y: 1.85, w: 0.06, h: 2.9, fill: { color: C.red }, line: { color: C.red } });
    s.addText('"Telecom operators rely on multiple, siloed data sources across network, sales, devices, and customer channels — making it difficult to identify operational risks early."', {
      x: 0.7, y: 1.85, w: 4.6, h: 1.9,
      fontFace: "Segoe UI", fontSize: 14, italic: true, color: C.ink, margin: 0, paraSpaceAfter: 4,
    });
    s.addText("— MTN Nigeria, AI4Telco problem statement", {
      x: 0.7, y: 3.85, w: 4.6, h: 0.3,
      fontFace: "Segoe UI", fontSize: 10, color: C.muted, margin: 0,
    });

    // right column — 4 silo cards
    const silos = [
      { ic: ic.network, t: "Network & BTS",     d: "Cell health, throughput, latency", color: C.blue },
      { ic: ic.money,   t: "Billing & Revenue", d: "Recharge, top-ups, leakage flags",  color: C.green },
      { ic: ic.users,   t: "Customer Channels", d: "Complaints, social, contact centre", color: C.gold },
      { ic: ic.silo,    t: "Devices & Sales",   d: "Activations, SIM swaps, IMEI",       color: C.red },
    ];
    silos.forEach((sl, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 5.55 + col * 2.05;
      const y = 1.85 + row * 1.30;
      // card
      s.addShape("rect", { x, y, w: 1.95, h: 1.18, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      // icon disc
      s.addShape("ellipse", { x: x + 0.12, y: y + 0.13, w: 0.36, h: 0.36, fill: { color: sl.color }, line: { color: sl.color } });
      s.addImage({ data: sl.ic, x: x + 0.18, y: y + 0.19, w: 0.24, h: 0.24 });
      s.addText(sl.t, { x: x + 0.55, y: y + 0.1, w: 1.35, h: 0.4, fontFace: "Segoe UI", fontSize: 12.5, bold: true, color: C.navy, margin: 0 });
      s.addText(sl.d, { x: x + 0.12, y: y + 0.55, w: 1.78, h: 0.6, fontFace: "Segoe UI", fontSize: 10.5, color: C.muted, margin: 0 });
    });

    // bottom strip — consequence
    s.addShape("rect", { x: 0.5, y: 4.6, w: 9, h: 0.5, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText("Result: service disruption  ·  revenue leakage  ·  customer churn  ·  NCC penalties", {
      x: 0.5, y: 4.6, w: 9, h: 0.5,
      fontFace: "Segoe UI", fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });

    footer(s, 2);
  }

  // ------------------------------------------------------------------
  // SLIDE 3 — THE COST
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[3]);
    pageHeader(s, "WHAT IT COSTS", "Operators learn from Twitter — not dashboards.");

    // 3 big stat cards
    const stats = [
      { big: "47 min", small: "average operator delay between first signal and confirmed incident",        color: C.red },
      { big: "NGN-bn",  small: "regulatory penalties NCC has issued operators for QoS breaches in recent years", color: C.gold },
      { big: "1 in 3", small: "Nigerian subscribers say poor service is their #1 reason to switch network",   color: C.blue },
    ];
    stats.forEach((st, i) => {
      const x = 0.55 + i * 3.05;
      s.addShape("rect", { x, y: 1.85, w: 2.85, h: 2.3, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      // accent strip top
      s.addShape("rect", { x, y: 1.85, w: 2.85, h: 0.12, fill: { color: st.color }, line: { color: st.color } });
      s.addText(st.big, {
        x: x + 0.15, y: 2.1, w: 2.55, h: 1.0,
        fontFace: "Segoe UI", fontSize: 48, bold: true, color: C.navy, align: "left", margin: 0,
      });
      s.addText(st.small, {
        x: x + 0.15, y: 3.15, w: 2.55, h: 0.95,
        fontFace: "Segoe UI", fontSize: 11, color: C.muted, margin: 0,
      });
    });

    // bottom call-out
    s.addShape("rect", { x: 0.55, y: 4.5, w: 8.95, h: 0.6, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText("Today's tools are dashboards. Dashboards wait to be looked at. Risk doesn't.", {
      x: 0.55, y: 4.5, w: 8.95, h: 0.6,
      fontFace: "Segoe UI", fontSize: 14, italic: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });

    footer(s, 3);
  }

  // ------------------------------------------------------------------
  // SLIDE 4 — THE PRODUCT
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[4]);
    pageHeader(s, "INTRODUCING", "RiskGuard AI — an AI risk officer that takes action.");

    // big positioning statement
    s.addText([
      { text: "Not a dashboard. ", options: { bold: true, color: C.red } },
      { text: "An always-on agent that ", options: { color: C.ink } },
      { text: "reads", options: { bold: true, color: C.blue } },
      { text: " every signal across network, billing, sales and customer channels, ", options: { color: C.ink } },
      { text: "predicts", options: { bold: true, color: C.blue } },
      { text: " the next breach, ", options: { color: C.ink } },
      { text: "recommends", options: { bold: true, color: C.blue } },
      { text: " a fix, and ", options: { color: C.ink } },
      { text: "files the NCC report", options: { bold: true, color: C.blue } },
      { text: " — with a human always in the loop.", options: { color: C.ink } },
    ], {
      x: 0.55, y: 1.8, w: 9, h: 1.6,
      fontFace: "Segoe UI", fontSize: 18, color: C.ink, margin: 0,
    });

    // 4-step row — what it actually does
    const steps = [
      { n: "1", t: "Sense",     d: "Ingest 7 signal domains in real time", icon: ic.network, color: C.blue },
      { n: "2", t: "Reason",    d: "Agentic LLMs reason over grounded tools", icon: ic.brain, color: C.gold },
      { n: "3", t: "Recommend", d: "Compare actions vs. do-nothing, ranked", icon: ic.cogs, color: C.green },
      { n: "4", t: "Report",    d: "Auto-assemble NCC-ready evidence pack", icon: ic.file, color: C.red },
    ];
    steps.forEach((st, i) => {
      const x = 0.55 + i * 2.27;
      s.addShape("rect", { x, y: 3.55, w: 2.07, h: 1.55, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      // big number
      s.addText(st.n, { x: x + 0.12, y: 3.6, w: 0.4, h: 0.5, fontFace: "Segoe UI", fontSize: 26, bold: true, color: st.color, margin: 0 });
      // icon
      s.addShape("ellipse", { x: x + 1.55, y: 3.62, w: 0.42, h: 0.42, fill: { color: st.color }, line: { color: st.color } });
      s.addImage({ data: st.icon, x: x + 1.61, y: 3.68, w: 0.3, h: 0.3 });
      s.addText(st.t, { x: x + 0.12, y: 4.15, w: 1.85, h: 0.35, fontFace: "Segoe UI", fontSize: 15, bold: true, color: C.navy, margin: 0 });
      s.addText(st.d, { x: x + 0.12, y: 4.5, w: 1.85, h: 0.6, fontFace: "Segoe UI", fontSize: 10.5, color: C.muted, margin: 0 });
    });

    footer(s, 4);
  }

  // ------------------------------------------------------------------
  // SLIDE 5 — HOW IT WORKS (architecture)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[5]);
    pageHeader(s, "ARCHITECTURE", "Four layers. One Microsoft AI stack.");

    // 4 horizontal layer cards stacked
    const layers = [
      { t: "1. Signal Ingest",       d: "Network, BTS, billing, recharge, sales, complaints, devices — normalized into one stream.", color: C.blue, icon: ic.network },
      { t: "2. Risk Engine",         d: "Rolling z-scores, anomaly + co-occurrence, per-LGA score, time-to-breach, impact model.",   color: C.gold, icon: ic.chart },
      { t: "3. Agentic Copilot",     d: "Semantic Kernel + Azure OpenAI. 5 role agents call grounded tools. ClaimValidator gates output.", color: C.green, icon: ic.robot },
      { t: "4. Operator Console",    d: "Live risk map · incident panel · mitigation simulator · approval flow · NCC compliance pack.", color: C.red, icon: ic.headset },
    ];
    layers.forEach((l, i) => {
      const y = 1.85 + i * 0.78;
      s.addShape("rect", { x: 0.55, y, w: 8.9, h: 0.7, fill: { color: C.white }, line: { color: C.line, width: 0.75 } });
      // left color bar
      s.addShape("rect", { x: 0.55, y, w: 0.12, h: 0.7, fill: { color: l.color }, line: { color: l.color } });
      // icon disc
      s.addShape("ellipse", { x: 0.85, y: y + 0.13, w: 0.44, h: 0.44, fill: { color: l.color }, line: { color: l.color } });
      s.addImage({ data: l.icon, x: 0.92, y: y + 0.2, w: 0.3, h: 0.3 });
      // text
      s.addText(l.t, { x: 1.45, y: y + 0.06, w: 3, h: 0.3, fontFace: "Segoe UI", fontSize: 14, bold: true, color: C.navy, margin: 0 });
      s.addText(l.d, { x: 1.45, y: y + 0.34, w: 7.9, h: 0.34, fontFace: "Segoe UI", fontSize: 11, color: C.muted, margin: 0 });
    });

    // Microsoft stack badge
    s.addShape("roundRect", { x: 0.55, y: 5.05, w: 8.9, h: 0.32, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.16 });
    s.addText("Built on Microsoft Azure OpenAI  ·  Semantic Kernel agent runtime  ·  FastAPI  ·  React", {
      x: 0.55, y: 5.05, w: 8.9, h: 0.32,
      fontFace: "Segoe UI", fontSize: 10.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 6 — LIVE DEMO STORY (Ikeja)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[6]);
    pageHeader(s, "LIVE DEMO  ·  IKEJA, LAGOS", "From green to recovered in 90 seconds.");

    // 5-step horizontal timeline with risk score curve below
    const beats = [
      { t: "00:00",  h: "Baseline",     d: "All LGAs green",                       color: C.green, icon: ic.check },
      { t: "00:15",  h: "Trigger",      d: "Ikeja BTS deviation + complaint spike", color: C.gold,  icon: ic.alert },
      { t: "00:30",  h: "Risk = 87",    d: "47 min to SLA breach · 18,420 subs",    color: C.red,   icon: ic.bolt  },
      { t: "01:00",  h: "Operator approves", d: "Reroute traffic · audit logged",   color: C.blue,  icon: ic.shield },
      { t: "01:30",  h: "Risk = 42",    d: "Recovery confirmed · NCC pack ready",   color: C.green, icon: ic.trophy },
    ];
    beats.forEach((b, i) => {
      const x = 0.55 + i * 1.81;
      // disc + icon
      s.addShape("ellipse", { x: x + 0.7, y: 1.85, w: 0.5, h: 0.5, fill: { color: b.color }, line: { color: b.color } });
      s.addImage({ data: b.icon, x: x + 0.78, y: 1.93, w: 0.34, h: 0.34 });
      // time
      s.addText(b.t, { x, y: 2.4, w: 1.7, h: 0.3, fontFace: "Segoe UI", fontSize: 11, bold: true, color: b.color, align: "center", margin: 0 });
      // title
      s.addText(b.h, { x, y: 2.7, w: 1.7, h: 0.32, fontFace: "Segoe UI", fontSize: 13, bold: true, color: C.navy, align: "center", margin: 0 });
      // desc
      s.addText(b.d, { x, y: 3.0, w: 1.7, h: 0.7, fontFace: "Segoe UI", fontSize: 10, color: C.muted, align: "center", margin: 0 });
      // connector
      if (i < beats.length - 1) {
        s.addShape("line", { x: x + 1.2, y: 2.1, w: 0.61, h: 0,
          line: { color: C.line, width: 1.5, dashType: "dash" } });
      }
    });

    // chart — risk score over time
    s.addChart(pres.charts.LINE, [{
      name: "Risk score",
      labels: ["00:00", "00:15", "00:30", "00:45", "01:00", "01:15", "01:30"],
      values: [22, 38, 87, 86, 81, 60, 42],
    }], {
      x: 0.55, y: 3.85, w: 8.9, h: 1.45,
      chartColors: [C.red],
      lineSize: 3, lineSmooth: true,
      showLegend: false,
      catAxisLabelColor: C.muted, catAxisLabelFontSize: 9,
      valAxisLabelColor: C.muted, valAxisLabelFontSize: 9,
      valAxisMinVal: 0, valAxisMaxVal: 100,
      valGridLine: { color: C.line, size: 0.5 },
      catGridLine: { style: "none" },
      chartArea: { fill: { color: C.white } },
      showTitle: true, title: "Risk score — Ikeja LGA  (87 → 42)",
      titleFontSize: 11, titleColor: C.muted,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 7 — THE AGENTS
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[7]);
    pageHeader(s, "THE AGENTIC COPILOT", "Five specialist agents. Zero hallucinations.");

    const agents = [
      { t: "Network",    d: "Localizes the fault, pulls BTS evidence",        icon: ic.network, color: C.blue },
      { t: "Revenue",    d: "Spots leakage in recharge & billing streams",    icon: ic.money,   color: C.navy2 },
      { t: "Customer",   d: "Reads complaints, projects churn risk",          icon: ic.users,   color: C.red },
      { t: "Mitigation", d: "Simulates options, ranks by impact + cost",      icon: ic.cogs,    color: C.navy },
      { t: "Compliance", d: "Drafts NCC notes, assembles evidence pack",      icon: ic.gavel,   color: C.blueDk },
    ];
    // top row 3, bottom row 2 centered
    agents.forEach((a, i) => {
      let col, row;
      if (i < 3) { col = i; row = 0; }
      else { col = i - 3; row = 1; }
      const xBase = row === 0 ? 0.55 : 1.65;
      const x = xBase + col * 3.0;
      const y = 1.85 + row * 1.55;
      s.addShape("rect", { x, y, w: 2.8, h: 1.4, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      s.addShape("rect", { x, y, w: 0.1, h: 1.4, fill: { color: a.color }, line: { color: a.color } });
      s.addShape("ellipse", { x: x + 0.28, y: y + 0.22, w: 0.5, h: 0.5, fill: { color: a.color }, line: { color: a.color } });
      s.addImage({ data: a.icon, x: x + 0.36, y: y + 0.3, w: 0.34, h: 0.34 });
      s.addText(a.t + " Agent", { x: x + 0.9, y: y + 0.18, w: 1.85, h: 0.4, fontFace: "Segoe UI", fontSize: 15, bold: true, color: C.navy, margin: 0 });
      s.addText(a.d, { x: x + 0.28, y: y + 0.82, w: 2.4, h: 0.5, fontFace: "Segoe UI", fontSize: 11, color: C.muted, margin: 0 });
    });

    // bottom guarantee bar
    s.addShape("rect", { x: 0.55, y: 4.95, w: 8.9, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText("Every claim — every KPI, naira figure, subscriber count — must trace to a tool call. ClaimValidator strips the rest.", {
      x: 0.55, y: 4.95, w: 8.9, h: 0.42,
      fontFace: "Segoe UI", fontSize: 11.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 8 — AGENTIC SYSTEM DESIGN (agents → tools → external systems)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[8]);
    pageHeader(s, "AGENTIC SYSTEM DESIGN", "Five agents.  Pluggable tools.  Any data system.");

    // 3 column headers
    const colX = { agent: 0.55, tool: 2.95, sys: 6.7 };
    const colW = { agent: 2.30, tool: 3.65, sys: 2.85 };
    const headY = 1.78;
    const headH = 0.40;
    const colors = [C.navy, C.blue, C.gold];
    const colTitles = ["AGENT", "TOOL  (SK function)", "EXTERNAL SYSTEM"];
    const colXs = [colX.agent, colX.tool, colX.sys];
    const colWs = [colW.agent, colW.tool, colW.sys];
    colTitles.forEach((t, i) => {
      s.addShape("rect", { x: colXs[i], y: headY, w: colWs[i], h: headH, fill: { color: colors[i] }, line: { color: colors[i] } });
      s.addText(t, { x: colXs[i], y: headY, w: colWs[i], h: headH,
        fontFace: "Segoe UI", fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle", charSpacing: 3, margin: 0 });
    });

    // Five agent rows. Each row owns ~0.62" height.
    const rows = [
      {
        t: "Network",    color: C.blue,  ic: ic.network,
        tools: ["get_incident_context()", "get_signal_evidence(net, bts)"],
        sys: "Network OSS · NMS · BTS\nEricsson · Huawei · Nokia",
      },
      {
        t: "Revenue",    color: C.navy2, ic: ic.money,
        tools: ["get_signal_evidence(billing, recharge)", "estimate_impact()"],
        sys: "Billing · Charging · Top-up\nAmdocs · BSCS · Comviva",
      },
      {
        t: "Customer",   color: C.red,   ic: ic.users,
        tools: ["get_signal_evidence(complaints, social)", "estimate_impact()"],
        sys: "CRM · Contact Centre · Social\nSalesforce · Genesys · X (API)",
      },
      {
        t: "Mitigation", color: C.navy,  ic: ic.cogs,
        tools: ["get_mitigation_playbook()", "run_pre_action_simulation()"],
        sys: "Playbook DB · Risk Engine\nCustom · ServiceNow",
      },
      {
        t: "Compliance", color: C.blueDk, ic: ic.gavel,
        tools: ["get_audit_trail()", "generate_ncc_pack_draft()"],
        sys: "Audit Log · NCC e-filing\nInternal · NCC Portal",
      },
    ];

    const rowY0 = 2.30;
    const rowH = 0.50;
    const rowGap = 0.05;

    rows.forEach((r, i) => {
      const y = rowY0 + i * (rowH + rowGap);

      // ---- AGENT cell ----
      s.addShape("rect", { x: colX.agent, y, w: colW.agent, h: rowH, fill: { color: C.white }, line: { color: C.line, width: 0.5 } });
      s.addShape("rect", { x: colX.agent, y, w: 0.1, h: rowH, fill: { color: r.color }, line: { color: r.color } });
      s.addShape("ellipse", { x: colX.agent + 0.22, y: y + 0.1, w: 0.36, h: 0.36, fill: { color: r.color }, line: { color: r.color } });
      s.addImage({ data: r.ic, x: colX.agent + 0.28, y: y + 0.16, w: 0.24, h: 0.24 });
      s.addText(r.t + " Agent", { x: colX.agent + 0.65, y, w: 1.6, h: rowH,
        fontFace: "Segoe UI", fontSize: 12, bold: true, color: C.navy, valign: "middle", margin: 0 });

      // arrow agent → tool
      s.addShape("line", { x: colX.agent + colW.agent, y: y + rowH/2, w: 0.07, h: 0,
        line: { color: r.color, width: 1.25, endArrowType: "triangle" } });

      // ---- TOOL cell ----
      s.addShape("rect", { x: colX.tool, y, w: colW.tool, h: rowH, fill: { color: C.white }, line: { color: C.line, width: 0.5 } });
      // build tool list as bulleted text
      const toolItems = r.tools.flatMap((t, j) => [
        { text: t, options: { bullet: { code: "25AA" }, color: C.navy, breakLine: j < r.tools.length - 1 } },
      ]);
      s.addText(toolItems, {
        x: colX.tool + 0.12, y: y + 0.04, w: colW.tool - 0.18, h: rowH - 0.08,
        fontFace: "Consolas", fontSize: 9.5, color: C.navy, margin: 0, paraSpaceAfter: 0,
      });

      // arrow tool → system
      s.addShape("line", { x: colX.tool + colW.tool, y: y + rowH/2, w: 0.18, h: 0,
        line: { color: C.muted, width: 1.25, dashType: "dash", endArrowType: "triangle" } });

      // ---- SYSTEM cell ----
      s.addShape("rect", { x: colX.sys, y, w: colW.sys, h: rowH, fill: { color: C.white }, line: { color: C.line, width: 0.5 } });
      s.addShape("rect", { x: colX.sys, y, w: 0.08, h: rowH, fill: { color: C.gold }, line: { color: C.gold } });
      const sysParts = r.sys.split("\n");
      s.addText([
        { text: sysParts[0], options: { bold: true, color: C.navy, breakLine: true } },
        { text: sysParts[1] || "", options: { color: C.muted, italic: true } },
      ], {
        x: colX.sys + 0.16, y: y + 0.05, w: colW.sys - 0.2, h: rowH - 0.1,
        fontFace: "Segoe UI", fontSize: 9.5, margin: 0,
      });
    });

    // bottom strap — integration message
    s.addShape("rect", { x: 0.55, y: 5.05, w: 8.95, h: 0.32, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText([
      { text: "Adapter pattern: ", options: { bold: true, color: C.gold } },
      { text: "tools are thin connectors. Swap MTN systems for Airtel, Glo, or any operator — no agent code changes.", options: { color: C.white } },
    ], {
      x: 0.55, y: 5.05, w: 8.95, h: 0.32,
      fontFace: "Segoe UI", fontSize: 10.5, align: "center", valign: "middle", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 9 — WHY IT'S TRUSTWORTHY (grounded, audited, human-in-loop)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[9]);
    pageHeader(s, "TRUST BY DESIGN", "Trustworthy enough for regulators and CEOs.");

    const guards = [
      { t: "Grounded answers",      d: "Agents only speak from tool results.\nNo CSV browsing. No free-form claims.", icon: ic.brain,  color: C.blue },
      { t: "Human-in-the-loop",     d: "No mitigation runs without operator approval.\nThe approval IS the trigger.", icon: ic.shield, color: C.green },
      { t: "Append-only audit",     d: "Every action is logged: who, when, why,\nexpected impact, actual outcome.",   icon: ic.lock,   color: C.gold },
      { t: "Regulator-ready output",d: "NCC-format pack assembles in seconds,\nstraight from the audit trail.",       icon: ic.gavel,  color: C.red },
    ];
    guards.forEach((g, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.55 + col * 4.5;
      const y = 1.85 + row * 1.55;
      s.addShape("rect", { x, y, w: 4.4, h: 1.4, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      s.addShape("ellipse", { x: x + 0.22, y: y + 0.22, w: 0.55, h: 0.55, fill: { color: g.color }, line: { color: g.color } });
      s.addImage({ data: g.icon, x: x + 0.31, y: y + 0.31, w: 0.37, h: 0.37 });
      s.addText(g.t, { x: x + 0.95, y: y + 0.2, w: 3.3, h: 0.35, fontFace: "Segoe UI", fontSize: 15, bold: true, color: C.navy, margin: 0 });
      s.addText(g.d, { x: x + 0.95, y: y + 0.6, w: 3.3, h: 0.75, fontFace: "Segoe UI", fontSize: 11, color: C.muted, margin: 0 });
    });

    s.addShape("rect", { x: 0.55, y: 5.0, w: 8.9, h: 0.36, fill: { color: C.blue }, line: { color: C.blue } });
    s.addText("Autonomous enough to be useful.  Constrained enough to be deployed.", {
      x: 0.55, y: 5.0, w: 8.9, h: 0.36,
      fontFace: "Segoe UI", fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 9 — IMPACT (numbers)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[10]);
    pageHeader(s, "BUSINESS IMPACT", "What one Ikeja-class incident looks like.");

    // 4 stat tiles
    const tiles = [
      { big: "47 min", lbl: "earlier detection vs. dashboards",       color: C.blue },
      { big: "NGN 8.7m", lbl: "revenue at risk surfaced per incident",  color: C.green },
      { big: "NGN 2.1m", lbl: "subscriber compensation avoided",        color: C.gold },
      { big: "10 sec", lbl: "to assemble the NCC compliance pack",    color: C.red },
    ];
    tiles.forEach((t, i) => {
      const x = 0.55 + i * 2.27;
      s.addShape("rect", { x, y: 1.85, w: 2.07, h: 1.85, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      s.addShape("rect", { x, y: 1.85, w: 2.07, h: 0.12, fill: { color: t.color }, line: { color: t.color } });
      s.addText(t.big, { x: x + 0.1, y: 2.15, w: 1.9, h: 0.85, fontFace: "Segoe UI", fontSize: 30, bold: true, color: C.navy, align: "center", margin: 0 });
      s.addText(t.lbl, { x: x + 0.1, y: 3.0, w: 1.9, h: 0.65, fontFace: "Segoe UI", fontSize: 11, color: C.muted, align: "center", margin: 0 });
    });

    // before/after bar chart
    s.addText("Per-incident operator outcome", {
      x: 0.55, y: 3.75, w: 8.9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 12, bold: true, color: C.navy, margin: 0,
    });
    s.addChart(pres.charts.BAR, [
      { name: "Without RiskGuard", labels: ["Detect (min)", "Revenue lost (NGN m)", "NCC pack (hrs)"], values: [60, 8.7, 72] },
      { name: "With RiskGuard",    labels: ["Detect (min)", "Revenue lost (NGN m)", "NCC pack (hrs)"], values: [13, 0.6, 0.003] },
    ], {
      x: 0.55, y: 4.05, w: 8.9, h: 1.30,
      barDir: "bar",
      chartColors: [C.muted, C.blue],
      showLegend: true, legendPos: "b", legendFontSize: 9, legendColor: C.muted,
      catAxisLabelColor: C.muted, catAxisLabelFontSize: 9,
      valAxisLabelColor: C.muted, valAxisLabelFontSize: 9,
      valGridLine: { color: C.line, size: 0.5 },
      catGridLine: { style: "none" },
      chartArea: { fill: { color: C.paper } },
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 10 — WHY WE WIN
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[11]);
    pageHeader(s, "WHY WE WIN", "Not a chatbot. Not a BI tool. A new category.");

    // comparison table — 3 columns
    const cols = [
      { h: "Legacy NMS",        sub: "Network monitoring",   c: C.muted, items: ["Single-domain visibility", "Static thresholds", "No mitigation guidance", "Manual NCC reporting"] },
      { h: "Generic LLM chat",  sub: "ChatGPT-style",        c: C.gold,  items: ["Hallucinates KPIs", "No live data tools", "No audit trail", "Not regulator-safe"] },
      { h: "RiskGuard AI",      sub: "Agentic risk officer", c: C.blue,  items: ["7 signal domains fused", "Predicts breach 47 min ahead", "Recommends + simulates fix", "Auto-files NCC pack"] },
    ];
    cols.forEach((col, i) => {
      const x = 0.55 + i * 3.05;
      const isUs = i === 2;
      // header bar
      s.addShape("rect", { x, y: 1.8, w: 2.85, h: 0.55, fill: { color: col.c }, line: { color: col.c } });
      s.addText(col.h, { x, y: 1.8, w: 2.85, h: 0.32, fontFace: "Segoe UI", fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
      s.addText(col.sub, { x, y: 2.08, w: 2.85, h: 0.27, fontFace: "Segoe UI", fontSize: 9.5, color: C.white, align: "center", margin: 0 });
      // body
      s.addShape("rect", { x, y: 2.35, w: 2.85, h: 2.7,
        fill: { color: isUs ? C.white : C.paper },
        line: { color: isUs ? C.blue : C.line, width: isUs ? 1.5 : 0.75 },
        shadow: isUs ? { type: "outer", color: "000000", blur: 10, offset: 2, angle: 90, opacity: 0.10 } : undefined,
      });
      col.items.forEach((it, j) => {
        const y = 2.5 + j * 0.55;
        // check or cross
        s.addText(isUs ? "✓" : "✕", {
          x: x + 0.15, y, w: 0.3, h: 0.4,
          fontFace: "Segoe UI", fontSize: 16, bold: true,
          color: isUs ? C.green : C.red, margin: 0,
        });
        s.addText(it, { x: x + 0.5, y, w: 2.3, h: 0.5, fontFace: "Segoe UI", fontSize: 11.5,
          color: isUs ? C.ink : C.muted, bold: isUs, margin: 0 });
      });
    });

    // bottom strap
    s.addText("And we built it on the host's stack: Microsoft Azure OpenAI + Semantic Kernel.", {
      x: 0.55, y: 5.1, w: 8.9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 12, italic: true, color: C.navy, align: "center", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 11 — ROADMAP / GO-TO-MARKET
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    s.addNotes(NOTES[12]);
    pageHeader(s, "ROADMAP  ·  GO-TO-MARKET", "From hackathon to West African telco standard.");

    const phases = [
      { p: "Now",      t: "Vertical slice live", d: "Ikeja demo. Real risk engine, agentic copilot, NCC pack. End-to-end.", color: C.blue },
      { p: "90 days",  t: "Pilot with 1 MNO",    d: "Connect to one operator's read-only data lake. One Lagos region. Measure detection lift.", color: C.gold },
      { p: "12 months", t: "Multi-LGA SaaS",     d: "Cover all 20 Lagos LGAs. Add fraud + SIM-swap agents. SOC2-track.", color: C.green },
      { p: "24 months", t: "Regional platform",  d: "Tier-2/3 operators across West Africa. Per-subscriber pricing. NCC + ARCEP-ready.", color: C.red },
    ];
    phases.forEach((ph, i) => {
      const x = 0.55 + i * 2.27;
      s.addShape("rect", { x, y: 1.85, w: 2.07, h: 2.6, fill: { color: C.white }, line: { color: C.line, width: 0.75 },
        shadow: { type: "outer", color: "000000", blur: 8, offset: 1, angle: 90, opacity: 0.06 } });
      // top color band
      s.addShape("rect", { x, y: 1.85, w: 2.07, h: 0.55, fill: { color: ph.color }, line: { color: ph.color } });
      s.addText(ph.p, { x: x + 0.1, y: 1.92, w: 1.9, h: 0.42, fontFace: "Segoe UI", fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(ph.t, { x: x + 0.15, y: 2.55, w: 1.8, h: 0.55, fontFace: "Segoe UI", fontSize: 14, bold: true, color: C.navy, margin: 0 });
      s.addText(ph.d, { x: x + 0.15, y: 3.15, w: 1.8, h: 1.25, fontFace: "Segoe UI", fontSize: 10.5, color: C.muted, margin: 0 });
    });

    // business model strap
    s.addShape("rect", { x: 0.55, y: 4.7, w: 8.9, h: 0.65, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText([
      { text: "Business model:  ", options: { bold: true, color: C.gold } },
      { text: "SaaS license per operator + per-incident NCC compliance fee. Avoids one ₦100m fine = pays for the year.", options: { color: C.white } },
    ], {
      x: 0.55, y: 4.7, w: 8.9, h: 0.65,
      fontFace: "Segoe UI", fontSize: 12, align: "center", valign: "middle", margin: 0,
    });
  }

  // ------------------------------------------------------------------
  // SLIDE 12 — TEAM + ASK (closing dark slide)
  // ------------------------------------------------------------------
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };

    // accent bar
    s.addShape("rect", { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.blue }, line: { color: C.blue } });

    s.addNotes(NOTES[13]);
    s.addText("LET'S BUILD TELCO RESILIENCE FOR NIGERIA", {
      x: 0.55, y: 0.6, w: 9, h: 0.4,
      fontFace: "Segoe UI", fontSize: 12, bold: true, color: C.gold, charSpacing: 4, margin: 0,
    });
    s.addText("RiskGuard AI", {
      x: 0.55, y: 1.0, w: 9, h: 0.85,
      fontFace: "Segoe UI", fontSize: 48, bold: true, color: C.white, margin: 0,
    });
    s.addText("Detect risk earlier. Mitigate it faster. Prove it to the regulator.", {
      x: 0.55, y: 1.95, w: 9, h: 0.5,
      fontFace: "Segoe UI", fontSize: 18, italic: true, color: C.white, margin: 0,
    });

    // team row
    s.addText("THE TEAM", {
      x: 0.55, y: 2.65, w: 9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 11, bold: true, color: C.gold, charSpacing: 4, margin: 0,
    });

    // Featured Team Lead card
    s.addShape("rect", { x: 0.55, y: 2.95, w: 9.0, h: 0.7, fill: { color: C.gold }, line: { color: C.gold } });
    s.addShape("rect", { x: 0.55, y: 2.95, w: 0.12, h: 0.7, fill: { color: C.red }, line: { color: C.red } });
    s.addText("Ifunanya", {
      x: 0.85, y: 2.98, w: 3.5, h: 0.4,
      fontFace: "Segoe UI", fontSize: 18, bold: true, color: C.navy, valign: "middle", margin: 0,
    });
    s.addText("Team Lead  ·  Product & Strategy", {
      x: 0.85, y: 3.32, w: 4.5, h: 0.32,
      fontFace: "Segoe UI", fontSize: 11, color: C.navy, margin: 0,
    });
    s.addText("Steers the mission. Owns the pitch. Sets the calibre.", {
      x: 5.0, y: 3.05, w: 4.4, h: 0.55,
      fontFace: "Segoe UI", fontSize: 11, italic: true, color: C.navy, valign: "middle", align: "right", margin: 0,
    });

    // Engineering team row
    const team = [
      { n: "Favour",     r: "Data & Risk Engine" },
      { n: "Ladipo",     r: "API, State, Compliance" },
      { n: "Marvelous",  r: "Frontend Dashboard" },
      { n: "Tobi",       r: "Agentic Copilot" },
    ];
    team.forEach((m, i) => {
      const x = 0.55 + i * 2.27;
      s.addShape("rect", { x, y: 3.78, w: 2.07, h: 0.7, fill: { color: C.navy2 }, line: { color: C.blue, width: 0.75 } });
      s.addText(m.n, { x: x + 0.15, y: 3.82, w: 1.85, h: 0.32, fontFace: "Segoe UI", fontSize: 13, bold: true, color: C.white, margin: 0 });
      s.addText(m.r, { x: x + 0.15, y: 4.13, w: 1.85, h: 0.32, fontFace: "Segoe UI", fontSize: 10.5, color: C.gold, margin: 0 });
    });

    // ask
    s.addShape("rect", { x: 0.55, y: 4.6, w: 8.9, h: 0.5, fill: { color: C.blue }, line: { color: C.blue } });
    s.addText("Our ask:  the win, a pilot conversation with MTN, and the runway to ship this to production.", {
      x: 0.55, y: 4.6, w: 8.9, h: 0.5,
      fontFace: "Segoe UI", fontSize: 12.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // sponsors line
    s.addText("Microsoft Elevate  ·  MTN Foundation Nigeria  ·  Data Science Nigeria  ·  AI Skills Week Lagos 2026", {
      x: 0.55, y: 5.20, w: 9, h: 0.3,
      fontFace: "Segoe UI", fontSize: 10, italic: true, color: C.gold, margin: 0,
    });
  }

  // ------------------------------------------------------------------
  await pres.writeFile({ fileName: "AI4Telco_RiskGuardAI.pptx" });
  console.log("Wrote AI4Telco_RiskGuardAI.pptx");
}

build().catch(e => { console.error(e); process.exit(1); });
