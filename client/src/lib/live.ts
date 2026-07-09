/**
 * Dormant transport/reducer prototype for the retired investigation stream.
 * It is not part of the active app graph; see components/live/README.md.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  ClipboardCheck,
  Compass,
  Radio,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api } from "./api";

export type LiveEvent =
  | TickEvent
  | IncidentOpenedEvent
  | WakeEvent
  | RoleStartEvent
  | RoleCompleteEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | FactEvent
  | InferenceEvent
  | RecommendationEvent
  | ReportReadyEvent
  | CompleteEvent
  | SessionStartedEvent
  | ThresholdNotMetEvent
  | OrchestratorThoughtEvent
  | ErrorEvent;

interface BaseEvent {
  id: number;
  ts: number;
  session_id: string | null;
}

export interface TickSignal {
  site_id: string;
  domain: string;
  domain_label: string;
  metric: string;
  value: number;
  value_str: string;
  z_score: number;
}

export interface FeedSignal extends TickSignal {
  uid: number;
}

export interface TickEvent extends BaseEvent {
  type: "tick";
  tick: number;
  score: number;
  severity: "green" | "amber" | "red";
  ttb_minutes: number | null;
  confidence: number;
  signals: TickSignal[];
  domain_z_scores: Record<string, number>;
}

export interface IncidentOpenedEvent extends BaseEvent {
  type: "incident_opened";
  incident_id: string;
  lga_id: string;
  cause: string;
  score: number;
}

export interface WakeEvent extends BaseEvent {
  type: "wake";
  incident_id: string;
  score: number;
  message: string;
}

export interface RoleStartEvent extends BaseEvent {
  type: "role_start";
  role: string;
  role_label: string;
}

export interface RoleCompleteEvent extends BaseEvent {
  type: "role_complete";
  role: string;
  role_label: string;
  synthesis?: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool_call";
  role: string;
  role_label: string;
  tool: string;
  description: string;
  args: string;
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool_result";
  role: string;
  role_label: string;
  tool: string;
  summary: string;
}

export interface ToolErrorEvent extends BaseEvent {
  type: "tool_error";
  role: string;
  tool: string;
  error: string;
}

export interface FactEvent extends BaseEvent {
  type: "fact";
  role: string;
  role_label: string;
  claim: string;
  evidence_id: string;
}

export interface InferenceEvent extends BaseEvent {
  type: "inference";
  role: string;
  role_label: string;
  claim: string;
  confidence: number;
}

export interface RecommendationEvent extends BaseEvent {
  type: "recommendation";
  role: string;
  role_label: string;
  action: string;
  action_label: string;
  requires_approval: boolean;
}

export interface ReportReadyEvent extends BaseEvent {
  type: "report_ready";
  harness_run_id: string;
  incident_id: string;
  summary: string;
  selected_roles: string[];
  recommended_action: string | null;
  recommended_action_label: string | null;
  do_nothing_curve: number[] | null;
  recovery_curve: number[] | null;
  evidence_count: number;
}

export interface CompleteEvent extends BaseEvent {
  type: "complete";
  status: "ok" | "failed";
  harness_run_id?: string;
}

export interface SessionStartedEvent extends BaseEvent {
  type: "session_started";
  incident_id: string;
  lga_id: string;
  cause: string;
}

export interface ThresholdNotMetEvent extends BaseEvent {
  type: "threshold_not_met";
  incident_id: string;
  peak_score: number;
  threshold: number;
  message: string;
}

export interface OrchestratorThoughtEvent extends BaseEvent {
  type: "orchestrator_thought";
  text: string;
  target_role?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  message: string;
}

interface EventsResponse {
  session_id: string | null;
  events: LiveEvent[];
  last_event_id: number;
}

export type Phase =
  | "idle"
  | "telemetry"
  | "wake"
  | "investigating"
  | "report"
  | "complete";

export interface RoleState {
  role: string;
  label: string;
  status: "pending" | "running" | "done";
  firstSeenId: number;
  latestEventId: number;
  synthesis: string | null;
  toolCalls: Array<{
    id: number;
    description: string;
    summary: string | null;
    args: string;
  }>;
  facts: Array<{ id: number; claim: string; evidenceId: string }>;
  inferences: Array<{ id: number; claim: string; confidence: number }>;
  recommendations: Array<{
    id: number;
    action: string;
    label: string;
    requiresApproval: boolean;
  }>;
}

export interface OrchestratorThought {
  id: number;
  text: string;
  targetRole?: string;
}

export interface LiveState {
  phase: Phase;
  score: number;
  severity: "green" | "amber" | "red";
  ttbMinutes: number | null;
  confidence: number;
  domainZScores: Record<string, number>;
  signalFeed: FeedSignal[];
  signalCounter: number;
  incidentOpened: boolean;
  wakeMessage: string | null;
  roles: RoleState[];
  thoughts: OrchestratorThought[];
  report: ReportReadyEvent | null;
  thresholdBlocked: ThresholdNotMetEvent | null;
  complete: boolean;
  totalTicks: number;
  ticksSeen: number;
  error: string | null;
  maxAppliedId: number;
}

const TARGET_TICKS = 13;
const TARGET_ROLES = 6;

export const ROLE_COPY: Record<
  string,
  { label: string; mission: string; icon: LucideIcon }
> = {
  network_risk: {
    label: "Network Risk",
    mission: "Verify the network failure pattern across cells & BTS",
    icon: Radio,
  },
  revenue_assurance: {
    label: "Revenue Assurance",
    mission: "Quantify exposure to revenue & enterprise lines",
    icon: Banknote,
  },
  customer_experience: {
    label: "Customer Experience",
    mission: "Estimate subscriber impact and complaint pressure",
    icon: Users,
  },
  mitigation: {
    label: "Mitigation Planner",
    mission: "Choose the strongest action against do-nothing baseline",
    icon: Zap,
  },
  compliance: {
    label: "Compliance Officer",
    mission: "Pre-stage NCC pack and validate every claim",
    icon: ClipboardCheck,
  },
  investigation_harness: {
    label: "Orchestrator Context",
    mission: "Gather trigger context before dispatching specialists",
    icon: Compass,
  },
};

// Human-readable phrasing helpers used by the live investigation view so the
// telemetry stream and tool log feel like sentences instead of raw payloads.
const METRIC_LABELS: Record<string, string> = {
  drop_rate: "RAN drop rate",
  call_setup_failure: "call-setup failure rate",
  prb_utilization: "PRB utilization",
  bts_alarm_rate: "BTS alarm rate",
  enb_handover_failure: "eNB handover failures",
  customer_complaints: "customer complaints",
  msisdn_failures: "MSISDN failures",
  social_posts_per_hr: "social media outage posts",
  negative_sentiment_score: "negative social sentiment",
  voice_traffic: "voice traffic",
  data_throughput: "data throughput",
  enterprise_outages: "enterprise line outages",
  payment_failures: "payment failures",
  revenue_per_minute: "revenue per minute",
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, " ");
}

function direction(z: number): string {
  const absZ = Math.abs(z);
  if (z >= 0) return `${absZ.toFixed(1)}x higher than normal`;
  return `${absZ.toFixed(1)}x lower than normal`;
}

export function humanizeSignal(signal: TickSignal): string {
  return `${signal.site_id} — ${metricLabel(signal.metric)} at ${signal.value_str} (${direction(
    signal.z_score,
  )})`;
}

export function humanizeRoleStart(roleLabel: string): string {
  return `${roleLabel} agent dispatched — beginning investigation.`;
}

export function humanizeRoleComplete(
  roleLabel: string,
  synthesis?: string | null,
): string {
  if (synthesis && synthesis.trim().length > 0) {
    return `${roleLabel} agent finished: ${synthesis}`;
  }
  return `${roleLabel} agent finished its investigation.`;
}

function blankRole(role: string, firstSeenId: number): RoleState {
  return {
    role,
    label: ROLE_COPY[role]?.label ?? role,
    status: "running",
    firstSeenId,
    latestEventId: firstSeenId,
    synthesis: null,
    toolCalls: [],
    facts: [],
    inferences: [],
    recommendations: [],
  };
}

function initialState(): LiveState {
  return {
    phase: "idle",
    score: 12,
    severity: "green",
    ttbMinutes: null,
    confidence: 0.6,
    domainZScores: {},
    signalFeed: [],
    signalCounter: 0,
    incidentOpened: false,
    wakeMessage: null,
    roles: [],
    thoughts: [],
    report: null,
    thresholdBlocked: null,
    complete: false,
    totalTicks: TARGET_TICKS,
    ticksSeen: 0,
    error: null,
    maxAppliedId: 0,
  };
}

function reduce(state: LiveState, event: LiveEvent): LiveState {
  // Idempotency guard: each event has a monotonic id and we never re-process
  // an id we've already applied. This protects against StrictMode double
  // mounting, retries, and overlapping polls.
  if (event.id <= state.maxAppliedId) return state;
  state = { ...state, maxAppliedId: event.id };
  switch (event.type) {
    case "session_started":
      return { ...state, phase: "telemetry" };
    case "threshold_not_met":
      return {
        ...state,
        thresholdBlocked: event,
      };
    case "tick": {
      let counter = state.signalCounter;
      const tagged: FeedSignal[] = event.signals.map((signal) => {
        counter += 1;
        return { ...signal, uid: counter };
      });
      const signals = state.signalFeed.concat(tagged).slice(-30);
      return {
        ...state,
        phase: state.phase === "idle" ? "telemetry" : state.phase,
        score: event.score,
        severity: event.severity,
        ttbMinutes: event.ttb_minutes,
        confidence: event.confidence,
        domainZScores: event.domain_z_scores,
        signalFeed: signals,
        signalCounter: counter,
        ticksSeen: Math.max(state.ticksSeen, event.tick + 1),
      };
    }
    case "incident_opened":
      return { ...state, incidentOpened: true };
    case "wake":
      return {
        ...state,
        phase: "wake",
        wakeMessage: event.message,
      };
    case "role_start": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        status: "running",
        latestEventId: event.id,
      }));
      return { ...state, phase: "investigating", roles };
    }
    case "role_complete": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        status: "done",
        latestEventId: event.id,
        synthesis: event.synthesis ?? role.synthesis,
      }));
      return { ...state, roles };
    }
    case "tool_call": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        status: "running",
        latestEventId: event.id,
        toolCalls: role.toolCalls.concat({
          id: event.id,
          description: event.description,
          summary: null,
          args: event.args,
        }),
      }));
      return { ...state, phase: "investigating", roles };
    }
    case "tool_result": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => {
        const calls = [...role.toolCalls];
        for (let i = calls.length - 1; i >= 0; i -= 1) {
          if (calls[i].summary === null) {
            calls[i] = { ...calls[i], summary: event.summary };
            break;
          }
        }
        return { ...role, latestEventId: event.id, toolCalls: calls };
      });
      return { ...state, roles };
    }
    case "fact": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        latestEventId: event.id,
        facts: role.facts.concat({
          id: event.id,
          claim: event.claim,
          evidenceId: event.evidence_id,
        }),
      }));
      return { ...state, roles };
    }
    case "inference": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        latestEventId: event.id,
        inferences: role.inferences.concat({
          id: event.id,
          claim: event.claim,
          confidence: event.confidence,
        }),
      }));
      return { ...state, roles };
    }
    case "recommendation": {
      const roles = upsertRole(state.roles, event.role, event.id, (role) => ({
        ...role,
        latestEventId: event.id,
        recommendations: role.recommendations.concat({
          id: event.id,
          action: event.action,
          label: event.action_label,
          requiresApproval: event.requires_approval,
        }),
      }));
      return { ...state, roles };
    }
    case "orchestrator_thought":
      return {
        ...state,
        thoughts: state.thoughts.concat({
          id: event.id,
          text: event.text,
          targetRole: event.target_role,
        }),
      };
    case "report_ready":
      return { ...state, phase: "report", report: event };
    case "complete":
      return { ...state, phase: "complete", complete: true };
    case "error":
      return { ...state, error: event.message };
    default:
      return state;
  }
}

function upsertRole(
  roles: RoleState[],
  role: string,
  eventId: number,
  update: (role: RoleState) => RoleState,
): RoleState[] {
  if (!ROLE_COPY[role]) return roles;
  let found = false;
  const next = roles.map((existing) => {
    if (existing.role === role) {
      found = true;
      return update(existing);
    }
    return existing;
  });
  if (!found) next.push(update(blankRole(role, eventId)));
  return next;
}

export interface AgentThreadItem {
  kind: "thought" | "role";
  sortId: number;
  thought?: OrchestratorThought;
  role?: RoleState;
}

export function buildAgentThread(state: LiveState): AgentThreadItem[] {
  const items: AgentThreadItem[] = [];
  for (const thought of state.thoughts) {
    items.push({ kind: "thought", sortId: thought.id, thought });
  }
  for (const role of state.roles) {
    items.push({ kind: "role", sortId: role.latestEventId, role });
  }
  items.sort((a, b) => a.sortId - b.sortId);
  return items;
}

const STORAGE_PREFIX = "rg_live_";

function storageKey(sid: string) {
  return `${STORAGE_PREFIX}${sid}`;
}

function loadPersistedState(sessionId: string): LiveState | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as LiveState;
  } catch {
    return null;
  }
}

function persistState(sessionId: string, state: LiveState) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

function clearPersistedState(sessionId: string) {
  localStorage.removeItem(storageKey(sessionId));
}

export function useLiveStream(sessionId: string | null): {
  state: LiveState;
  reset: () => void;
} {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<LiveState>(() => {
    if (!sessionId) return initialState();
    return loadPersistedState(sessionId) ?? initialState();
  });
  const lastEventIdRef = useRef(
    sessionId ? (loadPersistedState(sessionId)?.maxAppliedId ?? 0) : 0,
  );
  const stoppedRef = useRef(false);

  const reset = useCallback(() => {
    if (sessionId) clearPersistedState(sessionId);
    setVersion((v) => v + 1);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const stored = version === 0 ? loadPersistedState(sessionId) : null;
    const initState = stored ?? initialState();
    setState(initState);
    lastEventIdRef.current = stored?.maxAppliedId ?? 0;
    stoppedRef.current = false;

    let timer: number | null = null;

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const { data } = await api.get<EventsResponse>(
          `/simulation/events?since=${lastEventIdRef.current}&session_id=${encodeURIComponent(
            sessionId,
          )}`,
        );

        if (data.session_id !== sessionId) {
          stoppedRef.current = true;
          return;
        }

        if (data.events.length > 0) {
          lastEventIdRef.current = data.last_event_id;
          setState((prev) => {
            const next = data.events.reduce(reduce, prev);
            persistState(sessionId, next);
            return next;
          });
        }

        const lastType = data.events[data.events.length - 1]?.type;
        if (lastType === "complete") {
          stoppedRef.current = true;
          return;
        }
      } catch {
        // Silent; retry on next tick.
      }
      timer = window.setTimeout(poll, 350);
    };

    poll();

    return () => {
      stoppedRef.current = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [sessionId, version]);

  return { state, reset };
}

export function useDerivedRoleProgress(state: LiveState) {
  return useMemo(() => {
    const total = TARGET_ROLES;
    const done = state.roles.filter((role) => role.status === "done").length;
    const running = state.roles.find((role) => role.status === "running");
    return { total, done, running };
  }, [state.roles]);
}
