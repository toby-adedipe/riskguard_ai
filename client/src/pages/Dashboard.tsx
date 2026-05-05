import { useNavigate } from "react-router-dom";
import NigeriaMap from "@react-map/nigeria";
import {
  AlertTriangle,
  Users,
  TrendingDown,
  Clock,
  ChevronRight,
  Radio,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSimulation } from "../context/SimulationContext";
import { getLGAs, RISK_SCORE_HISTORY, INCIDENTS, getNationalStates } from "../data/dummy";
import RiskBadge from "../components/ui/RiskBadge";
import ScoreRing from "../components/ui/ScoreRing";
import type { LGA } from "../types";
import type { NationalState } from "../data/dummy";

function fmt(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}
function fmtNGN(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n}`;
}

function scoreColor(score: number) {
  if (score >= 75) return "#D13438";
  if (score >= 55) return "#FF8C00";
  if (score >= 35) return "#C19C00";
  return "#107C10";
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#D2D0CE] rounded-lg p-4 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-none"
        style={{ background: accent + "1A" }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C] mb-1">{label}</p>
        <p className="font-mono text-xl font-bold text-[#323130] leading-none">{value}</p>
        {sub && <p className="text-[11px] text-[#605E5C] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function LGARow({ lga, onClick }: { lga: LGA; onClick: () => void }) {
  const bar = `${lga.score}%`;
  const color = scoreColor(lga.score);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F3F2F1] transition-colors text-left group border-b border-[#EDEBE9] last:border-0"
    >
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-none" style={{ borderColor: color }}>
        <span className="font-mono text-[10px] font-bold" style={{ color }}>{lga.score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-[#323130] truncate">{lga.name}</span>
          <RiskBadge status={lga.status} />
        </div>
        <div className="w-full h-1.5 bg-[#EDEBE9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: bar, background: color }}
          />
        </div>
      </div>
      {lga.timeToBreach && (
        <div className="flex-none text-right">
          <p className="font-mono text-xs font-bold text-[#D13438]">{lga.timeToBreach}m</p>
          <p className="text-[9px] text-[#605E5C]">to breach</p>
        </div>
      )}
      <ChevronRight size={14} className="text-[#C8C6C4] group-hover:text-[#605E5C] flex-none" />
    </button>
  );
}

function riskFill(score: number): string {
  if (score >= 75) return "#D13438";
  if (score >= 55) return "#FF8C00";
  if (score >= 40) return "#C19C00";
  if (score >= 25) return "#7DB8DE";
  return "#B8DDB8";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { phase } = useSimulation();
  const lgas = getLGAs(phase);
  const nationalStates = getNationalStates(phase);
  const chartData = RISK_SCORE_HISTORY[phase];

  const activeIncidents = INCIDENTS.filter((i) => i.status !== "resolved");
  const criticalLGAs = lgas.filter((l) => l.status === "critical" || l.status === "high");
  const subscribersAtRisk = lgas
    .filter((l) => l.status === "critical" || l.status === "high")
    .reduce((s, l) => s + l.subscribers, 0);

  const ikejaLGA = lgas.find((l) => l.id === "ikeja");
  const ikejaScore = ikejaLGA?.score ?? 0;

  function handleLGAClick(lga: LGA) {
    if (lga.incidentId) navigate(`/incidents/${lga.incidentId}`);
    else navigate("/incidents");
  }

  function handleStateClick(stateName: string | null) {
    if (!stateName) return;
    const match = nationalStates.find((s) => s.name === stateName);
    if (match?.incidentId) navigate(`/incidents/${match.incidentId}`);
  }

  // Build cityColors for @react-map/nigeria
  const cityColors: Record<string, string> = {};
  nationalStates.forEach((s) => {
    cityColors[s.name] = riskFill(s.score);
  });

  return (
    <div className="p-5 flex flex-col gap-5 h-full">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Active Incidents"
          value={String(activeIncidents.length)}
          sub={phase === "baseline" ? "All clear" : "Ikeja — critical"}
          icon={AlertTriangle}
          accent="#D13438"
        />
        <KPICard
          label="Critical / High LGAs"
          value={`${criticalLGAs.length} / 10`}
          sub={`${criticalLGAs.map((l) => l.name).join(", ") || "None"}`}
          icon={Radio}
          accent="#FF8C00"
        />
        <KPICard
          label="Subscribers at Risk"
          value={fmt(subscribersAtRisk)}
          sub={phase === "baseline" ? "Zero exposure" : "Across critical zones"}
          icon={Users}
          accent="#0078D4"
        />
        <KPICard
          label="Revenue at Risk"
          value={
            phase === "baseline"
              ? "₦0"
              : phase === "recovery"
              ? "₦2.5M"
              : "₦8.7M"
          }
          sub={phase === "recovery" ? "Recovering — reroute applied" : undefined}
          icon={TrendingDown}
          accent="#C19C00"
        />
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 min-h-0">
        {/* Left: Chart + Map */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Risk Score Trend */}
          <div className="bg-white border border-[#D2D0CE] rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
                  Ikeja LGA — Risk Score Trend
                </p>
                <p className="text-xs text-[#605E5C] mt-0.5">Real-time anomaly composite score (0–100)</p>
              </div>
              <ScoreRing score={ikejaScore} size={64} />
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={scoreColor(ikejaScore)} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={scoreColor(ikejaScore)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#605E5C" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#605E5C" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: "1px solid #D2D0CE", borderRadius: 4 }}
                  formatter={(v: number) => [v, "Risk Score"]}
                />
                <ReferenceLine y={65} stroke="#FF8C00" strokeDasharray="3 2" strokeWidth={1} label={{ value: "Warning", position: "right", fontSize: 9, fill: "#FF8C00" }} />
                <ReferenceLine y={80} stroke="#D13438" strokeDasharray="3 2" strokeWidth={1} label={{ value: "Critical", position: "right", fontSize: 9, fill: "#D13438" }} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={scoreColor(ikejaScore)}
                  strokeWidth={2}
                  fill="url(#scoreGrad)"
                  dot={{ r: 3, fill: scoreColor(ikejaScore), strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Nigeria Risk Map */}
          <div className="flex-1 bg-white border border-[#D2D0CE] rounded-lg p-4 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-none">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
                Nigeria Network Risk Map
              </p>
              <span className="text-[10px] text-[#A19F9D]">{nationalStates.length} states monitored</span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-2 flex-none">
              {[
                { label: "Safe", color: "#B8DDB8" },
                { label: "Low", color: "#7DB8DE" },
                { label: "Medium", color: "#C19C00" },
                { label: "High", color: "#FF8C00" },
                { label: "Critical", color: "#D13438" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: item.color }} />
                  <span className="text-[10px] text-[#605E5C]">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
              <NigeriaMap
                type="select-single"
                cityColors={cityColors}
                mapColor="#EEF0F0"
                strokeColor="#ffffff"
                strokeWidth={0.6}
                hoverColor="#243A5E"
                hints
                hintBackgroundColor="#243A5E"
                hintTextColor="#ffffff"
                hintBorderRadius={4}
                onSelect={handleStateClick}
                size={480}
              />
            </div>
          </div>
        </div>

        {/* Right: LGA Risk List */}
        <div className="bg-white border border-[#D2D0CE] rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDEBE9] flex items-center justify-between flex-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
              Risk Radar — All LGAs
            </p>
            <Clock size={13} className="text-[#605E5C]" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {[...lgas]
              .sort((a, b) => b.score - a.score)
              .map((lga) => (
                <LGARow key={lga.id} lga={lga} onClick={() => handleLGAClick(lga)} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
