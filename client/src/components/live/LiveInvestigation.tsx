import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildAgentThread,
  humanizeRoleComplete,
  humanizeRoleStart,
  humanizeSignal,
  LiveState,
  ROLE_COPY,
  RoleState,
  useDerivedRoleProgress,
  useLiveStream,
} from "../../lib/live";
import {
  CopilotResponse,
  approveAction,
  downloadInvestigationDocument,
  fetchCopilot,
} from "../../lib/api";
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Download,
  Loader2,
  Radio,
  Send,
  Sparkles,
} from "lucide-react";

interface LiveInvestigationProps {
  sessionId: string;
  incidentId: string | null;
  onDismiss: () => void;
}

const PHASE_COPY: Record<LiveState["phase"], { label: string; sub: string }> = {
  idle: { label: "Standing by", sub: "Awaiting trigger" },
  telemetry: { label: "Telemetry climbing", sub: "Streaming live signals from Ikeja" },
  wake: { label: "Agent activated", sub: "Risk threshold breached" },
  investigating: { label: "Specialists investigating", sub: "Tools executing in real time" },
  report: { label: "Report compiled", sub: "Recommendation ready for approval" },
  complete: { label: "Investigation complete", sub: "Operator decision required" },
};

export function LiveInvestigation({
  sessionId,
  incidentId,
  onDismiss,
}: LiveInvestigationProps) {
  const state = useLiveStream(sessionId);
  const progress = useDerivedRoleProgress(state);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background">
      <Header state={state} onDismiss={onDismiss} progress={progress} />

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 px-6 py-4 overflow-hidden">
        <main className="col-span-12 lg:col-span-8 overflow-y-auto pr-1 space-y-4">
          {state.report && state.complete && (
            <FinalReportBanner state={state} sessionId={sessionId} onDismiss={onDismiss} />
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 md:col-span-1">
              <ScoreGauge state={state} />
            </div>
            <div className="col-span-3 md:col-span-2">
              <DomainBreakdown state={state} />
            </div>
          </div>

          <TelemetryFeed state={state} />
        </main>

        <aside className="col-span-12 lg:col-span-4 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden min-h-0">
          <AgentSidePanel state={state} incidentId={incidentId} />
        </aside>
      </div>
    </div>
  );
}

function Header({
  state,
  progress,
  onDismiss,
}: {
  state: LiveState;
  progress: { total: number; done: number };
  onDismiss: () => void;
}) {
  const phase = state.thresholdBlocked
    ? { label: "Monitoring complete", sub: "Agent threshold not reached" }
    : PHASE_COPY[state.phase];
  return (
    <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={13} />
          Dashboard
        </button>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Sparkles size={16} className="text-blue-600" />
            {state.phase !== "complete" && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">
              Live Investigation · INC-2025-IKEJA-001
            </p>
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {phase.label}
              <span className="text-slate-400 font-normal"> · {phase.sub}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <PhaseTimeline state={state} />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
          <Activity size={12} className="text-slate-500" />
          <span className="text-[11px] font-mono text-slate-600">
            {progress.done}/{progress.total} agents
          </span>
        </div>
      </div>
    </header>
  );
}

function PhaseTimeline({ state }: { state: LiveState }) {
  const steps = [
    { id: "telemetry", label: "Telemetry" },
    { id: "wake", label: "Wake" },
    { id: "investigating", label: "Investigation" },
    { id: "report", label: "Report" },
  ] as const;
  const order: Record<string, number> = {
    idle: 0,
    telemetry: 1,
    wake: 2,
    investigating: 3,
    report: 4,
    complete: 4,
  };
  const cursor = order[state.phase] ?? 0;

  return (
    <div className="hidden md:flex items-center gap-1.5">
      {steps.map((step, i) => {
        const idx = i + 1;
        const active = idx === cursor;
        const done = idx < cursor;
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
                active
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <div
                className={`w-1 h-1 rounded-full ${
                  active ? "bg-blue-500 animate-pulse" : done ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && <ChevronRight size={11} className="text-slate-300" />}
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ state }: { state: LiveState }) {
  const size = 200;
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(state.score / 100, 1);
  const offset = circumference * (1 - pct);

  const color =
    state.severity === "red"
      ? "#DC2626"
      : state.severity === "amber"
        ? "#F59E0B"
        : "#16A34A";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center h-full">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">
        Live risk score
      </p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth={10}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            animate={{ strokeDashoffset: offset, stroke: color }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={state.score}
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="text-[44px] font-semibold font-mono tracking-tight leading-none"
            style={{ color }}
          >
            {Math.round(state.score)}
          </motion.span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-1">
            of 100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-slate-100">
        <Stat label="Severity" value={state.severity.toUpperCase()} tone={state.severity} />
        <Stat
          label="TTB"
          value={state.ttbMinutes !== null ? `${state.ttbMinutes}m` : "—"}
          tone={state.severity === "red" ? "red" : "neutral"}
        />
        <Stat
          label="Confidence"
          value={`${Math.round(state.confidence * 100)}%`}
          tone="neutral"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "green" | "neutral";
}) {
  const color = {
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-emerald-600",
    neutral: "text-slate-900",
  }[tone];

  return (
    <div className="flex flex-col items-center">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className={`text-sm font-mono font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function DomainBreakdown({ state }: { state: LiveState }) {
  const domains = Object.entries(state.domainZScores);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Domain anomaly stack
        </p>
        <span className="text-[10px] font-mono text-slate-400">
          {domains.length} domains tracked
        </span>
      </div>
      <div className="space-y-3">
        {domains.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            Awaiting first telemetry tick…
          </p>
        )}
        {domains.map(([domain, z]) => {
          const intensity = Math.min(Math.abs(z) / 7, 1);
          const tone =
            intensity > 0.7
              ? "bg-red-500"
              : intensity > 0.4
                ? "bg-amber-400"
                : "bg-emerald-500";
          return (
            <div key={domain}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-700 capitalize font-medium">
                  {domain.replace(/_/g, " ")}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  z = {z >= 0 ? "+" : ""}
                  {z.toFixed(2)}σ
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={`${tone} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${intensity * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ height: "100%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TelemetryFeed({ state }: { state: LiveState }) {
  const recent = useMemo(() => state.signalFeed.slice(-30).reverse(), [state.signalFeed]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">Live telemetry stream</p>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {state.signalFeed.length} signals captured
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-4 space-y-2">
        {recent.length === 0 && (
          <p className="text-xs text-slate-400 italic px-2">
            No signals yet. Telemetry will appear here as Ikeja sites report in.
          </p>
        )}
        <AnimatePresence initial={false}>
          {recent.map((signal) => {
            const intensity = Math.min(Math.abs(signal.z_score) / 7, 1);
            const tone =
              intensity > 0.7
                ? "border-red-200 bg-red-50 text-red-900"
                : intensity > 0.4
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900";
            return (
              <motion.div
                key={signal.uid}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`border rounded-lg px-3 py-2 ${tone}`}
              >
                <p className="text-xs leading-snug">{humanizeSignal(signal)}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {state.incidentOpened && (
        <div className="px-5 py-3 border-t border-red-200 bg-red-50">
          <p className="text-xs font-medium text-red-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Incident opened · INC-2025-IKEJA-001
          </p>
        </div>
      )}
    </div>
  );
}

function AgentSidePanel({
  state,
  incidentId,
}: {
  state: LiveState;
  incidentId: string | null;
}) {
  return (
    <>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-none">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Agent activity</p>
            <p className="text-[11px] text-slate-500">
              {state.thoughts.length} thoughts · {state.roles.length} dispatches
            </p>
          </div>
        </div>
        {state.phase === "investigating" && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 border border-blue-200">
            <Loader2 size={10} className="animate-spin text-blue-600" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-700">
              Reasoning
            </span>
          </span>
        )}
      </div>

      <AgentTimeline state={state} />
      <CopilotChat state={state} incidentId={incidentId} />
    </>
  );
}

function AgentTimeline({ state }: { state: LiveState }) {
  const thread = useMemo(() => buildAgentThread(state), [state]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [thread.length, state.roles]);

  const showWaiting = thread.length === 0 && state.phase === "telemetry";
  const showActivating = thread.length === 0 && state.phase === "wake";

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
      {showWaiting && (
        <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
          Orchestrator dormant — will wake once the score crosses the multi-domain
          anomaly threshold.
        </div>
      )}
      {showActivating && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-blue-200 bg-blue-50 rounded-lg text-center text-blue-700 text-xs flex items-center justify-center gap-2"
        >
          <Loader2 size={14} className="animate-spin" />
          Orchestrator activating — choosing specialists…
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {thread.map((item) =>
          item.kind === "thought" ? (
            <motion.div
              key={`thought-${item.thought!.id}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex gap-2.5 p-3 rounded-lg border border-blue-100 bg-blue-50/60"
            >
              <Brain size={13} className="text-blue-600 flex-none mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-700/80 mb-0.5">
                  Orchestrator thought
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {item.thought!.text}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`role-${item.role!.role}`}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
            >
              <RoleCard role={item.role!} />
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleCard({ role }: { role: RoleState }) {
  const meta = ROLE_COPY[role.role];
  if (!meta) return null;
  const Icon = meta.icon;

  const isActive = role.status === "running";
  const isDone = role.status === "done";

  const containerTone = isActive
    ? "border-blue-200 bg-white shadow-[0_2px_12px_rgba(37,99,235,0.06)]"
    : isDone
      ? "border-emerald-200 bg-emerald-50/30"
      : "border-slate-200 bg-slate-50/40";

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${containerTone}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center ${
              isActive
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : isDone
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-slate-50 text-slate-400 border border-slate-100"
            }`}
          >
            <Icon size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {meta.label}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {humanizeRoleStart(meta.label)}
            </p>
          </div>
        </div>
        <RoleStatusPill status={role.status} />
      </div>

      {(role.toolCalls.length > 0 ||
        role.facts.length > 0 ||
        role.inferences.length > 0 ||
        role.recommendations.length > 0) && (
        <div className="p-3 space-y-2.5">
          {role.toolCalls.map((call) => {
            const isPending = call.summary === null;
            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-1 px-2.5 py-2 rounded border border-slate-100 bg-white text-[11px]"
              >
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <Loader2 size={10} className="animate-spin text-blue-600 flex-none" />
                  ) : (
                    <CheckCircle2 size={10} className="text-emerald-600 flex-none" />
                  )}
                  <span className="text-slate-700 truncate flex-1">{call.description}</span>
                </div>
                {call.summary && (
                  <span className="text-[10px] text-slate-500 pl-5 leading-snug">
                    → {call.summary}
                  </span>
                )}
              </motion.div>
            );
          })}

          {role.facts.length > 0 && (
            <div className="space-y-1">
              {role.facts.map((fact) => (
                <div key={fact.id} className="flex gap-2 text-xs">
                  <span className="text-blue-600 mt-0.5">●</span>
                  <span className="text-slate-700 leading-snug">{fact.claim}</span>
                </div>
              ))}
            </div>
          )}

          {role.inferences.length > 0 && (
            <div className="space-y-1">
              {role.inferences.map((inf) => (
                <div key={inf.id} className="flex gap-2 text-xs">
                  <span className="text-amber-600 mt-0.5">◇</span>
                  <span className="text-slate-700 italic leading-snug">
                    {inf.claim}{" "}
                    <span className="not-italic text-slate-400 font-mono text-[10px]">
                      ({Math.round(inf.confidence * 100)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {role.recommendations.length > 0 && (
            <div className="space-y-1">
              {role.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-200"
                >
                  <span className="text-xs font-semibold text-emerald-800">
                    {rec.label}
                  </span>
                  {rec.requiresApproval && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-700/80">
                      needs approval
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {role.synthesis && isDone && (
        <div className="px-3 py-2 border-t border-emerald-200 bg-emerald-50">
          <p className="text-[11px] text-emerald-800 leading-snug">
            {humanizeRoleComplete(meta.label, role.synthesis)}
          </p>
        </div>
      )}
    </div>
  );
}

function RoleStatusPill({ status }: { status: RoleState["status"] }) {
  if (status === "running") {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
        <Loader2 size={9} className="animate-spin text-blue-600" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-700">
          Working
        </span>
      </div>
    );
  }
  if (status === "done") {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
        <CheckCircle2 size={9} className="text-emerald-600" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-emerald-700">
          Done
        </span>
      </div>
    );
  }
  return (
    <div className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        Idle
      </span>
    </div>
  );
}

interface ChatMessage {
  id: number;
  who: "user" | "assistant";
  text: string;
  role?: string;
  response?: CopilotResponse;
}

const CHAT_ROLES = [
  { id: "network_risk", label: "Network Risk" },
  { id: "revenue_assurance", label: "Revenue Assurance" },
  { id: "customer_experience", label: "Customer Experience" },
  { id: "mitigation", label: "Mitigation" },
  { id: "compliance", label: "Compliance" },
];

function CopilotChat({
  state,
  incidentId,
}: {
  state: LiveState;
  incidentId: string | null;
}) {
  const [role, setRole] = useState<string>("network_risk");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const idRef = useRef(0);

  const enabled = state.complete && incidentId !== null && !state.thresholdBlocked;

  const mutation = useMutation({
    mutationFn: (payload: { role: string; query: string; incident_id: string }) =>
      fetchCopilot(payload),
    onSuccess: (data, variables) => {
      idRef.current += 1;
      setMessages((prev) =>
        prev.concat({
          id: idRef.current,
          who: "assistant",
          text: "",
          role: variables.role,
          response: data,
        }),
      );
    },
    onError: (err) => {
      idRef.current += 1;
      setMessages((prev) =>
        prev.concat({
          id: idRef.current,
          who: "assistant",
          text: `Sorry — copilot request failed (${(err as Error).message}).`,
        }),
      );
    },
  });

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!enabled || !draft.trim() || !incidentId) return;
    idRef.current += 1;
    setMessages((prev) =>
      prev.concat({ id: idRef.current, who: "user", text: draft.trim(), role }),
    );
    mutation.mutate({ role, incident_id: incidentId, query: draft.trim() });
    setDraft("");
  };

  const placeholder = enabled
    ? "Ask the copilot about the incident…"
    : state.thresholdBlocked
      ? "Copilot held — selected agent threshold was not reached."
    : state.complete
      ? "Chat unavailable — no incident bound."
      : "Available once the investigation completes.";

  return (
    <div className="border-t border-slate-100 bg-slate-50 flex-none">
      {messages.length > 0 && (
        <div className="max-h-[220px] overflow-y-auto px-4 py-3 space-y-2.5 border-b border-slate-100">
          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatBubble msg={msg} />
            </div>
          ))}
          {mutation.isPending && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pl-1">
              <Loader2 size={11} className="animate-spin" />
              Copilot is thinking…
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-slate-500" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!enabled}
            className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          >
            {CHAT_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                Ask the {r.label} agent
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={!enabled || mutation.isPending}
            className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!enabled || mutation.isPending || !draft.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send size={12} />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.who === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 bg-blue-600 text-white rounded-lg rounded-br-sm text-xs leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  if (!msg.response) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg rounded-bl-sm text-xs leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  const roleLabel = CHAT_ROLES.find((r) => r.id === msg.role)?.label ?? msg.role;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg rounded-bl-sm text-xs space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
          <span className="font-semibold text-slate-500">{roleLabel} agent</span>
          <span
            className={`px-1.5 py-0.5 rounded-full font-mono ${
              msg.response.validation_status === "passed"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : msg.response.validation_status === "revised"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {msg.response.validation_status}
          </span>
        </div>

        <p className="text-[12px] leading-relaxed text-slate-800">
          {msg.response.answer}
        </p>

        {msg.response.facts && (
          <CopilotBlock label="Facts" tone="blue" body={msg.response.facts} />
        )}
        {msg.response.inferences && (
          <CopilotBlock label="Inferences" tone="amber" body={msg.response.inferences} />
        )}
        {msg.response.recommendations && (
          <CopilotBlock
            label="Recommendations"
            tone="emerald"
            body={msg.response.recommendations}
          />
        )}
        {msg.response.sources.length > 0 && (
          <div className="pt-1 border-t border-slate-100">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {msg.response.sources.map((source) => (
                <span
                  key={source.evidenceId}
                  title={source.label}
                  className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-mono text-slate-600"
                >
                  {source.evidenceId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopilotBlock({
  label,
  tone,
  body,
}: {
  label: string;
  tone: "blue" | "amber" | "emerald";
  body: string;
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50/60 text-blue-900",
    amber: "border-amber-100 bg-amber-50/60 text-amber-900",
    emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-900",
  }[tone];
  return (
    <div className={`border rounded p-2 text-[11px] leading-relaxed ${styles}`}>
      <p className="text-[9px] font-semibold uppercase tracking-widest opacity-70 mb-1">
        {label}
      </p>
      <p className="whitespace-pre-line">{body}</p>
    </div>
  );
}

function FinalReportBanner({
  state,
  sessionId,
  onDismiss,
}: {
  state: LiveState;
  sessionId: string;
  onDismiss: () => void;
}) {
  const queryClient = useQueryClient();
  const report = state.report!;
  const recommendation = report.recommended_action_label ?? "No action recommended";

  const approveMutation = useMutation({
    mutationFn: () =>
      approveAction({
        incidentId: report.incident_id,
        actionId: report.recommended_action ?? "reroute_traffic",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      queryClient.invalidateQueries({ queryKey: ["incident"] });
      queryClient.invalidateQueries({ queryKey: ["compliancePack"] });
      onDismiss();
    },
  });

  const documentMutation = useMutation({
    mutationFn: () => downloadInvestigationDocument(report.harness_run_id),
  });

  const curve = useMemo(() => {
    const dn = report.do_nothing_curve ?? [];
    const rec = report.recovery_curve ?? [];
    const length = Math.max(dn.length, rec.length);
    return Array.from({ length }, (_, i) => ({
      step: i * 5,
      do_nothing: dn[i] ?? null,
      with_action: rec[i] ?? null,
    }));
  }, [report]);

  return (
    <motion.div
      key={sessionId}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-1">
            Recommendation ready
          </p>
          <h2 className="text-xl font-semibold text-slate-900 leading-tight tracking-tight">
            {recommendation}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{report.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">
            Do nothing vs. {recommendation}
          </p>
          <CurveChart data={curve} />
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">
            Decision trail
          </p>
          <p className="text-xs text-slate-700">
            <span className="text-slate-500">Roles dispatched:</span>{" "}
            <span className="font-mono font-semibold">{report.selected_roles.length}</span>
          </p>
          <p className="text-xs text-slate-700 mt-1">
            <span className="text-slate-500">Evidence collected:</span>{" "}
            <span className="font-mono font-semibold">{report.evidence_count}</span>
          </p>
          <button
            onClick={() => documentMutation.mutate()}
            disabled={documentMutation.isPending}
            className="mt-auto mb-2 px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50 disabled:opacity-50 text-blue-700 font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={13} />
            {documentMutation.isPending ? "Compiling report..." : "Download report"}
          </button>
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || !report.recommended_action}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded transition-colors"
          >
            {approveMutation.isPending ? "Approving…" : "Approve & mitigate"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CurveChart({
  data,
}: {
  data: { step: number; do_nothing: number | null; with_action: number | null }[];
}) {
  if (data.length === 0) {
    return <p className="text-[11px] text-slate-400 italic">No projection available</p>;
  }
  const width = 360;
  const height = 100;
  const xMax = data.length - 1;
  const yMax = 100;

  const project = (i: number, value: number | null) => {
    if (value === null) return null;
    return {
      x: (i / xMax) * width,
      y: height - (value / yMax) * height,
    };
  };

  const buildPath = (key: "do_nothing" | "with_action") => {
    const points = data
      .map((row, i) => project(i, row[key]))
      .filter((p): p is { x: number; y: number } => p !== null);
    if (points.length === 0) return "";
    return `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`;
  };

  return (
    <svg width="100%" height={height + 20} viewBox={`0 0 ${width} ${height + 20}`}>
      <line
        x1={0}
        x2={width}
        y1={height - (42 / yMax) * height}
        y2={height - (42 / yMax) * height}
        stroke="#cbd5e1"
        strokeDasharray="3 3"
      />
      <text
        x={width - 4}
        y={height - (42 / yMax) * height - 4}
        fontSize={9}
        textAnchor="end"
        fill="#64748b"
        fontFamily="ui-monospace"
      >
        recovery floor 42
      </text>
      <path d={buildPath("do_nothing")} stroke="#DC2626" strokeWidth={2} fill="none" />
      <path d={buildPath("with_action")} stroke="#16A34A" strokeWidth={2} fill="none" />
      <g fontSize={9} fontFamily="ui-monospace" fill="#64748b">
        <circle cx={6} cy={height + 12} r={3} fill="#DC2626" />
        <text x={14} y={height + 15}>do nothing</text>
        <circle cx={100} cy={height + 12} r={3} fill="#16A34A" />
        <text x={108} y={height + 15}>recommended</text>
      </g>
    </svg>
  );
}
