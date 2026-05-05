import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Wifi,
  Radio,
  MessageSquare,
  CreditCard,
  Bot,
  CheckCircle2,
  Clock,
  Shield,
  ChevronRight,
  Loader2,
  AlertCircle,
  ThumbsUp,
  FileText,
} from "lucide-react";
import { getIncident, MITIGATION_OPTIONS, AGENT_RESPONSES } from "../data/dummy";
import RiskBadge from "../components/ui/RiskBadge";
import ScoreRing from "../components/ui/ScoreRing";
import type { AgentRole } from "../types";

const TABS = ["Overview", "Copilot", "Mitigation"] as const;
type Tab = typeof TABS[number];

function fmt(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}
function fmtNGN(n: number) {
  return `₦${(n / 1_000_000).toFixed(1)}M`;
}

const TIMELINE_COLORS: Record<string, string> = {
  detection: "#0078D4",
  alert: "#FF8C00",
  escalation: "#D13438",
  incident: "#D13438",
  agent: "#8764B8",
  approval: "#107C10",
  recovery: "#107C10",
};

const AGENTS: { role: AgentRole; label: string; query: string }[] = [
  { role: "network_risk", label: "Network Risk", query: "Why is Ikeja high risk?" },
  { role: "revenue_assurance", label: "Revenue Assurance", query: "Are there revenue leakage signals?" },
  { role: "customer_experience", label: "Customer Experience", query: "How many subscribers are affected?" },
  { role: "mitigation_planning", label: "Mitigation Planning", query: "What should we do now?" },
  { role: "compliance", label: "Compliance", query: "What is our NCC exposure?" },
];

function RISK_OPTION_COLOR(risk: string) {
  if (risk === "critical") return "#D13438";
  if (risk === "medium") return "#FF8C00";
  return "#107C10";
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Overview");
  const [selectedAgent, setSelectedAgent] = useState<AgentRole>("network_risk");
  const [isThinking, setIsThinking] = useState(false);
  const [showResponse, setShowResponse] = useState<AgentRole | null>(null);
  const [approvedAction, setApprovedAction] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const incident = getIncident(id ?? "");
  if (!incident) {
    return (
      <div className="flex items-center justify-center h-full text-[#605E5C]">
        Incident not found.
      </div>
    );
  }

  function handleQuery() {
    setIsThinking(true);
    setShowResponse(null);
    const delay = AGENT_RESPONSES[selectedAgent]?.thinkingMs ?? 1500;
    setTimeout(() => {
      setIsThinking(false);
      setShowResponse(selectedAgent);
    }, Math.min(delay, 2500));
  }

  function handleApprove(actionId: string) {
    setPendingActionId(actionId);
    setShowApprovalModal(true);
  }

  function confirmApproval() {
    setApprovedAction(pendingActionId);
    setShowApprovalModal(false);
    setPendingActionId(null);
  }

  const resp = showResponse ? AGENT_RESPONSES[showResponse] : null;
  const currentAgent = AGENTS.find((a) => a.role === selectedAgent)!;

  return (
    <div className="p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate("/incidents")}
          className="mt-0.5 p-1.5 rounded hover:bg-[#EDEBE9] text-[#605E5C] transition-colors flex-none"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-mono text-base font-bold text-[#323130]">{incident.id}</h1>
            <RiskBadge status={incident.riskScore >= 75 ? "critical" : incident.riskScore >= 55 ? "high" : "medium"} />
            <span className="text-[11px] font-mono text-[#605E5C]">{incident.lgaName} LGA</span>
          </div>
          <p className="text-xs text-[#605E5C] mt-1 truncate">{incident.rootCause}</p>
        </div>
        <div className="flex gap-2 flex-none">
          <Link
            to={`/compliance/${incident.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D2D0CE] text-xs font-semibold text-[#323130] rounded hover:bg-[#F3F2F1] transition-colors"
          >
            <FileText size={13} />
            NCC Pack
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#EDEBE9] gap-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? "border-[#0078D4] text-[#0078D4]"
                : "border-transparent text-[#605E5C] hover:text-[#323130]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Overview" && (
          <div className="flex flex-col gap-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Risk Score", value: <ScoreRing score={incident.riskScore} size={56} />, raw: null },
                { label: "Time to Breach", value: incident.timeToBreach ? `${incident.timeToBreach} min` : "Averted", raw: "font-mono text-2xl font-bold text-[#D13438]" },
                { label: "Subscribers", value: fmt(incident.subscribers), raw: "font-mono text-2xl font-bold text-[#323130]" },
                { label: "Revenue at Risk", value: fmtNGN(incident.revenueAtRisk), raw: "font-mono text-2xl font-bold text-[#323130]" },
                { label: "NCC Exposure", value: fmtNGN(incident.nccFineExposure), raw: "font-mono text-2xl font-bold text-[#C19C00]" },
              ].map(({ label, value, raw }) => (
                <div key={label} className="bg-white border border-[#D2D0CE] rounded-lg p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-2">{label}</p>
                  {raw ? <p className={raw}>{value}</p> : value}
                </div>
              ))}
            </div>

            {/* Signal Evidence */}
            <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-4">Signal Evidence</p>
              <div className="grid grid-cols-3 gap-4">
                {/* Network */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <Wifi size={16} className="text-[#0078D4] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">Network</p>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-[#605E5C]">
                        Packet Loss: <span className="font-mono font-bold text-[#D13438]">{incident.signals.network.packetLoss}%</span>
                        <span className="text-[#A19F9D] ml-1">(baseline {incident.signals.network.baselinePacketLoss}%)</span>
                      </p>
                      <p className="text-[11px] text-[#605E5C]">
                        Latency: <span className="font-mono font-bold text-[#D13438]">{incident.signals.network.latency}ms</span>
                        <span className="text-[#A19F9D] ml-1">(baseline {incident.signals.network.baselineLatency}ms)</span>
                      </p>
                    </div>
                  </div>
                </div>
                {/* BTS */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <Radio size={16} className="text-[#D13438] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">BTS Sites</p>
                    <p className="text-[11px] text-[#605E5C]">
                      <span className="font-mono font-bold text-[#D13438]">{incident.signals.bts.unstableSites}</span>
                      <span> of {incident.signals.bts.totalSites} sites unstable</span>
                    </p>
                    <p className="text-[11px] text-[#605E5C]">
                      <span className="font-mono font-bold">{incident.signals.bts.powerAlerts}</span> active power alarms
                    </p>
                  </div>
                </div>
                {/* Complaints */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <MessageSquare size={16} className="text-[#FF8C00] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">Complaints</p>
                    <p className="text-[11px] text-[#605E5C]">
                      <span className="font-mono font-bold text-[#FF8C00]">{fmt(incident.signals.complaints.count)}</span> in 2 hrs
                    </p>
                    <p className="text-[11px] text-[#605E5C]">{incident.signals.complaints.changeLabel}</p>
                  </div>
                </div>
                {/* Sessions */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <Shield size={16} className="text-[#605E5C] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">Device Sessions</p>
                    <p className="text-[11px] text-[#605E5C]">
                      Active: <span className="font-mono font-bold">{fmt(incident.signals.sessions.current)}</span>
                    </p>
                    <p className="text-[11px] text-[#D13438]">
                      Down {incident.signals.sessions.dropPct}% from {fmt(incident.signals.sessions.baseline)}
                    </p>
                  </div>
                </div>
                {/* Billing */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <CreditCard size={16} className="text-[#C19C00] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">Billing Velocity</p>
                    <p className="text-[11px] text-[#D13438] font-mono font-bold">
                      −{incident.signals.billing.velocityDrop}%
                    </p>
                    <p className="text-[11px] text-[#605E5C]">vs. hourly baseline</p>
                  </div>
                </div>
                {/* Recharge */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F3F2F1]">
                  <CreditCard size={16} className="text-[#605E5C] mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold text-[#323130] mb-1">Recharge Volume</p>
                    <p className="text-[11px] text-[#FF8C00] font-mono font-bold">
                      −{incident.signals.recharge.volumeDecline}%
                    </p>
                    <p className="text-[11px] text-[#605E5C]">last 90 minutes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-4">Incident Timeline</p>
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#EDEBE9]" />
                <div className="space-y-4">
                  {incident.timeline.map((ev, i) => {
                    const color = TIMELINE_COLORS[ev.type] ?? "#605E5C";
                    return (
                      <div key={i} className="relative flex items-start gap-3">
                        <div
                          className="absolute -left-6 w-3.5 h-3.5 rounded-full border-2 border-white flex-none"
                          style={{ background: color, top: 2 }}
                        />
                        <span className="font-mono text-[11px] text-[#605E5C] flex-none w-10">{ev.time}</span>
                        <span className="text-[12px] text-[#323130]">{ev.event}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "Copilot" && (
          <div className="flex gap-4 h-full">
            {/* Agent Selector */}
            <div className="w-52 flex-none flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-2">Select Agent</p>
              {AGENTS.map(({ role, label, query }) => (
                <button
                  key={role}
                  onClick={() => { setSelectedAgent(role); setShowResponse(null); }}
                  className={`flex items-start gap-2.5 px-3 py-3 rounded-lg text-left transition-colors ${
                    selectedAgent === role
                      ? "bg-[#0078D4] text-white"
                      : "bg-white border border-[#D2D0CE] text-[#323130] hover:bg-[#F3F2F1]"
                  }`}
                >
                  <Bot size={14} className="mt-0.5 flex-none" />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{label}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${selectedAgent === role ? "text-white/70" : "text-[#605E5C]"}`}>
                      "{query}"
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Query Panel */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Query Box */}
              <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-[#0078D4]" />
                    <span className="text-sm font-semibold text-[#323130]">
                      {AGENT_RESPONSES[selectedAgent]?.agentName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#C7E0F4]/40 text-[#0078D4] text-[9px] font-bold uppercase tracking-wider">
                      AI Agent
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#F3F2F1] rounded-lg px-4 py-3">
                  <span className="flex-1 text-sm text-[#323130]">"{currentAgent.query}"</span>
                  <button
                    onClick={handleQuery}
                    disabled={isThinking}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0078D4] text-white text-xs font-semibold rounded hover:bg-[#106EBE] transition-colors disabled:opacity-50"
                  >
                    {isThinking ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                    {isThinking ? "Thinking…" : "Ask Agent"}
                  </button>
                </div>
                {isThinking && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[#605E5C]">
                    <Loader2 size={12} className="animate-spin" />
                    Calling tools: {AGENT_RESPONSES[selectedAgent]?.toolsCalled.join(", ")}…
                  </div>
                )}
              </div>

              {/* Response */}
              {resp && (
                <div className="flex flex-col gap-3">
                  {/* Validation + Tools */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DFF6DD] border border-[#107C10]/20 text-[#107C10] text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle2 size={11} />
                      Validation {resp.validationStatus}
                    </div>
                    <span className="text-[10px] text-[#605E5C]">
                      Tools called: <span className="font-mono">{resp.toolsCalled.join(" → ")}</span>
                    </span>
                    <span className="text-[10px] text-[#605E5C] ml-auto">
                      {(resp.thinkingMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Facts */}
                  <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-3">Facts</p>
                    <div className="space-y-2">
                      {resp.facts.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 size={13} className="text-[#107C10] mt-0.5 flex-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#323130]">{f.claim}</p>
                            <p className="font-mono text-[9px] text-[#A19F9D] mt-0.5">{f.evidenceId}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Inferences */}
                  <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-3">Inferences</p>
                    <div className="space-y-2">
                      {resp.inferences.map((inf, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <AlertCircle size={13} className="text-[#0078D4] mt-0.5 flex-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#323130]">{inf.claim}</p>
                            <p className="text-[10px] text-[#605E5C] mt-0.5">
                              Confidence:{" "}
                              <span className="font-mono font-bold" style={{ color: inf.confidence >= 0.85 ? "#107C10" : "#FF8C00" }}>
                                {Math.round(inf.confidence * 100)}%
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-white border border-[#D2D0CE] rounded-lg p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-3">Recommendations</p>
                    <div className="space-y-2">
                      {resp.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-[#F3F2F1]">
                          <ChevronRight size={13} className="text-[#0078D4] mt-0.5 flex-none" />
                          <div className="flex-1">
                            <p className="text-xs text-[#323130]">{rec.action}</p>
                            {rec.requiresApproval && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-[#FFF4CE] border border-[#FF8C00]/20 text-[9px] font-bold text-[#FF8C00] uppercase">
                                Requires Approval
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "Mitigation" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#323130]">Mitigation Options</p>
                <p className="text-xs text-[#605E5C] mt-0.5">Pre-action simulation results — select an option to approve</p>
              </div>
              {approvedAction && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#DFF6DD] border border-[#107C10]/25">
                  <CheckCircle2 size={14} className="text-[#107C10]" />
                  <span className="text-xs font-semibold text-[#107C10]">Action approved & logged</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {MITIGATION_OPTIONS.map((opt) => {
                const isApproved = approvedAction === opt.id;
                const isNone = opt.id === "ACTION-NONE";
                const riskColor = RISK_OPTION_COLOR(opt.risk);

                return (
                  <div
                    key={opt.id}
                    className={`bg-white border-2 rounded-lg p-5 flex flex-col gap-4 transition-all ${
                      isApproved
                        ? "border-[#107C10]"
                        : opt.recommended
                        ? "border-[#0078D4]"
                        : "border-[#D2D0CE]"
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-[#323130] leading-tight">{opt.name}</p>
                        {opt.recommended && (
                          <span className="flex-none px-2 py-0.5 rounded bg-[#0078D4] text-white text-[9px] font-bold uppercase tracking-wider">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#605E5C] leading-relaxed">{opt.description}</p>
                    </div>

                    {/* Simulation Result */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-[#F3F2F1]">
                        <p className="text-[9px] font-bold uppercase text-[#605E5C] mb-1">Score After</p>
                        <p className="font-mono text-lg font-bold" style={{ color: opt.scoreAfter >= 75 ? "#D13438" : opt.scoreAfter >= 45 ? "#FF8C00" : "#107C10" }}>
                          {opt.scoreAfter}
                          <span className="text-xs ml-1" style={{ color: opt.scoreDelta < 0 ? "#107C10" : "#D13438" }}>
                            ({opt.scoreDelta > 0 ? "+" : ""}{opt.scoreDelta})
                          </span>
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F3F2F1]">
                        <p className="text-[9px] font-bold uppercase text-[#605E5C] mb-1">Time to Effect</p>
                        <p className="font-mono text-lg font-bold text-[#323130]">
                          {opt.timeToEffect ? `${opt.timeToEffect}m` : "—"}
                        </p>
                      </div>
                      <div className="col-span-2 p-2.5 rounded-lg bg-[#F3F2F1]">
                        <p className="text-[9px] font-bold uppercase text-[#605E5C] mb-1">Revenue Impact</p>
                        <p className="font-mono text-sm font-bold" style={{ color: opt.revenueSaved >= 0 ? "#107C10" : "#D13438" }}>
                          {opt.revenueSaved >= 0 ? "+" : ""}
                          {opt.revenueSaved >= 0 ? `₦${(opt.revenueSaved / 1_000_000).toFixed(1)}M saved` : `₦${Math.abs(opt.revenueSaved / 1_000_000).toFixed(1)}M lost`}
                        </p>
                      </div>
                    </div>

                    {/* Operational Risk */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#605E5C]">Operational Risk:</span>
                      <span
                        className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border"
                        style={{
                          color: riskColor,
                          borderColor: riskColor + "40",
                          background: riskColor + "1A",
                        }}
                      >
                        {opt.risk}
                      </span>
                    </div>

                    {/* Steps */}
                    {opt.steps.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-[#605E5C] mb-1.5">Steps</p>
                        <ol className="space-y-1">
                          {opt.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="font-mono text-[10px] text-[#0078D4] font-bold flex-none">{i + 1}.</span>
                              <span className="text-[10px] text-[#605E5C]">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Approve Button */}
                    {!isNone && (
                      isApproved ? (
                        <div className="flex items-center gap-2 text-[#107C10] text-xs font-semibold">
                          <CheckCircle2 size={14} />
                          Approved & logged to audit trail
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApprove(opt.id)}
                          disabled={!!approvedAction}
                          className="flex items-center gap-2 px-4 py-2 bg-[#0078D4] text-white text-xs font-semibold rounded hover:bg-[#106EBE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ThumbsUp size={13} />
                          Approve Action
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF4CE] flex items-center justify-center flex-none">
                <ThumbsUp size={18} className="text-[#FF8C00]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#323130]">Confirm Approval</p>
                <p className="text-[11px] text-[#605E5C]">This action will be logged to the audit trail</p>
              </div>
            </div>
            <p className="text-xs text-[#605E5C] mb-5">
              You are approving:{" "}
              <strong className="text-[#323130]">
                {MITIGATION_OPTIONS.find((o) => o.id === pendingActionId)?.name}
              </strong>
              . This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 px-4 py-2 border border-[#D2D0CE] text-sm font-semibold text-[#323130] rounded hover:bg-[#F3F2F1] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproval}
                className="flex-1 px-4 py-2 bg-[#0078D4] text-white text-sm font-semibold rounded hover:bg-[#106EBE] transition-colors"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
