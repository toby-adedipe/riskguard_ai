import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  Download,
  Shield,
  Users,
  DollarSign,
  List,
} from "lucide-react";
import { COMPLIANCE_PACKS } from "../data/dummy";

const TIMELINE_COLORS: Record<string, string> = {
  detection: "#0078D4",
  alert: "#FF8C00",
  escalation: "#D13438",
  incident: "#D13438",
  agent: "#8764B8",
  approval: "#107C10",
  recovery: "#107C10",
};

function fmtNGN(n: number) {
  if (n === 0) return "₦0";
  return `₦${(n / 1_000_000).toFixed(1)}M`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D2D0CE] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F3F2F1] border-b border-[#D2D0CE]">
        <Icon size={15} className="text-[#0078D4] flex-none" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#323130]">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function CompliancePack() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const pack = COMPLIANCE_PACKS[incidentId ?? ""];

  if (!pack) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[#605E5C]">
        <FileText size={40} className="opacity-30" />
        <p>No compliance pack found for incident <span className="font-mono">{incidentId}</span>.</p>
        <button onClick={() => navigate("/incidents")} className="text-[#0078D4] text-sm hover:underline">
          ← Back to Incidents
        </button>
      </div>
    );
  }

  const isBreached = pack.regulatoryExposure.actualFineExposure as number > 0;

  return (
    <div className="p-5 flex flex-col gap-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(`/incidents/${pack.incidentId}`)}
          className="mt-0.5 p-1.5 rounded hover:bg-[#EDEBE9] text-[#605E5C] transition-colors flex-none"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-[#323130]">NCC Evidence Pack</h1>
            <span className="px-2 py-0.5 rounded border border-[#D2D0CE] text-[10px] font-bold uppercase tracking-wider text-[#605E5C] bg-[#F3F2F1]">
              {pack.status}
            </span>
            <span
              className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                isBreached
                  ? "bg-[#FDE7E9] text-[#D13438] border-[#D13438]/20"
                  : "bg-[#DFF6DD] text-[#107C10] border-[#107C10]/20"
              }`}
            >
              {isBreached ? "Breach Occurred" : "Breach Avoided"}
            </span>
          </div>
          <p className="text-xs text-[#605E5C] mt-1">
            Ref: <span className="font-mono">{pack.reportRef}</span> · Generated {fmtDate(pack.generatedAt)}
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0078D4] text-white text-xs font-semibold rounded hover:bg-[#106EBE] transition-colors flex-none">
          <Download size={13} />
          Export PDF
        </button>
      </div>

      {/* Incident Reference Banner */}
      <div className="bg-[#243A5E] text-white rounded-lg px-5 py-4 flex items-center gap-4">
        <Shield size={32} className="text-[#C7E0F4] flex-none" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Incident Reference</p>
          <p className="font-mono font-bold text-base">{pack.incidentId}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-right">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Duration</p>
            <p className="font-mono text-sm font-bold text-white">{pack.kpis["Incident Duration"]}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Breach</p>
            <p className="font-mono text-sm font-bold" style={{ color: pack.kpis["Breach Avoided"] === "Yes" ? "#6FCF97" : "#EB5757" }}>
              {pack.kpis["Breach Avoided"] as string}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Incident Timeline */}
      <Section title="1. Incident Timeline" icon={Clock}>
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#EDEBE9]" />
          <div className="space-y-4">
            {pack.incidentTimeline.map((ev, i) => (
              <div key={i} className="relative flex items-start gap-3">
                <div
                  className="absolute -left-6 w-3.5 h-3.5 rounded-full border-2 border-white"
                  style={{ background: TIMELINE_COLORS[ev.type] ?? "#605E5C", top: 2 }}
                />
                <span className="font-mono text-[11px] text-[#605E5C] flex-none w-10">{ev.time}</span>
                <span className="text-[12px] text-[#323130]">{ev.event}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 2. Affected Services */}
      <Section title="2. Affected Services" icon={List}>
        <ul className="space-y-2">
          {pack.affectedServices.map((svc, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <AlertTriangle size={12} className="text-[#FF8C00] flex-none" />
              <span className="text-xs text-[#323130]">{svc}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 3. KPIs */}
      <Section title="3. Key Performance Indicators" icon={FileText}>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(pack.kpis).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F3F2F1]">
              <span className="text-[11px] text-[#605E5C]">{key}</span>
              <span className="font-mono text-xs font-bold text-[#323130]">{String(val)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Root Cause */}
      <Section title="4. Root Cause Analysis" icon={AlertTriangle}>
        <p className="text-sm text-[#323130] leading-relaxed">{pack.rootCause}</p>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-[#605E5C]">
          <CheckCircle2 size={11} className="text-[#107C10]" />
          Analysis validated by NetworkRiskAgent — confidence 87%
        </div>
      </Section>

      {/* 5. Corrective Actions */}
      <Section title="5. Corrective Actions Taken" icon={CheckCircle2}>
        <ol className="space-y-2">
          {pack.correctiveActions.map((action, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-mono text-xs text-[#0078D4] font-bold flex-none mt-0.5">{i + 1}.</span>
              <span className="text-xs text-[#323130]">{action}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* 6. Compensation Estimate */}
      <Section title="6. Compensation & SLA Liability" icon={DollarSign}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {Object.entries(pack.compensationEstimate)
            .filter(([k]) => k !== "basisNote")
            .map(([key, val]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F3F2F1]">
                <span className="text-[11px] text-[#605E5C] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="font-mono text-xs font-bold text-[#323130]">
                  {typeof val === "number" && key.toLowerCase().includes("ngn") ? fmtNGN(val) : String(val)}
                </span>
              </div>
            ))}
        </div>
        <p className="text-[11px] text-[#605E5C] italic">{pack.compensationEstimate.basisNote as string}</p>
      </Section>

      {/* 7. Evidence Logs */}
      <Section title="7. Evidence Logs" icon={FileText}>
        <div className="space-y-1.5">
          {pack.evidenceLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded bg-[#F3F2F1]">
              <span className="font-mono text-[10px] text-[#0078D4] font-bold flex-none">{i + 1}</span>
              <span className="font-mono text-[11px] text-[#605E5C]">{log}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 8. Regulatory Exposure */}
      <Section title="8. Regulatory Exposure" icon={Shield}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(pack.regulatoryExposure).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F3F2F1]">
              <span className="text-[11px] text-[#605E5C] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <span className="font-mono text-xs font-bold" style={{
                color: key === "actualFineExposure" && Number(val) === 0 ? "#107C10"
                  : key === "actualFineExposure" ? "#D13438"
                  : "#323130"
              }}>
                {typeof val === "number" && key.toLowerCase().includes("fine") ? fmtNGN(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
        <div className={`flex items-start gap-3 p-3 rounded-lg ${isBreached ? "bg-[#FDE7E9]" : "bg-[#DFF6DD]"}`}>
          <CheckCircle2 size={14} className={isBreached ? "text-[#D13438]" : "text-[#107C10]"} />
          <p className={`text-xs ${isBreached ? "text-[#D13438]" : "text-[#107C10]"}`}>
            {pack.regulatoryExposure.rationale as string}
          </p>
        </div>
      </Section>

      {/* Footer */}
      <div className="text-center py-4 text-[10px] text-[#A19F9D]">
        RiskGuard AI · {pack.reportRef} · Generated {fmtDate(pack.generatedAt)} · For regulatory submission purposes only
      </div>
    </div>
  );
}
