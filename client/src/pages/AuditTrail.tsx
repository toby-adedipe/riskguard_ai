import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Bot,
  User,
  Server,
  ChevronRight,
  Filter,
} from "lucide-react";
import { AUDIT_LOG } from "../data/dummy";
import type { AuditEntry } from "../types";

const ACTOR_ICONS: Record<string, React.ElementType> = {
  system: Server,
  agent: Bot,
  operator: User,
};

const ACTOR_COLORS: Record<string, string> = {
  system: "#0078D4",
  agent: "#8764B8",
  operator: "#107C10",
};

const ACTION_CHIP_COLOR: Record<string, string> = {
  ANOMALY_DETECTED: "#FFF4CE",
  RISK_THRESHOLD_CROSSED: "#FFF4CE",
  INCIDENT_CREATED: "#FDE7E9",
  AGENT_TOOL_CALL: "#E9E3F5",
  SIMULATION_RUN: "#E9E3F5",
  COMPLIANCE_ANALYSIS: "#E9E3F5",
  ACTION_APPROVED: "#DFF6DD",
  RECOVERY_INITIATED: "#DFF6DD",
  RISK_SCORE_DROP: "#DFF6DD",
  INCIDENT_RESOLVED: "#DFF6DD",
};

const ACTION_TEXT_COLOR: Record<string, string> = {
  ANOMALY_DETECTED: "#C19C00",
  RISK_THRESHOLD_CROSSED: "#FF8C00",
  INCIDENT_CREATED: "#D13438",
  AGENT_TOOL_CALL: "#8764B8",
  SIMULATION_RUN: "#8764B8",
  COMPLIANCE_ANALYSIS: "#8764B8",
  ACTION_APPROVED: "#107C10",
  RECOVERY_INITIATED: "#107C10",
  RISK_SCORE_DROP: "#107C10",
  INCIDENT_RESOLVED: "#107C10",
};

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditTrail() {
  const navigate = useNavigate();
  const [filterActor, setFilterActor] = useState<string>("all");
  const [filterIncident, setFilterIncident] = useState<string>("all");

  const incidents = Array.from(new Set(AUDIT_LOG.map((e) => e.incidentId).filter(Boolean))) as string[];

  const filtered = AUDIT_LOG.filter((e) => {
    if (filterActor !== "all" && e.actorType !== filterActor) return false;
    if (filterIncident !== "all" && e.incidentId !== filterIncident) return false;
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#323130]">Audit Trail</h1>
          <p className="text-xs text-[#605E5C] mt-0.5">
            Append-only log — {AUDIT_LOG.length} entries across {incidents.length} incidents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#605E5C]" />
          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="bg-white border border-[#D2D0CE] rounded px-2 py-1.5 text-xs text-[#323130] focus:outline-none focus:border-[#0078D4]"
          >
            <option value="all">All Actors</option>
            <option value="system">System</option>
            <option value="agent">AI Agents</option>
            <option value="operator">Operators</option>
          </select>
          <select
            value={filterIncident}
            onChange={(e) => setFilterIncident(e.target.value)}
            className="bg-white border border-[#D2D0CE] rounded px-2 py-1.5 text-xs text-[#323130] focus:outline-none focus:border-[#0078D4]"
          >
            <option value="all">All Incidents</option>
            {incidents.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "System Events", count: AUDIT_LOG.filter((e) => e.actorType === "system").length, icon: Server, color: "#0078D4" },
          { label: "Agent Actions", count: AUDIT_LOG.filter((e) => e.actorType === "agent").length, icon: Bot, color: "#8764B8" },
          { label: "Operator Approvals", count: AUDIT_LOG.filter((e) => e.actorType === "operator").length, icon: User, color: "#107C10" },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-[#D2D0CE] rounded-lg px-4 py-3 flex items-center gap-3">
            <Icon size={18} style={{ color }} />
            <div>
              <p className="font-mono text-lg font-bold text-[#323130]">{count}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#605E5C]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Log Table */}
      <div className="flex-1 bg-white border border-[#D2D0CE] rounded-lg overflow-hidden flex flex-col">
        <div className="grid grid-cols-[180px_120px_1fr_180px_100px_36px] gap-0 border-b border-[#EDEBE9] bg-[#F3F2F1]">
          {["Timestamp", "Actor", "Detail", "Incident", "Action", ""].map((h) => (
            <div key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
              {h}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#EDEBE9]">
          {filtered.map((entry) => {
            const ActorIcon = ACTOR_ICONS[entry.actorType] ?? Server;
            const actorColor = ACTOR_COLORS[entry.actorType] ?? "#605E5C";
            const chipBg = ACTION_CHIP_COLOR[entry.action] ?? "#F3F2F1";
            const chipText = ACTION_TEXT_COLOR[entry.action] ?? "#605E5C";

            return (
              <div
                key={entry.id}
                className="grid grid-cols-[180px_120px_1fr_180px_100px_36px] gap-0 hover:bg-[#F3F2F1] transition-colors group"
              >
                <div className="px-4 py-3 flex items-center">
                  <span className="font-mono text-[10px] text-[#605E5C] leading-snug">
                    {fmtTs(entry.timestamp)}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center gap-1.5">
                  <ActorIcon size={13} style={{ color: actorColor }} className="flex-none" />
                  <span className="text-[11px] text-[#323130] font-medium truncate" title={entry.actor}>
                    {entry.actorType === "operator" ? entry.actor.split("@")[0] : entry.actor}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center">
                  <span className="text-[11px] text-[#323130] leading-snug">{entry.detail}</span>
                </div>
                <div className="px-4 py-3 flex items-center">
                  {entry.incidentId ? (
                    <button
                      onClick={() => navigate(`/incidents/${entry.incidentId}`)}
                      className="font-mono text-[10px] text-[#0078D4] hover:underline truncate"
                    >
                      {entry.incidentId}
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#A19F9D]">—</span>
                  )}
                </div>
                <div className="px-4 py-3 flex items-center">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold leading-tight"
                    style={{ background: chipBg, color: chipText }}
                  >
                    {entry.action.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="px-2 py-3 flex items-center justify-center">
                  {entry.incidentId && (
                    <ChevronRight
                      size={13}
                      className="text-[#C8C6C4] group-hover:text-[#605E5C] cursor-pointer"
                      onClick={() => navigate(`/incidents/${entry.incidentId}`)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#EDEBE9] bg-[#F3F2F1] flex items-center justify-between">
          <span className="text-[10px] text-[#605E5C]">
            Showing {filtered.length} of {AUDIT_LOG.length} entries
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#605E5C]">
            <ClipboardList size={11} />
            Append-only — no entries may be deleted
          </span>
        </div>
      </div>
    </div>
  );
}
