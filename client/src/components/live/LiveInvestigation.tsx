import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CopilotResponse, CompliancePack, approveAction, fetchCopilot, fetchCompliancePack } from "../../lib/api";
import { exportCompliancePdf } from "../../lib/pdf";
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";

// Same domain configuration as LGASummaryPanel for consistency
const DOMAIN_LABELS: Record<string, string> = {
  network: "Packet Loss & Latency",
  bts: "BTS Power Stability",
  complaints: "Customer Complaints",
  billing: "Billing System",
  recharge: "Recharge Velocity",
  social_media: "Social Media Sentiment",
};

const DOMAIN_DIRECTIONS: Record<
  string,
  "higher_is_better" | "lower_is_better"
> = {
  network: "lower_is_better",
  bts: "lower_is_better",
  complaints: "lower_is_better",
  billing: "lower_is_better",
  recharge: "lower_is_better",
  social_media: "lower_is_better",
};

function getDomainHealth(zScore: number, domain: string): number {
  const direction = DOMAIN_DIRECTIONS[domain];
  const effectiveScore = direction === "higher_is_better" ? zScore : -zScore;
  return Math.max(0, Math.min(100, (effectiveScore + 10) * 5));
}

function getDomainHealthTone(health: number): string {
  if (health > 70) return "#107C10";
  if (health > 40) return "#FF8C00";
  return "#D13438";
}

interface LiveInvestigationProps {
  sessionId: string;
  incidentId: string | null;
  onDismiss: () => void;
  onRedo: () => void;
  onApproved?: (incident: { id: string; lgaId: string; cause: string; affectedSubs: number }) => void;
}

const PHASE_COPY: Record<LiveState["phase"], { label: string; sub: string }> = {
  idle: { label: "Standing by", sub: "Awaiting trigger" },
  telemetry: {
    label: "Telemetry climbing",
    sub: "Streaming live signals from Ikeja",
  },
  wake: { label: "Agent activated", sub: "Risk threshold breached" },
  investigating: {
    label: "Specialists investigating",
    sub: "Tools executing in real time",
  },
  report: {
    label: "Report compiled",
    sub: "Recommendation ready for approval",
  },
  complete: {
    label: "Investigation complete",
    sub: "Operator decision required",
  },
};

const MITIGATION_KEY = (sid: string) => `rg_mitigated_${sid}`;

interface PersistedMitigation {
  score: number;
  domainZScores: Record<string, number>;
}

function loadMitigation(sessionId: string | null): PersistedMitigation | null {
  if (!sessionId) return null;
  try { return JSON.parse(localStorage.getItem(MITIGATION_KEY(sessionId)) ?? "null"); }
  catch { return null; }
}

export function LiveInvestigation({
  sessionId,
  incidentId,
  onDismiss,
  onRedo,
  onApproved,
}: LiveInvestigationProps) {
  const { state } = useLiveStream(sessionId);
  const progress = useDerivedRoleProgress(state);

  // Restore mitigation state from localStorage on mount
  const storedMitigation = useMemo(() => loadMitigation(sessionId), [sessionId]);

  const [recovering, setRecovering] = useState(() => !!storedMitigation);
  const recoveryRef = useRef<number | null>(null);
  const [recoveryScore, setRecoveryScore] = useState(() => storedMitigation?.score ?? 0);
  const [recoveryDomains, setRecoveryDomains] = useState<Record<string, number>>(
    () => storedMitigation?.domainZScores ?? {}
  );
  const [wasApproved, setWasApproved] = useState(() => !!storedMitigation);

  const startRecovery = (incident: { id: string; lgaId: string; cause: string; affectedSubs: number }) => {
    onApproved?.(incident);
    setRecovering(true);
    setWasApproved(true);

    const startScore = state.score;
    const startDomains = { ...state.domainZScores };
    const targetScore = 46;
    // all domains in green zone (health ≥ 70% = z-score ≤ −4), with natural variation
    const targetDomains: Record<string, number> = {
      network: -7.0,
      bts: -6.5,
      recharge: -5.5,
      complaints: -4.8,
      billing: -4.3,
      social_media: -4.1,
    };

    // Persist immediately so returning mid-animation still shows recovered state
    if (sessionId) {
      localStorage.setItem(MITIGATION_KEY(sessionId), JSON.stringify({ score: targetScore, domainZScores: targetDomains }));
    }

    const duration = 3200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setRecoveryScore(startScore + (targetScore - startScore) * eased);
      setRecoveryDomains(
        Object.fromEntries(
          Object.entries(startDomains).map(([k, v]) => [k, v + ((targetDomains[k] ?? 0) - v) * eased])
        )
      );
      if (t < 1) {
        recoveryRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(onDismiss, 800);
      }
    };
    recoveryRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => { if (recoveryRef.current) cancelAnimationFrame(recoveryRef.current); }, []);

  const displayState: LiveState = recovering
    ? {
        ...state,
        score: recoveryScore,
        severity: recoveryScore > 70 ? "red" : recoveryScore > 40 ? "amber" : "green",
        domainZScores: recoveryDomains,
      }
    : state;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background">
      <Header state={displayState} onDismiss={onDismiss} progress={progress} onRedo={onRedo} />

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 px-6 py-4 overflow-hidden">
        <main className="col-span-12 lg:col-span-8 overflow-y-auto pr-1 space-y-4">
          {state.report && state.complete && (
            <FinalReportBanner
              state={state}
              sessionId={sessionId}
              onApproved={startRecovery}
              wasApproved={wasApproved}
            />
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 md:col-span-1">
              <ScoreGauge state={displayState} />
            </div>
            <div className="col-span-3 md:col-span-2">
              <DomainBreakdown state={displayState} />
            </div>
          </div>

          <TelemetryFeed state={state} />
        </main>

        <aside className="col-span-12 lg:col-span-4 flex flex-col bg-white border border-border-base rounded-xl overflow-hidden min-h-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
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
  onRedo,
}: {
  state: LiveState;
  progress: { total: number; done: number };
  onDismiss: () => void;
  onRedo: () => void;
}) {
  const phase = state.thresholdBlocked
    ? { label: "Monitoring complete", sub: "Agent threshold not reached" }
    : PHASE_COPY[state.phase];
  return (
    <header className="px-6 py-4 border-b border-border-base bg-white flex items-center justify-between flex-none shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#605E5C] border border-border-base rounded-md hover:bg-background transition-colors"
        >
          <ArrowLeft size={13} />
          Dashboard
        </button>
        <div className="h-6 w-px bg-border-base" />
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-md bg-blue-soft border border-[#B3D7F2] flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
            {state.phase !== "complete" && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Live Investigation · INC-2026-IKEJA-001
            </p>
            <p className="text-sm font-semibold text-text-main leading-tight">
              {phase.label}
              <span className="text-[#605E5C] font-normal"> · {phase.sub}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PhaseTimeline state={state} />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF9F8] border border-border-base rounded-md">
          <Activity size={12} className="text-[#605E5C]" />
          <span className="text-[11px] font-mono text-[#605E5C]">
            {progress.done}/{progress.total} agents
          </span>
        </div>
        <button
          onClick={onRedo}
          title="Replay investigation"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#605E5C] border border-border-base rounded-md hover:bg-background hover:text-text-main transition-colors"
        >
          <RefreshCw size={12} />
          Redo
        </button>
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
                  ? "border-[#B3D7F2] bg-blue-soft text-primary"
                  : done
                    ? "border-[#A3D9A3] bg-success-soft text-success"
                    : "border-border-base bg-white text-[#A19F9D]"
              }`}
            >
              <div
                className={`w-1 h-1 rounded-full ${
                  active
                    ? "bg-primary animate-pulse"
                    : done
                      ? "bg-success"
                      : "bg-[#C8C6C4]"
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={11} className="text-[#C8C6C4]" />
            )}
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
      ? "#D13438"
      : state.severity === "amber"
        ? "#FF8C00"
        : "#107C10";

  return (
    <div className="bg-white border border-border-base rounded-xl p-5 flex flex-col items-center h-full shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#605E5C] mb-3">
        Live risk score
      </p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#EDEBE9"
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
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#605E5C] mt-1">
            of 100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-[#EDEBE9]">
        <Stat
          label="Severity"
          value={state.severity.toUpperCase()}
          tone={state.severity}
        />
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
    red: "text-danger",
    amber: "text-warning",
    green: "text-success",
    neutral: "text-text-main",
  }[tone];

  return (
    <div className="flex flex-col items-center">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-[#605E5C]">
        {label}
      </p>
      <p className={`text-sm font-mono font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function DomainBreakdown({ state }: { state: LiveState }) {
  const domains = Object.entries(state.domainZScores);

  return (
    <div className="bg-white border border-border-base rounded-xl p-5 h-full shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#605E5C]">
          Domain anomaly stack
        </p>
        <span className="text-[10px] font-mono text-[#605E5C]">
          {domains.length} domains tracked
        </span>
      </div>
      <div className="space-y-3">
        {domains.length === 0 && (
          <p className="text-xs text-[#605E5C] italic">
            Awaiting first telemetry tick…
          </p>
        )}
        {domains.map(([domain, z]) => {
          const health = getDomainHealth(z, domain);
          const tone = getDomainHealthTone(health);
          const label = DOMAIN_LABELS[domain] || domain;

          const severityLabel =
            health < 30
              ? {
                  text: "Critical",
                  color: "text-danger bg-danger-soft border-[#F5C6C7]",
                }
              : health < 70
                ? {
                    text: "Elevated",
                    color: "text-warning bg-warning-soft border-[#FFD08A]",
                  }
                : {
                    text: "Normal",
                    color: "text-success bg-success-soft border-[#A3D9A3]",
                  };

          return (
            <div key={domain}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-main capitalize font-medium">
                  {label}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold border ${severityLabel.color}`}
                >
                  {severityLabel.text}
                </span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <motion.div
                  className="rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${health}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ height: "100%", background: tone }}
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
  const recent = useMemo(
    () => state.signalFeed.slice(-30).reverse(),
    [state.signalFeed],
  );

  return (
    <div className="bg-white border border-border-base rounded-xl flex flex-col overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEBE9]">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-success" />
          <p className="text-sm font-semibold text-text-main">
            Live telemetry stream
          </p>
        </div>
        <span className="text-[11px] font-mono text-[#605E5C]">
          {state.signalFeed.length} signals captured
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-4 space-y-2">
        {recent.length === 0 && (
          <p className="text-xs text-[#605E5C] italic px-2">
            No signals yet. Telemetry will appear here as Ikeja sites report in.
          </p>
        )}
        <AnimatePresence initial={false}>
          {recent.map((signal) => {
            const intensity = Math.min(Math.abs(signal.z_score) / 7, 1);
            const tone =
              intensity > 0.7
                ? "border-[#F5C6C7] bg-danger-soft text-danger"
                : intensity > 0.4
                  ? "border-[#FFD08A] bg-warning-soft text-[#7B5A00]"
                  : "border-[#A3D9A3] bg-success-soft text-[#054A05]";
            return (
              <motion.div
                key={signal.uid}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`border rounded-md px-3 py-2 ${tone}`}
              >
                <p className="text-xs leading-snug">{humanizeSignal(signal)}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {state.incidentOpened && (
        <div className="px-5 py-3 border-t border-[#F5C6C7] bg-danger-soft">
          <p className="text-xs font-medium text-danger flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-danger rounded-full animate-pulse" />
            Incident opened · INC-2026-IKEJA-001
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
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thread = useMemo(() => buildAgentThread(state), [state]);
  const hasActivity = state.thoughts.length > 0 || state.roles.length > 0;

  useEffect(() => {
    if (hasActivity) setIsExpanded(true);
  }, [hasActivity]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [thread.length, state.roles.length]);

  return (
    <>
      <div className="px-5 py-4 border-b border-[#EDEBE9] flex items-center justify-between flex-none bg-[#FAF9F8]">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-text-main">
              Agent activity
            </p>
            <p className="text-[11px] text-[#605E5C]">
              {state.thoughts.length} thoughts · {state.roles.length} dispatches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.phase === "investigating" && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-soft border border-[#B3D7F2]">
              <Loader2 size={10} className="animate-spin text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Reasoning
              </span>
            </span>
          )}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="p-1 rounded hover:bg-[#EDEBE9] transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.22 }}
            >
              <ChevronDown size={14} className="text-[#605E5C]" />
            </motion.div>
          </button>
        </div>
      </div>

      <motion.div
        ref={scrollRef}
        animate={{
          maxHeight: isExpanded ? 9999 : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        initial={false}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 min-h-0"
        style={{ overflowY: "auto", overflowX: "hidden" }}
      >
        <AgentTimeline state={state} />
      </motion.div>

      <CopilotChat state={state} incidentId={incidentId} />
    </>
  );
}

function AgentTimeline({ state }: { state: LiveState }) {
  const thread = useMemo(() => buildAgentThread(state), [state]);

  const showWaiting = thread.length === 0 && state.phase === "telemetry";
  const showActivating = thread.length === 0 && state.phase === "wake";

  return (
    <div className="px-4 py-4 space-y-3">
      {showWaiting && (
        <div className="p-4 border border-dashed border-border-base rounded-lg text-center text-[#605E5C] text-xs">
          Orchestrator dormant — will wake once the score crosses the
          multi-domain anomaly threshold.
        </div>
      )}
      {showActivating && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-[#B3D7F2] bg-blue-soft rounded-lg text-center text-primary text-xs flex items-center justify-center gap-2"
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
              className="flex gap-2.5 p-3 rounded-lg border border-[#B3D7F2] bg-blue-soft/60"
            >
              <Brain size={13} className="text-primary flex-none mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5">
                  Orchestrator thought
                </p>
                <p className="text-xs text-text-main leading-relaxed">
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
    ? "border-[#B3D7F2] bg-white shadow-[0_2px_12px_rgba(0,120,212,0.08)]"
    : isDone
      ? "border-[#A3D9A3] bg-success-soft/30"
      : "border-border-base bg-[#FAF9F8]/40";

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${containerTone}`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#EDEBE9] bg-white">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center ${
              isActive
                ? "bg-blue-soft text-primary border border-[#B3D7F2]"
                : isDone
                  ? "bg-success-soft text-success border border-[#A3D9A3]"
                  : "bg-background text-[#A19F9D] border border-border-base"
            }`}
          >
            <Icon size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-main leading-tight">
              {meta.label}
            </p>
            <p className="text-[10px] text-[#605E5C] leading-tight">
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
                className="flex flex-col gap-1 px-2.5 py-2 rounded-md border border-[#EDEBE9] bg-white text-[11px]"
              >
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <Loader2
                      size={10}
                      className="animate-spin text-primary flex-none"
                    />
                  ) : (
                    <CheckCircle2
                      size={10}
                      className="text-success flex-none"
                    />
                  )}
                  <span className="text-text-main truncate flex-1">
                    {call.description}
                  </span>
                </div>
                {call.summary && (
                  <span className="text-[10px] text-[#605E5C] pl-5 leading-snug">
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
                  <span className="text-primary mt-0.5">●</span>
                  <span className="text-text-main leading-snug">
                    {fact.claim}
                  </span>
                </div>
              ))}
            </div>
          )}

          {role.inferences.length > 0 && (
            <div className="space-y-1">
              {role.inferences.map((inf) => (
                <div key={inf.id} className="flex gap-2 text-xs">
                  <span className="text-warning mt-0.5">◇</span>
                  <span className="text-text-main italic leading-snug">
                    {inf.claim}{" "}
                    <span className="not-italic text-[#605E5C] font-mono text-[10px]">
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
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-success-soft border border-[#A3D9A3]"
                >
                  <span className="text-xs font-semibold text-[#054A05]">
                    {rec.label}
                  </span>
                  {rec.requiresApproval && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-success">
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
        <div className="px-3 py-2 border-t border-[#A3D9A3] bg-success-soft/60">
          <p className="text-[11px] text-[#054A05] leading-snug">
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
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-soft border border-[#B3D7F2]">
        <Loader2 size={9} className="animate-spin text-primary" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-primary">
          Working
        </span>
      </div>
    );
  }
  if (status === "done") {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success-soft border border-[#A3D9A3]">
        <CheckCircle2 size={9} className="text-success" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-success">
          Done
        </span>
      </div>
    );
  }
  return (
    <div className="px-1.5 py-0.5 rounded-full bg-background border border-border-base">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-[#605E5C]">
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

function chatStorageKey(incidentId: string) {
  return `rg_chat_${incidentId}`;
}

function loadChatMessages(incidentId: string | null): ChatMessage[] {
  if (!incidentId) return [];
  try {
    const raw = localStorage.getItem(chatStorageKey(incidentId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveChatMessages(incidentId: string | null, messages: ChatMessage[]) {
  if (!incidentId) return;
  try {
    localStorage.setItem(chatStorageKey(incidentId), JSON.stringify(messages));
  } catch {
    // quota exceeded
  }
}

function CopilotChat({
  state,
  incidentId,
}: {
  state: LiveState;
  incidentId: string | null;
}) {
  const [role, setRole] = useState<string>("network_risk");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatMessages(incidentId),
  );
  const idRef = useRef(messages.length);

  useEffect(() => {
    saveChatMessages(incidentId, messages);
  }, [incidentId, messages]);

  const enabled =
    state.complete && incidentId !== null && !state.thresholdBlocked;

  const mutation = useMutation({
    mutationFn: (payload: {
      role: string;
      query: string;
      incident_id: string;
    }) => fetchCopilot(payload),
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
    <div className="border-t border-[#EDEBE9] bg-[#FAF9F8] flex-none">
      {messages.length > 0 && (
        <div className="max-h-[220px] overflow-y-auto px-4 py-3 space-y-2.5 border-b border-[#EDEBE9]">
          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatBubble msg={msg} />
            </div>
          ))}
          {mutation.isPending && (
            <div className="flex items-center gap-2 text-[11px] text-[#605E5C] pl-1">
              <Loader2 size={11} className="animate-spin" />
              Copilot is thinking…
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="px-3 pt-2 pb-3 space-y-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Bot size={12} className="text-[#605E5C] flex-none" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#605E5C]">
              Ask agent
            </span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {CHAT_ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                disabled={!enabled}
                className={`px-2 py-1 rounded text-[10px] font-semibold tracking-wide transition-colors disabled:opacity-50 ${
                  role === r.id
                    ? "bg-primary text-white"
                    : "bg-[#EDEBE9] text-[#605E5C] hover:bg-border-base"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={!enabled || mutation.isPending}
            className="flex-1 text-xs px-3 py-2 border border-border-base rounded-sm bg-white outline-none focus:ring-1 focus:ring-primary disabled:bg-background disabled:text-[#A19F9D] text-text-main placeholder:text-[#A19F9D]"
          />
          <button
            type="submit"
            disabled={!enabled || mutation.isPending || !draft.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-sm text-xs font-semibold hover:bg-[#006CBE] transition-colors disabled:opacity-50"
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
        <div className="max-w-[85%] px-3 py-2 bg-primary text-white rounded-lg rounded-br-sm text-xs leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  if (!msg.response) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 bg-white border border-border-base text-text-main rounded-lg rounded-bl-sm text-xs leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  const roleLabel =
    CHAT_ROLES.find((r) => r.id === msg.role)?.label ?? msg.role;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full px-3 py-2.5 bg-white border border-border-base rounded-lg rounded-bl-sm text-xs space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
          <span className="font-semibold text-[#605E5C]">
            {roleLabel} agent
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-full font-mono ${
              msg.response.validation_status === "passed"
                ? "bg-success-soft text-success border border-[#A3D9A3]"
                : msg.response.validation_status === "revised"
                  ? "bg-warning-soft text-warning border border-[#FFD08A]"
                  : "bg-danger-soft text-danger border border-[#F5C6C7]"
            }`}
          >
            {msg.response.validation_status}
          </span>
        </div>

        <p className="text-[12px] leading-relaxed text-text-main">
          {msg.response.answer}
        </p>

        {msg.response.facts && (
          <CopilotBlock label="Facts" tone="blue" body={msg.response.facts} />
        )}
        {msg.response.inferences && (
          <CopilotBlock
            label="Inferences"
            tone="amber"
            body={msg.response.inferences}
          />
        )}
        {msg.response.recommendations && (
          <CopilotBlock
            label="Recommendations"
            tone="emerald"
            body={msg.response.recommendations}
          />
        )}
        {msg.response.sources.length > 0 && (
          <div className="pt-1 border-t border-[#EDEBE9]">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#605E5C] mb-1">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {msg.response.sources.map((source) => (
                <span
                  key={source.evidenceId}
                  title={source.label}
                  className="px-1.5 py-0.5 rounded-sm border border-border-base bg-[#FAF9F8] text-[9px] font-mono text-[#605E5C]"
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
    blue: "border-[#B3D7F2] bg-blue-soft/60 text-[#004578]",
    amber: "border-[#FFD08A] bg-warning-soft/60 text-[#7B5A00]",
    emerald: "border-[#A3D9A3] bg-success-soft/60 text-[#054A05]",
  }[tone];
  return (
    <div
      className={`border rounded-md p-2 text-[11px] leading-relaxed ${styles}`}
    >
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
  onApproved,
  wasApproved,
}: {
  state: LiveState;
  sessionId: string;
  onApproved: (incident: { id: string; lgaId: string; cause: string; affectedSubs: number }) => void;
  wasApproved: boolean;
}) {
  const queryClient = useQueryClient();
  const report = state.report!;
  const recommendation =
    report.recommended_action_label ?? "No action recommended";

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
      onApproved({
        id: report.incident_id,
        lgaId: "ikeja",
        cause: report.summary ?? "Network outage",
        affectedSubs: compliancePack?.impactedSubscribers ?? 0,
      });
    },
  });

  const { data: compliancePack } = useQuery<CompliancePack>({
    queryKey: ["compliancePack", report.incident_id],
    queryFn: () => fetchCompliancePack(report.incident_id),
  });

  const [pdfExporting, setPdfExporting] = useState(false);

  const handleDownloadPdf = () => {
    if (!compliancePack) return;
    setPdfExporting(true);
    setTimeout(() => {
      exportCompliancePdf(compliancePack, report.incident_id);
      setPdfExporting(false);
    }, 50);
  };

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
      className="bg-white border border-[#A3D9A3] rounded-xl p-5 shadow-[0_2px_12px_rgba(16,124,16,0.08)]"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success mb-1">
            {wasApproved || approveMutation.isSuccess ? "Incident contained" : "Recommendation ready"}
          </p>
          <h2 className="text-xl font-semibold text-text-main leading-tight tracking-tight">
            {recommendation}
          </h2>
          <p className="text-sm text-[#605E5C] mt-1">{report.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-[#FAF9F8] border border-[#EDEBE9] rounded-lg p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#605E5C] mb-2">
            Do nothing vs. {recommendation}
          </p>
          <CurveChart data={curve} />
        </div>
        <div className="bg-[#FAF9F8] border border-[#EDEBE9] rounded-lg p-4 flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#605E5C] mb-2">
            Decision trail
          </p>
          <p className="text-xs text-text-main">
            <span className="text-[#605E5C]">Roles dispatched:</span>{" "}
            <span className="font-mono font-semibold">
              {report.selected_roles.length}
            </span>
          </p>
          <p className="text-xs text-text-main mt-1">
            <span className="text-[#605E5C]">Evidence collected:</span>{" "}
            <span className="font-mono font-semibold">
              {report.evidence_count}
            </span>
          </p>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfExporting || !compliancePack}
            className="mt-auto mb-2 px-4 py-2 border border-[#B3D7F2] bg-white hover:bg-blue-soft disabled:opacity-50 text-primary font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={13} />
            {pdfExporting ? "Generating PDF..." : !compliancePack ? "Loading…" : "Download report"}
          </button>
          {wasApproved || approveMutation.isSuccess ? (
            <div className="px-4 py-2 bg-success-soft border border-[#A3D9A3] text-success font-semibold text-xs rounded-md flex items-center justify-center gap-1.5">
              <CheckCircle2 size={13} />
              Incident contained
            </div>
          ) : (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || !report.recommended_action}
              className="px-4 py-2 bg-success hover:bg-[#0a5a0a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-md transition-colors"
            >
              {approveMutation.isPending ? "Approving…" : "Approve & mitigate"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CurveChart({
  data,
}: {
  data: {
    step: number;
    do_nothing: number | null;
    with_action: number | null;
  }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-[11px] text-[#605E5C] italic">
        No projection available
      </p>
    );
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
    <svg
      width="100%"
      height={height + 20}
      viewBox={`0 0 ${width} ${height + 20}`}
    >
      <line
        x1={0}
        x2={width}
        y1={height - (42 / yMax) * height}
        y2={height - (42 / yMax) * height}
        stroke="#D2D0CE"
        strokeDasharray="3 3"
      />
      <text
        x={width - 4}
        y={height - (42 / yMax) * height - 4}
        fontSize={9}
        textAnchor="end"
        fill="#605E5C"
        fontFamily="Consolas, ui-monospace"
      >
        recovery floor 42
      </text>
      <path
        d={buildPath("do_nothing")}
        stroke="#D13438"
        strokeWidth={2}
        fill="none"
      />
      <path
        d={buildPath("with_action")}
        stroke="#107C10"
        strokeWidth={2}
        fill="none"
      />
      <g fontSize={9} fontFamily="Consolas, ui-monospace" fill="#605E5C">
        <circle cx={6} cy={height + 12} r={3} fill="#D13438" />
        <text x={14} y={height + 15}>
          do nothing
        </text>
        <circle cx={100} cy={height + 12} r={3} fill="#107C10" />
        <text x={108} y={height + 15}>
          recommended
        </text>
      </g>
    </svg>
  );
}
