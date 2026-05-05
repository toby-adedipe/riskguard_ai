export type RiskStatus = "critical" | "high" | "medium" | "low" | "safe";
export type SimulationPhase = "baseline" | "incident" | "mitigation" | "recovery";
export type IncidentStatus = "active" | "mitigating" | "resolved";
export type AgentRole = "network_risk" | "revenue_assurance" | "customer_experience" | "mitigation_planning" | "compliance";

export interface LGA {
  id: string;
  name: string;
  score: number;
  status: RiskStatus;
  subscribers: number;
  timeToBreach: number | null; // minutes, null if no breach expected
  hasActiveIncident: boolean;
  incidentId: string | null;
}

export interface SignalMetrics {
  network: {
    packetLoss: number;
    latency: number;
    baselinePacketLoss: number;
    baselineLatency: number;
  };
  bts: {
    unstableSites: number;
    totalSites: number;
    powerAlerts: number;
  };
  complaints: {
    count: number;
    changeLabel: string;
    ratePerHour: number;
  };
  sessions: {
    current: number;
    baseline: number;
    dropPct: number;
  };
  billing: {
    velocityDrop: number;
  };
  recharge: {
    volumeDecline: number;
  };
}

export interface TimelineEvent {
  time: string;
  type: "detection" | "alert" | "escalation" | "incident" | "agent" | "approval" | "recovery";
  event: string;
}

export interface Incident {
  id: string;
  lgaId: string;
  lgaName: string;
  status: IncidentStatus;
  riskScore: number;
  startTime: string;
  timeToBreach: number | null;
  subscribers: number;
  enterpriseLines: number;
  revenueAtRisk: number;
  compensationExposure: number;
  nccFineExposure: number;
  rootCause: string;
  signals: SignalMetrics;
  timeline: TimelineEvent[];
}

export interface MitigationOption {
  id: string;
  name: string;
  recommended: boolean;
  scoreAfter: number;
  scoreDelta: number;
  timeToEffect: number | null;
  revenueSaved: number;
  risk: "low" | "medium" | "critical";
  description: string;
  steps: string[];
}

export interface AgentFact {
  claim: string;
  evidenceId: string;
}

export interface AgentInference {
  claim: string;
  confidence: number;
}

export interface AgentRecommendation {
  action: string;
  requiresApproval: boolean;
}

export interface AgentResponse {
  agentRole: AgentRole;
  agentName: string;
  query: string;
  facts: AgentFact[];
  inferences: AgentInference[];
  recommendations: AgentRecommendation[];
  toolsCalled: string[];
  validationStatus: "passed" | "revised" | "failed";
  thinkingMs: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "system" | "agent" | "operator";
  action: string;
  detail: string;
  incidentId: string | null;
}

export interface ComplianceSection {
  label: string;
  content: string | string[] | Record<string, unknown>;
}

export interface CompliancePack {
  incidentId: string;
  generatedAt: string;
  reportRef: string;
  status: "draft" | "final";
  incidentTimeline: TimelineEvent[];
  affectedServices: string[];
  kpis: Record<string, string | number>;
  rootCause: string;
  correctiveActions: string[];
  compensationEstimate: Record<string, number | string>;
  evidenceLogs: string[];
  regulatoryExposure: Record<string, string | number>;
}
