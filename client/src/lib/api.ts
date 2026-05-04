import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

export interface LGA {
  id: string;
  name: string;
  risk: number;
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
  facts: string;
  inferences: string;
  recommendations: string;
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
}

export interface CompliancePack {
  timeline: string;
  affectedServices: string[];
  kpis: string;
  impactedSubscribers: number;
  rootCause: string;
  correctiveActions: string;
  evidenceLogs: string;
}
