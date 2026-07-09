import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

interface RiskScore {
  lga_id: string;
  score: number;
  severity: "green" | "amber" | "red";
  confidence: number;
  time_to_breach_minutes: number | null;
  updated_at: string;
}

interface RiskMapResponse {
  scores: RiskScore[];
}

interface IncidentImpact {
  affected_subscribers: number;
  enterprise_lines: number;
  revenue_at_risk_ngn: number;
  compensation_exposure_ngn: number;
  ncc_exposure_summary: string;
}

interface IncidentResponse {
  incident_id: string;
  lga_id: string;
  cause: string;
  phase: "active" | "mitigating" | "recovery" | "resolved";
  opened_at: string;
  impact: IncidentImpact;
  risk_score: number | null;
  time_to_breach_minutes: number | null;
}

interface CopilotFact {
  claim: string;
  evidence_id: string;
}

interface CopilotInference {
  claim: string;
  confidence: number;
}

interface CopilotRecommendation {
  action: string;
  requires_approval: boolean;
}

interface CopilotApiResponse {
  agent_role: string;
  incident_id: string;
  answer?: string | null;
  facts: CopilotFact[];
  inferences: CopilotInference[];
  recommendations: CopilotRecommendation[];
  citations?: Array<{ evidence_id: string; label: string }>;
  tools_called: string[];
  validation_status: "passed" | "revised" | "rejected";
}

interface ActionProjectionApi {
  action_id: string;
  name: string;
  description: string;
  risk_reduction: number | null;
  projected_score_curve: number[];
  confidence: number;
  time_to_effect_minutes: number;
}

interface ActionSimulationApi {
  incident_id: string;
  do_nothing_curve: number[];
  actions: ActionProjectionApi[];
}

interface NCCPackTimelineApi {
  id: string;
  incident: IncidentResponse;
  timeline: string[];
  affected_services: string[];
  kpis: Record<string, number>;
  impacted_subscribers: number;
  root_cause: string;
  corrective_actions: string[];
  approval_history: unknown[];
  evidence_logs: string[];
}

export interface LGA {
  id: string;
  name: string;
  risk: number;
  severity: "green" | "amber" | "red";
  timeToBreach: string;
}

export interface Incident {
  id: string;
  cause: string;
  riskScore: number;
  timeToBreach: string;
  affectedSubscribers: number;
  enterpriseLines: number;
  revenueAtRisk: string;
  nccExposure: string;
  phase: "active" | "recovery";
  timeline: Array<{ time: string; event: string }>;
}

export interface CopilotResponse {
  answer: string;
  facts: string;
  inferences: string;
  recommendations: string;
  sources: Array<{ evidenceId: string; label: string }>;
  tools_called: string[];
  validation_status: string;
}

export interface MitigationAction {
  id: string;
  name: string;
  riskReduction: number;
  confidence: number;
  timeToEffect: string;
  description: string;
  projectedScoreCurve: number[];
}

export interface CompliancePack {
  incidentId: string;
  lgaId: string;
  cause: string;
  phase: string;
  openedAt: string;
  riskScore: number | null;
  timeToBreach: number | null;
  impactedSubscribers: number;
  enterpriseLines: number;
  revenueAtRisk: number;
  compensationExposure: number;
  nccExposureSummary: string;
  affectedServices: string[];
  kpis: Record<string, number>;
  timeline: string[];
  rootCause: string;
  correctiveActions: string[];
  evidenceLogs: string[];
}

import { LGA_NAMES } from "./lgas";
const lgaNames: Record<string, string> = LGA_NAMES;

const fmtMoney = (value: number): string => {
  if (Number.isNaN(value)) {
    return "₦0";
  }
  return `₦${Math.round(value).toLocaleString()}`;
};

const fmtMinutes = (minutes: number | null): string => {
  if (minutes === null) {
    return "N/A";
  }
  return `${minutes}m`;
};

export const parseRiskMap = (payload: RiskMapResponse | RiskScore[]): LGA[] => {
  const scores = "scores" in payload ? payload.scores : payload;
  return scores.map((score) => ({
    id: score.lga_id,
    name: lgaNames[score.lga_id] ?? score.lga_id,
    risk: score.score,
    severity: score.severity,
    timeToBreach: fmtMinutes(score.time_to_breach_minutes),
  }));
};

export const parseIncident = (payload: IncidentResponse): Incident => {
  const isRecovery = payload.phase === "mitigating" || payload.phase === "recovery";
  const phase = isRecovery ? "recovery" : "active";
  const ttb = payload.time_to_breach_minutes ?? (payload.phase === "active" ? 47 : 125);
  const riskScore = payload.risk_score ?? (payload.phase === "active" ? 87 : 42);

  return {
    id: payload.incident_id,
    cause: payload.cause,
    riskScore,
    timeToBreach: fmtMinutes(ttb),
    affectedSubscribers: payload.impact.affected_subscribers,
    enterpriseLines: payload.impact.enterprise_lines,
    revenueAtRisk: fmtMoney(payload.impact.revenue_at_risk_ngn),
    nccExposure: payload.impact.ncc_exposure_summary,
    phase,
    timeline: [
      {
        time: new Date(payload.opened_at).toISOString().slice(11, 16),
        event: `Incident opened for ${payload.cause}.`,
      },
      {
        time: "N/A",
        event: `Affected subscribers: ${payload.impact.affected_subscribers.toLocaleString()}.`,
      },
    ],
  };
};

export const parseCopilotResponse = (payload: CopilotApiResponse): CopilotResponse => ({
  answer:
    payload.answer ||
    payload.facts.map((item) => item.claim).slice(0, 2).join(" ") ||
    "No grounded answer was returned for this question.",
  facts: payload.facts.map((item) => `${item.claim} [${item.evidence_id}]`).join("\n"),
  inferences: payload.inferences.map((item) => `${item.claim} (${Math.round(item.confidence * 100)}%)`).join("\n"),
  recommendations: payload.recommendations
    .map((item) => `${item.action} ${item.requires_approval ? "[requires approval]" : ""}`)
    .join("\n"),
  sources: (payload.citations?.length ? payload.citations : payload.facts.map((item) => ({
    evidence_id: item.evidence_id,
    label: item.claim,
  }))).map((item) => ({
    evidenceId: item.evidence_id,
    label: item.label,
  })),
  tools_called: payload.tools_called,
  validation_status: payload.validation_status,
});

export const parseMitigationActions = (payload: ActionSimulationApi): MitigationAction[] => {
  return payload.actions.map((action) => ({
    id: action.action_id,
    name: action.name || action.action_id,
    riskReduction: Math.max(0, Math.round((action.risk_reduction ?? 0) * 100) / 100),
    confidence: action.confidence,
    timeToEffect: `${action.time_to_effect_minutes}m`,
    description: action.description || "Mitigation action",
    projectedScoreCurve: action.projected_score_curve,
  }));
};

export const parseCompliancePack = (payload: NCCPackTimelineApi): CompliancePack => ({
  incidentId: payload.incident.incident_id,
  lgaId: payload.incident.lga_id,
  cause: payload.incident.cause,
  phase: payload.incident.phase,
  openedAt: payload.incident.opened_at,
  riskScore: payload.incident.risk_score,
  timeToBreach: payload.incident.time_to_breach_minutes,
  impactedSubscribers: payload.impacted_subscribers,
  enterpriseLines: payload.incident.impact.enterprise_lines,
  revenueAtRisk: payload.incident.impact.revenue_at_risk_ngn,
  compensationExposure: payload.incident.impact.compensation_exposure_ngn,
  nccExposureSummary: payload.incident.impact.ncc_exposure_summary,
  affectedServices: payload.affected_services,
  kpis: payload.kpis,
  timeline: payload.timeline,
  rootCause: payload.root_cause,
  correctiveActions: payload.corrective_actions,
  evidenceLogs: payload.evidence_logs,
});

export async function fetchRiskMap(): Promise<LGA[]> {
  const response = await api.get<RiskMapResponse | RiskScore[]>("/risk/map");
  return parseRiskMap(response.data);
}

export async function fetchIncident(incidentId: string): Promise<Incident> {
  const response = await api.get<IncidentResponse>(`/incidents/${incidentId}`);
  return parseIncident(response.data);
}

export async function fetchCopilot(payload: { role: string; incident_id: string; query: string }): Promise<CopilotResponse> {
  const response = await api.post<CopilotApiResponse>("/copilot/query", payload);
  return parseCopilotResponse(response.data);
}

export async function fetchMitigationActions(incidentId: string): Promise<MitigationAction[]> {
  const response = await api.post<ActionSimulationApi>("/actions/simulate", { incident_id: incidentId, action_ids: [] });
  return parseMitigationActions(response.data);
}

export async function approveAction({ incidentId, actionId }: { incidentId: string | null; actionId: string }): Promise<void> {
  await api.post("/actions/approve", {
    incident_id: incidentId,
    action_id: actionId,
    operator: "demo-operator-001",
  });
}

export async function fetchCompliancePack(incidentId: string): Promise<CompliancePack> {
  const response = await api.get<NCCPackTimelineApi>(`/compliance/pack/${incidentId}`);
  return parseCompliancePack(response.data);
}
