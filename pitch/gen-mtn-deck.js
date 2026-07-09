// Generates the RiskGuard AI x MTN pitch deck (.pptx)
// Run: cd pitch && node gen-mtn-deck.js
const PptxGenJS = require("./node_modules/pptxgenjs");
const path = require("path");

const NAVY = "0E1B2C";
const NAVY2 = "16263B";
const INK = "1A2230";
const MUTE = "5B6472";
const TEAL = "12A594";
const YEL = "FFC400";
const PANEL = "F4F6F8";
const LINE = "D9DEE4";
const WHITE = "FFFFFF";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.author = "Team Sentinel";
pptx.company = "RiskGuard AI";
pptx.title = "RiskGuard AI x MTN Nigeria";

const W = 13.33;
const MX = 0.7; // left margin

function footer(slide, n) {
  slide.addText("RiskGuard AI  ·  confidential  ·  prepared for MTN Nigeria", {
    x: MX, y: 7.05, w: 9, h: 0.3, fontSize: 9, color: MUTE, fontFace: "Arial",
  });
  slide.addText(String(n), {
    x: W - 1.1, y: 7.05, w: 0.4, h: 0.3, fontSize: 9, color: MUTE, align: "right", fontFace: "Arial",
  });
}

// content slide header
function header(slide, kicker, title) {
  slide.background = { color: WHITE };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: YEL } });
  if (kicker) {
    slide.addText(kicker.toUpperCase(), { x: MX, y: 0.5, w: 11.5, h: 0.3, fontSize: 12, color: TEAL, bold: true, charSpacing: 2, fontFace: "Arial" });
  }
  slide.addText(title, { x: MX, y: 0.82, w: 11.9, h: 0.9, fontSize: 28, color: INK, bold: true, fontFace: "Arial" });
  slide.addShape(pptx.ShapeType.line, { x: MX, y: 1.72, w: 11.9, h: 0, line: { color: LINE, width: 1 } });
}

function bulletBlock(slide, items, opts = {}) {
  const x = opts.x ?? MX, y = opts.y ?? 2.0, w = opts.w ?? 11.9;
  slide.addText(items.map((t) => ({
    text: t.t, options: {
      bullet: { code: "2022", indent: 18 }, fontSize: t.fs ?? 17, color: t.c ?? INK,
      bold: !!t.b, paraSpaceAfter: t.sa ?? 12, fontFace: "Arial",
    },
  })), { x, y, w, h: opts.h ?? 4.6, valign: "top" });
}

// stat card
function statCard(slide, x, y, w, big, label) {
  const h = 1.75;
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
  slide.addText(big, { x: x + 0.15, y: y + 0.18, w: w - 0.3, h: 0.7, fontSize: 30, color: TEAL, bold: true, align: "left", fontFace: "Arial" });
  slide.addText(label, { x: x + 0.15, y: y + 0.92, w: w - 0.3, h: 0.7, fontSize: 12.5, color: MUTE, align: "left", fontFace: "Arial" });
}

// pathway / step card
function card(slide, x, y, w, h, title, body, accent = TEAL) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.09, h, fill: { color: accent } });
  slide.addText(title, { x: x + 0.22, y: y + 0.16, w: w - 0.35, h: 0.5, fontSize: 15, color: INK, bold: true, fontFace: "Arial" });
  slide.addText(body, { x: x + 0.22, y: y + 0.66, w: w - 0.35, h: h - 0.8, fontSize: 12.5, color: MUTE, fontFace: "Arial", valign: "top", lineSpacingMultiple: 1.05 });
}

/* 1. TITLE */
let s = pptx.addSlide();
s.background = { color: NAVY };
s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.9, w: W, h: 0.6, fill: { color: NAVY2 } });
s.addText("RISKGUARD AI", { x: MX, y: 2.05, w: 12, h: 0.5, fontSize: 16, color: YEL, bold: true, charSpacing: 3, fontFace: "Arial" });
s.addText("The incident-to-compliance autopilot for telecom operations", { x: MX, y: 2.55, w: 11.5, h: 1.5, fontSize: 34, color: WHITE, bold: true, fontFace: "Arial" });
s.addText("Detect a major network incident early, quantify its regulatory and revenue exposure, and produce an NCC-ready evidence pack — automatically.", { x: MX, y: 4.15, w: 11, h: 1, fontSize: 16, color: "C4CBD6", fontFace: "Arial" });
s.addText("Team Sentinel   ·   prepared for MTN Nigeria   ·   exploratory session, July 2026", { x: MX, y: 7.02, w: 12, h: 0.35, fontSize: 11.5, color: "9AA6B5", fontFace: "Arial" });

/* 2. PROBLEM NOW */
s = pptx.addSlide();
header(s, "Why now", "The problem is no longer just downtime — it is a bill");
statCard(s, MX, 2.05, 3.75, "9,218", "fibre cuts on MTN's network in 2025 (CEO-disclosed); >50% of all Nigerian outages");
statCard(s, MX + 4.05, 2.05, 3.75, "64 of 118", "of December 2025's network outages were MTN's — the most of any operator");
statCard(s, MX + 8.1, 2.05, 3.75, "Since Nov 2025", "NCC enforces consumer compensation for QoS breaches, by subscriber ARPU per LGA");
bulletBlock(s, [
  { t: "The NCC now mandates major-outage reporting through its Uptime portal — cause, area, and restoration time for every qualifying event.", b: false },
  { t: "A \"major outage\" = ≥5% of subscribers OR ≥5 LGAs, OR ≥100 sites / 5% of sites for ≥30 min. That threshold model maps directly onto LGA-level detection.", b: false },
  { t: "Detection, evidence assembly, and exposure calculation today are largely manual and reactive — under a regime that now attaches a number to every incident.", b: true, c: INK },
], { y: 4.15, h: 2.6 });
footer(s, 2);

/* 3. WHAT RISKGUARD DOES */
s = pptx.addSlide();
header(s, "The product", "One layer, four jobs — on every incident, automatically");
const jobs = [
  ["1 · Detect & classify", "Correlate weak signals into an emerging incident, classify it against NCC thresholds, and raise an early time-to-breach warning."],
  ["2 · Quantify exposure", "Affected subscribers, enterprise lines, revenue at risk, and NCC compensation liability — computed live from your data."],
  ["3 · Recommend mitigation", "Simulate do-nothing vs. reroute / failover, ranked by cost and impact. Mandatory human approval — nothing acts on its own."],
  ["4 · File & prove", "Assemble a regulator-ready NCC evidence pack and consumer-notification draft, backed by an append-only audit trail."],
];
let cx = MX, cy = 2.15, cw = 5.85, ch = 2.15;
jobs.forEach((j, i) => {
  const x = MX + (i % 2) * (cw + 0.35);
  const y = cy + Math.floor(i / 2) * (ch + 0.3);
  card(s, x, y, cw, ch, j[0], j[1], i % 2 ? TEAL : YEL);
});
footer(s, 3);

/* 4. ARCHITECTURE — SITS ON TOP */
s = pptx.addSlide();
header(s, "How it connects", "It sits on top of your stack — read-only in, structured out");
// three columns
function colBox(x, title, rows, accent) {
  const w = 3.5, y0 = 2.25;
  s.addText(title.toUpperCase(), { x, y: y0 - 0.42, w, h: 0.3, fontSize: 12, color: MUTE, bold: true, charSpacing: 1, align: "center", fontFace: "Arial" });
  rows.forEach((r, i) => {
    const y = y0 + i * 0.92;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.78, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h: 0.78, fill: { color: accent } });
    s.addText([{ text: r[0] + "\n", options: { fontSize: 12.5, bold: true, color: INK } }, { text: r[1], options: { fontSize: 10.5, color: MUTE } }], { x: x + 0.18, y, w: w - 0.28, h: 0.78, valign: "middle", fontFace: "Arial" });
  });
}
colBox(MX, "MTN systems (OSS / BSS)", [
  ["Fault / alarms", "Netcool · Huawei NCE"],
  ["Performance KPIs", "ENIQ · NetAct"],
  ["Inventory / BSS", "site→LGA · subscribers · ARPU"],
], "5B6472");
colBox(MX + 3.95, "RiskGuard (agentic layer)", [
  ["Ingestion adapters", "TM Forum APIs · Kafka"],
  ["5 grounded agents", "network · impact · mitigation · compliance"],
  ["Claim validator", "every number traced to a source"],
], TEAL);
colBox(MX + 7.9, "Outputs", [
  ["Early warning", "time-to-breach"],
  ["NCC pack + exposure", "₦ per incident + consumer notice"],
  ["Mitigation → ticket", "ServiceNow"],
], YEL);
s.addText("You never modify your systems — we subscribe to signals you already emit. Start on a file of one past incident (zero integration), then a read-only feed; we write the adapter, you grant read access. A listener is a tap, not a transplant. Azure OpenAI + Semantic Kernel, aligned with your cloud.", { x: MX, y: 5.5, w: 11.9, h: 1.0, fontSize: 12, color: INK, italic: true, fontFace: "Arial" });
footer(s, 4);

/* 5. AGENTS */
s = pptx.addSlide();
header(s, "Autonomous + grounded", "It listens and concludes on its own — and can't make numbers up");
bulletBlock(s, [
  { t: "Network agent — correlates alarms across transport, BTS and power into an emerging incident + time-to-breach.", },
  { t: "Impact / revenue agent — subscribers, enterprise lines, revenue at risk, and NCC compensation exposure.", },
  { t: "Mitigation agent — simulates and ranks options before recommending; human approves.", },
  { t: "Compliance agent — classifies against NCC thresholds and drafts the evidence pack (hours → minutes).", },
  { t: "Investigation / audit agent — grounded root-cause note + append-only, non-repudiable record.", },
  { t: "Claim validator: every KPI, sum, subscriber count and action in an answer must trace to a system of record — or it is rejected. No hallucinated figures reach an operator or a regulatory filing.", b: true, c: INK, sa: 4 },
], { y: 2.05, h: 4.7 });
footer(s, 5);

/* 6. DEMO */
s = pptx.addSlide();
header(s, "What we'll show", "One incident, end to end: Ikeja backbone fibre cut");
const steps = ["Live feed\nbaseline green", "Emerging risk\n~47 min to breach", "Agents reason\ntool calls + validation", "Mitigation\nsimulate + approve", "Recovery + NCC pack\n+ exposure ₦"];
const sw = 2.15, gap = 0.28, sy = 2.5;
steps.forEach((t, i) => {
  const x = MX + i * (sw + gap);
  s.addShape(pptx.ShapeType.roundRect, { x, y: sy, w: sw, h: 1.5, rectRadius: 0.08, fill: { color: i === steps.length - 1 ? "E9F7F4" : PANEL }, line: { color: i === steps.length - 1 ? TEAL : LINE, width: i === steps.length - 1 ? 1.5 : 1 } });
  s.addText([{ text: (i + 1) + "\n", options: { fontSize: 13, bold: true, color: TEAL } }, { text: t, options: { fontSize: 12, color: INK } }], { x: x + 0.1, y: sy + 0.12, w: sw - 0.2, h: 1.26, align: "center", valign: "middle", fontFace: "Arial" });
  if (i < steps.length - 1) s.addText("›", { x: x + sw - 0.02, y: sy + 0.45, w: gap, h: 0.6, fontSize: 22, color: MUTE, align: "center", fontFace: "Arial" });
});
s.addText("It reads as a system consuming your telemetry — not a scripted story. One incident type; the adapter is identical for the rest.", { x: MX, y: 4.4, w: 11.9, h: 0.6, fontSize: 14, color: INK, fontFace: "Arial" });
bulletBlock(s, [
  { t: "The wow is the visible multi-agent choreography and the trust badge — followed by a number a regulator and a CFO both care about.", fs: 15 },
], { y: 5.1, h: 1.3 });
footer(s, 6);

/* 7. WHY US / MATURITY */
s = pptx.addSlide();
header(s, "Why us, and where we honestly are", "Built for this problem — proven on your data next");
card(s, MX, 2.15, 5.85, 3.3, "Why us / why now", "• Top-4 winner at the AI4Telco Hackathon (MTN Foundation, telecom partner) — the exact solution to your #1 operational problem, built in a weekend.\n\n• Already on Azure OpenAI + Semantic Kernel — aligned with your cloud and the Microsoft AI Skills Week stack.\n\n• Architecture designed so data source and reasoning are separable — pilot integration is thin.", YEL);
card(s, MX + 6.2, 2.15, 5.85, 3.3, "Where we are — plainly", "• RiskGuard is a working, end-to-end vertical slice on synthetic data.\n\n• It is not yet running on live MTN telemetry — that is exactly what the paid pilot proves.\n\n• We won't promise integration timelines, security posture, or ROI beyond what we can show. Under-promising is the point.", TEAL);
footer(s, 7);

/* 8. COLLABORATION PATHWAYS */
s = pptx.addSlide();
header(s, "Proposed collaboration", "Three pathways — anchored on a paid pilot");
card(s, MX, 2.2, 3.75, 3.5, "1 · Paid pilot  (primary)", "8–12 weeks. One region, one incident type (fibre-cut), one agreed success metric. Read-only feed, one past incident to replay, an NDA.\n\nProves value on your data and creates the reference.", YEL);
card(s, MX + 4.05, 2.2, 3.75, 3.5, "2 · Cloud Accelerator", "Run in parallel. Non-dilutive grant, GTM support from MTN's internal teams, and access to MTN APIs (Cloud, MoMo, Chenosis).\n\nCapital and distribution without giving up ownership.", TEAL);
card(s, MX + 8.1, 2.2, 3.75, 3.5, "3 · Design partnership", "Harden RiskGuard against real, anonymized-first incident data under NDA.\n\nLow-commitment, and it is what makes pathways 1 and 2 credible. Co-development, not \"give us your data.\"", "5B6472");
footer(s, 8);

/* 9. THE PILOT / ASK */
s = pptx.addSlide();
header(s, "The ask", "A scoped, paid proof-of-value pilot");
bulletBlock(s, [
  { t: "Scope: fibre-cut incidents in one region, on your fault + performance feed.", b: true, c: INK },
  { t: "Success metric (agreed together): NCC-pack turnaround, exposure accuracy, and early-warning lead time.", },
  { t: "What we need from you: a read-only feed (Kafka or export), site→LGA + subscriber/ARPU context (can start aggregated), one past major incident to replay, an NDA, and a technical point of contact.", },
  { t: "What you get: a validated compliance-and-exposure layer live on your telemetry, and a decision on scaling.", },
], { y: 2.05, h: 3.0 });
s.addShape(pptx.ShapeType.roundRect, { x: MX, y: 5.2, w: 11.9, h: 1.1, rectRadius: 0.08, fill: { color: NAVY } });
s.addText("Next step: we send a one-page pilot outline — success metric and timeline — within 48 hours of this call.", { x: MX + 0.3, y: 5.2, w: 11.3, h: 1.1, fontSize: 16, color: WHITE, bold: true, valign: "middle", fontFace: "Arial" });
footer(s, 9);

const out = path.join(__dirname, "mtn-meeting", "RiskGuard-MTN-deck.pptx");
pptx.writeFile({ fileName: out }).then((f) => console.log("WROTE", f)).catch((e) => { console.error(e); process.exit(1); });
