import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Clock, ChevronRight, FileText } from "lucide-react";
import { INCIDENTS } from "../data/dummy";
import RiskBadge from "../components/ui/RiskBadge";
import type { RiskStatus } from "../types";

function fmt(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}
function fmtNGN(n: number) {
  return `₦${(n / 1_000_000).toFixed(1)}M`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CHIP: Record<string, string> = {
  active: "bg-[#FDE7E9] text-[#D13438] border-[#D13438]/20",
  mitigating: "bg-[#FFF4CE] text-[#FF8C00] border-[#FF8C00]/20",
  resolved: "bg-[#DFF6DD] text-[#107C10] border-[#107C10]/20",
};

export default function IncidentsList() {
  const navigate = useNavigate();

  return (
    <div className="p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#323130]">Incidents</h1>
          <p className="text-xs text-[#605E5C] mt-0.5">
            {INCIDENTS.length} incidents · {INCIDENTS.filter((i) => i.status !== "resolved").length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-[#D2D0CE] rounded px-3 py-1.5">
            <span className="text-xs text-[#605E5C]">All LGAs</span>
          </div>
          <div className="flex items-center gap-2 bg-white border border-[#D2D0CE] rounded px-3 py-1.5">
            <span className="text-xs text-[#605E5C]">All Statuses</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active", count: INCIDENTS.filter((i) => i.status === "active").length, icon: AlertTriangle, color: "#D13438" },
          { label: "Mitigating", count: INCIDENTS.filter((i) => i.status === "mitigating").length, icon: Clock, color: "#FF8C00" },
          { label: "Resolved", count: INCIDENTS.filter((i) => i.status === "resolved").length, icon: CheckCircle, color: "#107C10" },
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

      {/* Table */}
      <div className="flex-1 bg-white border border-[#D2D0CE] rounded-lg overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_1fr_80px_1fr_1fr_1fr_100px_40px] gap-0 border-b border-[#EDEBE9] bg-[#F3F2F1]">
          {["Incident ID", "LGA", "Score", "Subscribers", "Revenue at Risk", "NCC Exposure", "Status", ""].map(
            (h) => (
              <div key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
                {h}
              </div>
            )
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#EDEBE9]">
          {INCIDENTS.map((inc) => {
            const scoreColor =
              inc.riskScore >= 75 ? "#D13438" : inc.riskScore >= 55 ? "#FF8C00" : "#107C10";

            return (
              <button
                key={inc.id}
                onClick={() => navigate(`/incidents/${inc.id}`)}
                className="w-full grid grid-cols-[2fr_1fr_80px_1fr_1fr_1fr_100px_40px] gap-0 px-0 py-0 hover:bg-[#F3F2F1] transition-colors text-left group"
              >
                <div className="px-4 py-3.5 flex items-center gap-2">
                  <FileText size={14} className="text-[#0078D4] flex-none" />
                  <span className="font-mono text-xs font-semibold text-[#323130]">{inc.id}</span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span className="text-sm font-medium text-[#323130]">{inc.lgaName}</span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span className="font-mono font-bold text-sm" style={{ color: scoreColor }}>
                    {inc.riskScore}
                  </span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span className="font-mono text-xs text-[#323130]">{fmt(inc.subscribers)}</span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span className="font-mono text-xs text-[#323130]">{fmtNGN(inc.revenueAtRisk)}</span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span className="font-mono text-xs text-[#323130]">{fmtNGN(inc.nccFineExposure)}</span>
                </div>
                <div className="px-4 py-3.5 flex items-center">
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[inc.status]}`}
                  >
                    {inc.status}
                  </span>
                </div>
                <div className="px-2 py-3.5 flex items-center justify-center">
                  <ChevronRight size={14} className="text-[#C8C6C4] group-hover:text-[#605E5C]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
