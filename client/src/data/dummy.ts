import type {
  LGA,
  Incident,
  MitigationOption,
  AgentResponse,
  AuditEntry,
  CompliancePack,
  SimulationPhase,
} from "../types";

// ─── LGA Risk Data ───────────────────────────────────────────────────────────

export const LGA_BASELINE: LGA[] = [
  { id: "ikeja", name: "Ikeja", score: 12, status: "safe", subscribers: 18420, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "mushin", name: "Mushin", score: 18, status: "safe", subscribers: 12100, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "kosofe", name: "Kosofe", score: 22, status: "low", subscribers: 9800, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "eti-osa", name: "Eti-Osa", score: 31, status: "low", subscribers: 15300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "lagos-island", name: "Lagos Island", score: 27, status: "low", subscribers: 11200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "surulere", name: "Surulere", score: 19, status: "safe", subscribers: 8900, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "agege", name: "Agege", score: 24, status: "low", subscribers: 7400, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "shomolu", name: "Shomolu", score: 16, status: "safe", subscribers: 6100, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "alimosho", name: "Alimosho", score: 11, status: "safe", subscribers: 14200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "ikorodu", name: "Ikorodu", score: 9, status: "safe", subscribers: 9300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
];

export const LGA_INCIDENT: LGA[] = [
  { id: "ikeja", name: "Ikeja", score: 87, status: "critical", subscribers: 18420, timeToBreach: 47, hasActiveIncident: true, incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "mushin", name: "Mushin", score: 72, status: "high", subscribers: 12100, timeToBreach: 120, hasActiveIncident: false, incidentId: null },
  { id: "kosofe", name: "Kosofe", score: 61, status: "high", subscribers: 9800, timeToBreach: 180, hasActiveIncident: false, incidentId: null },
  { id: "eti-osa", name: "Eti-Osa", score: 52, status: "medium", subscribers: 15300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "lagos-island", name: "Lagos Island", score: 45, status: "medium", subscribers: 11200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "surulere", name: "Surulere", score: 23, status: "low", subscribers: 8900, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "agege", name: "Agege", score: 31, status: "low", subscribers: 7400, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "shomolu", name: "Shomolu", score: 29, status: "low", subscribers: 6100, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "alimosho", name: "Alimosho", score: 18, status: "safe", subscribers: 14200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "ikorodu", name: "Ikorodu", score: 15, status: "safe", subscribers: 9300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
];

export const LGA_RECOVERY: LGA[] = [
  { id: "ikeja", name: "Ikeja", score: 42, status: "medium", subscribers: 18420, timeToBreach: null, hasActiveIncident: true, incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "mushin", name: "Mushin", score: 45, status: "medium", subscribers: 12100, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "kosofe", name: "Kosofe", score: 38, status: "low", subscribers: 9800, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "eti-osa", name: "Eti-Osa", score: 33, status: "low", subscribers: 15300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "lagos-island", name: "Lagos Island", score: 28, status: "low", subscribers: 11200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "surulere", name: "Surulere", score: 17, status: "safe", subscribers: 8900, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "agege", name: "Agege", score: 22, status: "low", subscribers: 7400, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "shomolu", name: "Shomolu", score: 19, status: "safe", subscribers: 6100, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "alimosho", name: "Alimosho", score: 12, status: "safe", subscribers: 14200, timeToBreach: null, hasActiveIncident: false, incidentId: null },
  { id: "ikorodu", name: "Ikorodu", score: 10, status: "safe", subscribers: 9300, timeToBreach: null, hasActiveIncident: false, incidentId: null },
];

export function getLGAs(phase: SimulationPhase): LGA[] {
  if (phase === "baseline") return LGA_BASELINE;
  if (phase === "recovery") return LGA_RECOVERY;
  return LGA_INCIDENT; // incident and mitigation
}

// ─── National State Risk Data (Nigeria map) ──────────────────────────────────
// State names MUST match @react-map/nigeria's internal identifiers exactly.

export interface NationalState {
  id: string;
  name: string; // must match @react-map/nigeria state names
  score: number;
  hasIncident: boolean;
  incidentId: string | null;
  isLagos?: boolean;
}

const NATIONAL_STATES_BASE: NationalState[] = [
  // Southwest
  { id: "lagos",      name: "Lagos",                    score: 87, hasIncident: true,  incidentId: "INC-2025-0502-IKEJA-001", isLagos: true },
  { id: "ogun",       name: "Ogun",                     score: 38, hasIncident: false, incidentId: null },
  { id: "oyo",        name: "Oyo",                      score: 35, hasIncident: false, incidentId: null },
  { id: "osun",       name: "Osun",                     score: 22, hasIncident: false, incidentId: null },
  { id: "ondo",       name: "Ondo",                     score: 26, hasIncident: false, incidentId: null },
  { id: "ekiti",      name: "Ekiti",                    score: 21, hasIncident: false, incidentId: null },
  // South-south
  { id: "edo",        name: "Edo",                      score: 43, hasIncident: false, incidentId: null },
  { id: "delta",      name: "Delta",                    score: 44, hasIncident: false, incidentId: null },
  { id: "bayelsa",    name: "Bayelsa",                  score: 29, hasIncident: false, incidentId: null },
  { id: "rivers",     name: "Rivers",                   score: 35, hasIncident: false, incidentId: null },
  { id: "akwaibom",   name: "Akwa Ibom",                score: 33, hasIncident: false, incidentId: null },
  { id: "crossriver", name: "Cross River",              score: 31, hasIncident: false, incidentId: null },
  // Southeast
  { id: "imo",        name: "Imo",                      score: 34, hasIncident: false, incidentId: null },
  { id: "abia",       name: "Abia",                     score: 30, hasIncident: false, incidentId: null },
  { id: "anambra",    name: "Anambra",                  score: 39, hasIncident: false, incidentId: null },
  { id: "enugu",      name: "Enugu",                    score: 27, hasIncident: false, incidentId: null },
  { id: "ebonyi",     name: "Ebonyi",                   score: 23, hasIncident: false, incidentId: null },
  // North-central
  { id: "kwara",      name: "Kwara",                    score: 28, hasIncident: false, incidentId: null },
  { id: "kogi",       name: "Kogi",                     score: 36, hasIncident: false, incidentId: null },
  { id: "benue",      name: "Benue",                    score: 41, hasIncident: false, incidentId: null },
  { id: "niger",      name: "Niger",                    score: 25, hasIncident: false, incidentId: null },
  { id: "fct",        name: "Federal Capital Territory",score: 42, hasIncident: false, incidentId: null },
  { id: "nassarawa",  name: "Nassarawa",                score: 32, hasIncident: false, incidentId: null },
  { id: "plateau",    name: "Plateau",                  score: 37, hasIncident: false, incidentId: null },
  // Northwest
  { id: "sokoto",     name: "Sokoto",                   score: 22, hasIncident: false, incidentId: null },
  { id: "kebbi",      name: "Kebbi",                    score: 24, hasIncident: false, incidentId: null },
  { id: "zamfara",    name: "Zamfara",                  score: 33, hasIncident: false, incidentId: null },
  { id: "katsina",    name: "Katsina",                  score: 28, hasIncident: false, incidentId: null },
  { id: "kaduna",     name: "Kaduna",                   score: 38, hasIncident: false, incidentId: null },
  // North
  { id: "kano",       name: "Kano",                     score: 31, hasIncident: false, incidentId: null },
  { id: "jigawa",     name: "Jigawa",                   score: 27, hasIncident: false, incidentId: null },
  // Northeast
  { id: "yobe",       name: "Yobe",                     score: 58, hasIncident: false, incidentId: null },
  { id: "borno",      name: "Borno",                    score: 65, hasIncident: false, incidentId: null },
  { id: "gombe",      name: "Gombe",                    score: 45, hasIncident: false, incidentId: null },
  { id: "bauchi",     name: "Bauchi",                   score: 29, hasIncident: false, incidentId: null },
  { id: "adamawa",    name: "Adamawa",                  score: 48, hasIncident: false, incidentId: null },
  { id: "taraba",     name: "Taraba",                   score: 41, hasIncident: false, incidentId: null },
];

const LAGOS_SCORE_BY_PHASE: Record<SimulationPhase, number> = {
  baseline: 12,
  incident: 87,
  mitigation: 87,
  recovery: 42,
};

export function getNationalStates(phase: SimulationPhase): NationalState[] {
  return NATIONAL_STATES_BASE.map((s) =>
    s.isLagos ? { ...s, score: LAGOS_SCORE_BY_PHASE[phase] } : s
  );
}

// ─── Risk Score History (for chart) ──────────────────────────────────────────

export const RISK_SCORE_HISTORY: Record<SimulationPhase, { t: string; score: number }[]> = {
  baseline: [
    { t: "07:00", score: 11 }, { t: "07:15", score: 12 }, { t: "07:30", score: 10 },
    { t: "07:45", score: 13 }, { t: "08:00", score: 14 }, { t: "08:15", score: 12 },
    { t: "08:23", score: 12 },
  ],
  incident: [
    { t: "07:00", score: 11 }, { t: "07:30", score: 12 }, { t: "08:00", score: 14 },
    { t: "08:15", score: 21 }, { t: "08:20", score: 38 }, { t: "08:23", score: 54 },
    { t: "08:25", score: 72 }, { t: "08:28", score: 87 },
  ],
  mitigation: [
    { t: "08:00", score: 14 }, { t: "08:15", score: 21 }, { t: "08:20", score: 38 },
    { t: "08:23", score: 54 }, { t: "08:25", score: 72 }, { t: "08:28", score: 87 },
    { t: "08:35", score: 87 }, { t: "08:37", score: 80 },
  ],
  recovery: [
    { t: "08:15", score: 21 }, { t: "08:23", score: 54 }, { t: "08:28", score: 87 },
    { t: "08:35", score: 87 }, { t: "08:37", score: 80 }, { t: "08:40", score: 68 },
    { t: "08:44", score: 55 }, { t: "08:49", score: 42 },
  ],
};

// ─── Incidents ────────────────────────────────────────────────────────────────

export const INCIDENTS: Incident[] = [
  {
    id: "INC-2025-0502-IKEJA-001",
    lgaId: "ikeja",
    lgaName: "Ikeja",
    status: "active",
    riskScore: 87,
    startTime: "2025-05-02T08:23:00Z",
    timeToBreach: 47,
    subscribers: 18420,
    enterpriseLines: 312,
    revenueAtRisk: 8700000,
    compensationExposure: 2100000,
    nccFineExposure: 5000000,
    rootCause: "Compound fibre degradation combined with BTS power instability across 7 sites in Ikeja zone 3A.",
    signals: {
      network: { packetLoss: 34, latency: 280, baselinePacketLoss: 2, baselineLatency: 45 },
      bts: { unstableSites: 7, totalSites: 12, powerAlerts: 23 },
      complaints: { count: 342, changeLabel: "+180% vs baseline", ratePerHour: 171 },
      sessions: { current: 12100, baseline: 18420, dropPct: 34 },
      billing: { velocityDrop: 23 },
      recharge: { volumeDecline: 18 },
    },
    timeline: [
      { time: "08:23", type: "detection", event: "Anomaly detected: packet loss spike in Ikeja zone 3A — 34% (baseline: 2%)" },
      { time: "08:26", type: "alert", event: "Risk score crossed warning threshold (65)" },
      { time: "08:28", type: "escalation", event: "Risk score reached critical threshold (87) — breach predicted in 47 min" },
      { time: "08:28", type: "incident", event: "Incident INC-2025-0502-IKEJA-001 auto-created" },
      { time: "08:31", type: "agent", event: "NetworkRiskAgent: 7 BTS sites confirmed unstable, fibre degradation detected on zone 3A segment" },
      { time: "08:33", type: "agent", event: "MitigationPlanningAgent: pre-action simulation run for ACTION-001 and ACTION-002" },
      { time: "08:35", type: "approval", event: "Operator approved ACTION-001: Traffic Reroute via Alternative Fibre" },
      { time: "08:37", type: "recovery", event: "Recovery mode initiated — Surulere-Ikorodu fibre ring reroute applied" },
      { time: "08:49", type: "recovery", event: "Risk score dropped to 42 — incident stabilised, breach averted" },
    ],
  },
  {
    id: "INC-2025-0430-MUSHIN-002",
    lgaId: "mushin",
    lgaName: "Mushin",
    status: "resolved",
    riskScore: 64,
    startTime: "2025-04-30T14:11:00Z",
    timeToBreach: null,
    subscribers: 8700,
    enterpriseLines: 89,
    revenueAtRisk: 3200000,
    compensationExposure: 680000,
    nccFineExposure: 1500000,
    rootCause: "Scheduled maintenance overrun on Mushin node 7 causing congestion cascade.",
    signals: {
      network: { packetLoss: 18, latency: 145, baselinePacketLoss: 2, baselineLatency: 45 },
      bts: { unstableSites: 3, totalSites: 8, powerAlerts: 5 },
      complaints: { count: 98, changeLabel: "+62% vs baseline", ratePerHour: 49 },
      sessions: { current: 6800, baseline: 8700, dropPct: 22 },
      billing: { velocityDrop: 11 },
      recharge: { volumeDecline: 8 },
    },
    timeline: [
      { time: "14:11", type: "detection", event: "Congestion detected on Mushin node 7 post-maintenance" },
      { time: "14:18", type: "alert", event: "Risk score 64 — warning threshold crossed" },
      { time: "14:22", type: "incident", event: "Incident INC-2025-0430-MUSHIN-002 created" },
      { time: "14:35", type: "approval", event: "Operator approved emergency node restart" },
      { time: "15:02", type: "recovery", event: "Node 7 restored, risk score dropped to 22" },
    ],
  },
];

export function getIncident(id: string): Incident | undefined {
  return INCIDENTS.find((inc) => inc.id === id);
}

// ─── Mitigation Options ───────────────────────────────────────────────────────

export const MITIGATION_OPTIONS: MitigationOption[] = [
  {
    id: "ACTION-001",
    name: "Traffic Reroute via Alternative Fibre",
    recommended: true,
    scoreAfter: 42,
    scoreDelta: -45,
    timeToEffect: 12,
    revenueSaved: 6200000,
    risk: "low",
    description: "Redirect traffic through the Surulere-Ikorodu fibre ring. Estimated 88% capacity restoration within 12 minutes.",
    steps: [
      "Isolate degraded fibre segment on zone 3A",
      "Update BGP routing tables across 4 PoPs",
      "Monitor traffic migration — expect 3 min convergence",
      "Validate QoS metrics on rerouted traffic",
    ],
  },
  {
    id: "ACTION-002",
    name: "Emergency BTS Generator Deploy",
    recommended: false,
    scoreAfter: 58,
    scoreDelta: -29,
    timeToEffect: 35,
    revenueSaved: 4100000,
    risk: "medium",
    description: "Deploy mobile generators to the 7 affected BTS sites. Resolves power instability but does not address fibre degradation.",
    steps: [
      "Dispatch 3 generator units from Ojota depot",
      "Site access coordination with field team",
      "Power handover — estimated 8 min per site",
      "Performance verification on each BTS",
    ],
  },
  {
    id: "ACTION-NONE",
    name: "Do Nothing — Monitor Only",
    recommended: false,
    scoreAfter: 96,
    scoreDelta: +9,
    timeToEffect: null,
    revenueSaved: -10800000,
    risk: "critical",
    description: "Continue monitoring without intervention. SLA breach expected within 47 minutes. Full NCC penalty applies.",
    steps: [],
  },
];

// ─── Agent Responses ──────────────────────────────────────────────────────────

export const AGENT_RESPONSES: Record<string, AgentResponse> = {
  network_risk: {
    agentRole: "network_risk",
    agentName: "NetworkRiskAgent",
    query: "Why is Ikeja high risk?",
    thinkingMs: 1840,
    facts: [
      { claim: "7 of 12 BTS sites in Ikeja are reporting power instability (23 active power alarms).", evidenceId: "bts_alarm_summary:IKEJA:latest" },
      { claim: "Packet loss has reached 34%, versus a 2% baseline — a 17× deviation.", evidenceId: "network_metrics:IKEJA:T-120m" },
      { claim: "End-to-end latency is 280ms, 6.2× above the 45ms SLA baseline.", evidenceId: "network_metrics:IKEJA:T-120m" },
      { claim: "342 subscriber complaints filed in the last 2 hours — 180% above the hourly baseline.", evidenceId: "complaint_feed:IKEJA:2h" },
    ],
    inferences: [
      { claim: "The compound pattern of concurrent fibre degradation and BTS power failure indicates a shared infrastructure fault — likely a power distribution failure upstream of the Ikeja zone 3A junction.", confidence: 0.87 },
      { claim: "Without intervention, the risk score trajectory projects a SLA breach within 47 minutes.", confidence: 0.91 },
    ],
    recommendations: [
      { action: "Run traffic reroute simulation via Surulere-Ikorodu fibre ring and prepare approval for ACTION-001.", requiresApproval: true },
      { action: "Dispatch field team to inspect the Ikeja zone 3A junction box — independent of traffic reroute.", requiresApproval: false },
    ],
    toolsCalled: ["get_incident_context", "get_signal_evidence"],
    validationStatus: "passed",
  },
  revenue_assurance: {
    agentRole: "revenue_assurance",
    agentName: "RevenueAssuranceAgent",
    query: "Are there revenue leakage signals in this incident?",
    thinkingMs: 2210,
    facts: [
      { claim: "Revenue velocity has dropped 23% below hourly baseline for Ikeja LGA.", evidenceId: "billing_stream:IKEJA:latest" },
      { claim: "Recharge transaction volume is down 18% in the last 90 minutes.", evidenceId: "recharge_feed:IKEJA:90m" },
      { claim: "312 enterprise lines are affected — NGN 4.3M of the NGN 8.7M at-risk revenue is enterprise-tier.", evidenceId: "impact_estimate:INC-2025-0502-IKEJA-001" },
      { claim: "Estimated compensation liability is NGN 2.1M based on SLA breach duration projection.", evidenceId: "impact_estimate:INC-2025-0502-IKEJA-001" },
    ],
    inferences: [
      { claim: "The billing velocity drop lags the network fault by ~8 minutes, consistent with session timeout patterns rather than active fraud.", confidence: 0.82 },
      { claim: "Enterprise line concentration in Ikeja zone 3A amplifies revenue impact — 17% of subscribers account for 49% of at-risk revenue.", confidence: 0.79 },
    ],
    recommendations: [
      { action: "Pre-authorise compensation credits for enterprise SLA customers before breach to reduce goodwill cost.", requiresApproval: true },
      { action: "Activate revenue assurance monitoring dashboard for real-time NGN impact tracking.", requiresApproval: false },
    ],
    toolsCalled: ["get_incident_context", "estimate_impact", "get_signal_evidence"],
    validationStatus: "passed",
  },
  customer_experience: {
    agentRole: "customer_experience",
    agentName: "CustomerExperienceAgent",
    query: "How many subscribers are affected?",
    thinkingMs: 1560,
    facts: [
      { claim: "18,420 subscribers are registered in the Ikeja LGA coverage zone.", evidenceId: "subscriber_registry:IKEJA" },
      { claim: "Active device sessions have dropped from 18,420 to 12,100 — 6,320 subscribers have lost connectivity.", evidenceId: "session_monitor:IKEJA:latest" },
      { claim: "342 complaints have been filed in 2 hours — a 180% increase over the rolling 30-day hourly baseline of 19 complaints/hour.", evidenceId: "complaint_feed:IKEJA:2h" },
      { claim: "312 enterprise lines are experiencing degraded service.", evidenceId: "enterprise_registry:IKEJA" },
    ],
    inferences: [
      { claim: "The 34% session drop implies approximately 6,320 subscribers are experiencing complete loss of service, not partial degradation.", confidence: 0.88 },
      { claim: "Complaint-to-affected-subscriber ratio (5.4%) is above the typical 2-3% threshold, suggesting broader awareness and higher customer dissatisfaction than session data alone indicates.", confidence: 0.74 },
    ],
    recommendations: [
      { action: "Trigger proactive SMS notification to all 18,420 Ikeja subscribers acknowledging the disruption.", requiresApproval: true },
      { action: "Flag enterprise line accounts for priority restoration verification post-mitigation.", requiresApproval: false },
    ],
    toolsCalled: ["get_incident_context", "get_signal_evidence"],
    validationStatus: "passed",
  },
  mitigation_planning: {
    agentRole: "mitigation_planning",
    agentName: "MitigationPlanningAgent",
    query: "What should we do now?",
    thinkingMs: 3120,
    facts: [
      { claim: "Pre-action simulation for ACTION-001 projects risk score drop from 87 → 42 within 12 minutes.", evidenceId: "simulation:ACTION-001:INC-2025-0502-IKEJA-001" },
      { claim: "Pre-action simulation for ACTION-002 projects risk score drop from 87 → 58 within 35 minutes.", evidenceId: "simulation:ACTION-002:INC-2025-0502-IKEJA-001" },
      { claim: "Playbook PLAY-FIBRE-REROUTE requires BGP update across 4 PoPs and has a 94% historical success rate.", evidenceId: "playbook_registry:PLAY-FIBRE-REROUTE" },
      { claim: "Do-nothing scenario projects breach at 87 → 96+ within 47 minutes, triggering full NCC Class B penalty.", evidenceId: "simulation:ACTION-NONE:INC-2025-0502-IKEJA-001" },
    ],
    inferences: [
      { claim: "ACTION-001 dominates ACTION-002 on score reduction speed (12 min vs 35 min) and revenue saved (NGN 6.2M vs NGN 4.1M) with lower operational risk.", confidence: 0.93 },
      { claim: "The fibre reroute is the faster and more effective resolution because the primary fault is fibre degradation, not BTS power — the generator deploy addresses a secondary cause only.", confidence: 0.89 },
    ],
    recommendations: [
      { action: "Approve ACTION-001: Traffic Reroute via Alternative Fibre immediately. Expected breach avoidance within 12 minutes.", requiresApproval: true },
      { action: "Queue ACTION-002 as a secondary measure post-reroute stabilisation to restore full BTS capacity.", requiresApproval: true },
    ],
    toolsCalled: ["get_incident_context", "get_mitigation_playbook", "run_pre_action_simulation", "write_investigation_note"],
    validationStatus: "passed",
  },
  compliance: {
    agentRole: "compliance",
    agentName: "ComplianceAgent",
    query: "What is our NCC exposure if this is not resolved?",
    thinkingMs: 2780,
    facts: [
      { claim: "NCC QoS regulations (NCC-QOS-2023-01) classify a >30% packet loss event exceeding 60 minutes as a Class B service failure.", evidenceId: "ncc_regulation:NCC-QOS-2023-01" },
      { claim: "Estimated NCC fine exposure for a Class B breach is NGN 5,000,000 per event.", evidenceId: "impact_estimate:INC-2025-0502-IKEJA-001" },
      { claim: "Current incident duration is 12 minutes. Breach threshold is 60 minutes. Time remaining: 47 minutes.", evidenceId: "incident_context:INC-2025-0502-IKEJA-001" },
      { claim: "Compensation liability to subscribers is estimated at NGN 2,100,000 based on SLA terms for 18,420 subscribers.", evidenceId: "impact_estimate:INC-2025-0502-IKEJA-001" },
    ],
    inferences: [
      { claim: "If unresolved within 47 minutes, total regulatory and compensation exposure will be NGN 7.1M (NGN 5M fine + NGN 2.1M compensation), in addition to NGN 8.7M revenue loss.", confidence: 0.91 },
      { claim: "Early resolution and documented human approval of mitigation action will support a regulatory defence of prompt corrective action, potentially reducing penalty class.", confidence: 0.76 },
    ],
    recommendations: [
      { action: "Generate NCC evidence pack immediately with current incident timeline, actions, and audit trail.", requiresApproval: false },
      { action: "Ensure operator approval of mitigation action is logged with timestamp for regulatory submission.", requiresApproval: false },
    ],
    toolsCalled: ["get_incident_context", "estimate_impact", "get_audit_trail", "generate_ncc_pack_draft"],
    validationStatus: "passed",
  },
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const AUDIT_LOG: AuditEntry[] = [
  { id: "AUD-001", timestamp: "2025-05-02T08:23:12Z", actor: "system", actorType: "system", action: "ANOMALY_DETECTED", detail: "Packet loss spike detected in Ikeja LGA — 34% (threshold: 5%)", incidentId: null },
  { id: "AUD-002", timestamp: "2025-05-02T08:26:04Z", actor: "system", actorType: "system", action: "RISK_THRESHOLD_CROSSED", detail: "Risk score 65 — warning threshold exceeded for Ikeja LGA", incidentId: null },
  { id: "AUD-003", timestamp: "2025-05-02T08:28:33Z", actor: "system", actorType: "system", action: "INCIDENT_CREATED", detail: "Incident INC-2025-0502-IKEJA-001 auto-created. Risk score: 87", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-004", timestamp: "2025-05-02T08:31:00Z", actor: "NetworkRiskAgent", actorType: "agent", action: "AGENT_TOOL_CALL", detail: "Called get_incident_context + get_signal_evidence. Returned 4 facts, 2 inferences. Validation: passed", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-005", timestamp: "2025-05-02T08:33:22Z", actor: "MitigationPlanningAgent", actorType: "agent", action: "SIMULATION_RUN", detail: "Pre-action simulation executed for ACTION-001 (→42) and ACTION-002 (→58). Playbook PLAY-FIBRE-REROUTE retrieved.", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-006", timestamp: "2025-05-02T08:33:55Z", actor: "ComplianceAgent", actorType: "agent", action: "COMPLIANCE_ANALYSIS", detail: "NCC exposure calculated: NGN 5M fine + NGN 2.1M compensation at breach. Evidence pack draft generated.", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-007", timestamp: "2025-05-02T08:35:47Z", actor: "favour.olaleru@mtn.ng", actorType: "operator", action: "ACTION_APPROVED", detail: "Operator approved ACTION-001: Traffic Reroute via Alternative Fibre. Score projection: 87→42 in 12 min.", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-008", timestamp: "2025-05-02T08:37:01Z", actor: "system", actorType: "system", action: "RECOVERY_INITIATED", detail: "Recovery mode activated — BGP reroute applied across 4 PoPs.", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-009", timestamp: "2025-05-02T08:49:18Z", actor: "system", actorType: "system", action: "RISK_SCORE_DROP", detail: "Risk score dropped from 87 → 42. Breach averted. Incident status: stabilised.", incidentId: "INC-2025-0502-IKEJA-001" },
  { id: "AUD-010", timestamp: "2025-04-30T14:11:33Z", actor: "system", actorType: "system", action: "ANOMALY_DETECTED", detail: "Congestion detected on Mushin node 7 post-maintenance window", incidentId: null },
  { id: "AUD-011", timestamp: "2025-04-30T14:22:08Z", actor: "system", actorType: "system", action: "INCIDENT_CREATED", detail: "Incident INC-2025-0430-MUSHIN-002 created. Risk score: 64", incidentId: "INC-2025-0430-MUSHIN-002" },
  { id: "AUD-012", timestamp: "2025-04-30T14:35:19Z", actor: "noc.team@mtn.ng", actorType: "operator", action: "ACTION_APPROVED", detail: "Operator approved emergency node 7 restart — Mushin.", incidentId: "INC-2025-0430-MUSHIN-002" },
  { id: "AUD-013", timestamp: "2025-04-30T15:02:44Z", actor: "system", actorType: "system", action: "INCIDENT_RESOLVED", detail: "Incident INC-2025-0430-MUSHIN-002 resolved. Risk score: 22.", incidentId: "INC-2025-0430-MUSHIN-002" },
];

// ─── Compliance Pack ──────────────────────────────────────────────────────────

export const COMPLIANCE_PACKS: Record<string, CompliancePack> = {
  "INC-2025-0502-IKEJA-001": {
    incidentId: "INC-2025-0502-IKEJA-001",
    generatedAt: "2025-05-02T09:15:00Z",
    reportRef: "NCC-RPT-2025-0502-001",
    status: "draft",
    incidentTimeline: [
      { time: "08:23", type: "detection", event: "Anomaly detected: packet loss 34% in Ikeja zone 3A" },
      { time: "08:28", type: "escalation", event: "Risk score 87 — critical threshold crossed" },
      { time: "08:28", type: "incident", event: "Incident auto-created — SLA breach clock started" },
      { time: "08:35", type: "approval", event: "Corrective action approved by authorised operator" },
      { time: "08:37", type: "recovery", event: "Mitigation applied — fibre reroute initiated" },
      { time: "08:49", type: "recovery", event: "Service restored — breach averted (26 min from detection)" },
    ],
    affectedServices: [
      "Voice calls (2G/3G/4G) — Ikeja LGA",
      "Mobile data (4G LTE) — Ikeja zone 3A",
      "Enterprise leased lines (312 circuits)",
      "SMS delivery — intermittent",
    ],
    kpis: {
      "Peak Packet Loss": "34%",
      "Peak Latency": "280ms",
      "Baseline Packet Loss": "2%",
      "Baseline Latency": "45ms",
      "Affected Subscribers": 18420,
      "Enterprise Lines Affected": 312,
      "Session Drop": "34%",
      "Incident Duration": "26 minutes",
      "Breach Threshold": "60 minutes",
      "Breach Avoided": "Yes",
    },
    rootCause:
      "Compound infrastructure failure in Ikeja zone 3A: simultaneous fibre degradation on the primary trunk and power instability across 7 of 12 BTS sites. Root cause attributed to upstream power distribution fault at the Ikeja zone 3A junction, which caused cascading BTS power alarms and increased load on an already-degraded fibre segment. No external force majeure events detected.",
    correctiveActions: [
      "BGP traffic reroute applied via Surulere-Ikorodu fibre ring — approved by operator at 08:35.",
      "Field team dispatched to Ikeja zone 3A junction for physical inspection.",
      "Emergency generator units queued for BTS power restoration (secondary measure).",
      "Enterprise SLA customers flagged for priority restoration verification.",
    ],
    compensationEstimate: {
      affectedSubscribers: 18420,
      slaBreachDurationMin: 0,
      estimatedCompensationNGN: 0,
      basisNote: "Breach averted at 26 minutes — below 60-minute SLA threshold. No mandatory compensation triggered. Goodwill credit recommended for enterprise accounts.",
    },
    evidenceLogs: [
      "AUD-001: System anomaly detection — 2025-05-02T08:23:12Z",
      "AUD-002: Risk threshold crossed — 2025-05-02T08:26:04Z",
      "AUD-003: Incident creation — 2025-05-02T08:28:33Z",
      "AUD-004: NetworkRiskAgent tool calls — 2025-05-02T08:31:00Z",
      "AUD-005: Simulation run — 2025-05-02T08:33:22Z",
      "AUD-006: Compliance analysis — 2025-05-02T08:33:55Z",
      "AUD-007: Operator approval — 2025-05-02T08:35:47Z",
      "AUD-008: Recovery initiated — 2025-05-02T08:37:01Z",
      "AUD-009: Risk score drop confirmed — 2025-05-02T08:49:18Z",
    ],
    regulatoryExposure: {
      applicableRegulation: "NCC-QOS-2023-01",
      eventClass: "Class B (avoided)",
      maxFineIfBreached: 5000000,
      actualFineExposure: 0,
      rationale: "Incident resolved in 26 minutes — below the 60-minute Class B threshold. Human-approved corrective action documented with full audit trail.",
    },
  },
};
