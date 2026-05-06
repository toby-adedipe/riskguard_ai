import { useQuery } from "@tanstack/react-query";
import { LGA, fetchRiskMap } from "../../lib/api";
import { LGA_BY_ID, PAST_INCIDENTS, PastIncident } from "../../lib/lgas";
import {
  MapPin,
  Radio,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Activity,
  Clock,
  Shield,
  Wifi,
} from "lucide-react";
import { motion } from "motion/react";

interface LGASummaryPanelProps {
  lgaId: string;
  onViewIncident: () => void;
  isTriggering: boolean;
}

// Static demo KPIs per LGA (fallback for non-live LGAs)
const DEMO_KPIS: Record<
  string,
  { subscribers: number; uptime: number; cells: number; latencyMs: number }
> = {
  ikeja: { subscribers: 284_000, uptime: 99.1, cells: 48, latencyMs: 38 },
  alimosho: { subscribers: 421_000, uptime: 98.7, cells: 62, latencyMs: 42 },
  apapa: { subscribers: 91_000, uptime: 97.4, cells: 22, latencyMs: 51 },
  surulere: { subscribers: 176_000, uptime: 99.4, cells: 31, latencyMs: 34 },
  eti_osa: { subscribers: 213_000, uptime: 99.6, cells: 38, latencyMs: 29 },
  ikorodu: { subscribers: 148_000, uptime: 98.9, cells: 27, latencyMs: 45 },
  mushin: { subscribers: 203_000, uptime: 98.2, cells: 33, latencyMs: 49 },
  agege: { subscribers: 195_000, uptime: 99.0, cells: 29, latencyMs: 41 },
  abuja_municipal: {
    subscribers: 318_000,
    uptime: 99.7,
    cells: 54,
    latencyMs: 27,
  },
  port_harcourt: {
    subscribers: 267_000,
    uptime: 96.8,
    cells: 44,
    latencyMs: 58,
  },
  kano_municipal: {
    subscribers: 392_000,
    uptime: 97.2,
    cells: 67,
    latencyMs: 55,
  },
  obio_akpor: { subscribers: 184_000, uptime: 98.5, cells: 31, latencyMs: 47 },
};

const DEFAULT_KPI = {
  subscribers: 120_000,
  uptime: 99.2,
  cells: 24,
  latencyMs: 40,
};

// Domain z-scores from incident simulation (same data used in live investigations)
const DOMAIN_Z_SCORES: Record<string, number> = {
  network: 6.5, // packet loss +6.5σ
  bts: 4.2, // power stability -4.2σ (7 sites down) — stored as magnitude
  complaints: 5.8, // complaint rate +5.8σ
  billing: 3.1, // billing failures +3.1σ
  recharge: 2.9, // recharge velocity -2.9σ — stored as magnitude
  social_media: 4.9, // social sentiment -4.9σ — stored as magnitude
};

// Seeded random function for deterministic randomization per LGA
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return Math.abs(hash);
}

// Get randomized z-scores for non-Ikeja LGAs, real values for Ikeja
function getDomainZScores(lgaId: string): Record<string, number> {
  if (lgaId === "ikeja") {
    return DOMAIN_Z_SCORES;
  }

  // For other LGAs, generate deterministic random z-scores
  const randomized: Record<string, number> = {};
  const domains = Object.keys(DOMAIN_Z_SCORES);

  for (const domain of domains) {
    const seed = hashString(`${lgaId}-${domain}`);
    const randomFactor = seededRandom(seed); // 0 to 1
    // Scale to range 1.5-7.5 (around the Ikeja range)
    randomized[domain] = 1.5 + randomFactor * 6;
  }

  return randomized;
}

// Map UI domain labels to z-score domain keys
const DOMAIN_MAPPING: Record<string, string> = {
  "Packet Loss & Latency": "network",
  "BTS Power Stability": "bts",
  "Customer Complaints": "complaints",
  "Billing System": "billing",
  "Recharge Velocity": "recharge",
  "Social Media Sentiment": "social_media",
};

// Define whether higher or lower z-scores are better for each domain
// Note: For bts, recharge, social_media — positive z-scores represent NEGATIVE anomalies (degradation)
// So they're marked "lower_is_better" to correctly interpret positive magnitudes as bad
const DOMAIN_DIRECTIONS: Record<
  string,
  "higher_is_better" | "lower_is_better"
> = {
  network: "lower_is_better", // packet loss — fewer anomalies is better
  bts: "lower_is_better", // BTS stability — positive z-score = degraded (7 sites down)
  complaints: "lower_is_better", // complaints — fewer anomalies is better
  billing: "lower_is_better", // billing failures — fewer anomalies is better
  recharge: "lower_is_better", // recharge — positive z-score = degraded
  social_media: "lower_is_better", // sentiment — positive z-score = negative sentiment
};

function getDomainHealth(domainLabel: string, lgaId: string, recovered?: boolean): number {
  const domainKey = DOMAIN_MAPPING[domainLabel];
  if (!domainKey) return 50;

  if (recovered) {
    // Post-recovery: deterministic healthy values in 88–97% range
    const seed = hashString(`recovered-${lgaId}-${domainKey}`);
    return 88 + seededRandom(seed) * 9;
  }

  const zScores = getDomainZScores(lgaId);
  const zScore = zScores[domainKey] ?? 0;
  const direction = DOMAIN_DIRECTIONS[domainKey];

  const effectiveScore = direction === "higher_is_better" ? zScore : -zScore;
  return Math.max(0, Math.min(100, (effectiveScore + 10) * 5));
}

function getDomainHealthTone(domainLabel: string, health: number): string {
  if (health > 70) return "#107C10"; // green
  if (health > 40) return "#FF8C00"; // amber
  return "#D13438"; // red
}

function getKpi(lgaId: string) {
  return DEMO_KPIS[lgaId] ?? DEFAULT_KPI;
}

function StatusBadge({ risk }: { risk: number }) {
  if (risk > 70)
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-danger text-white rounded-sm text-[10px] font-bold uppercase tracking-wider">
        <XCircle size={11} /> Critical
      </span>
    );
  if (risk > 40)
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-warning-soft text-warning border border-[#FFD08A] rounded-sm text-[10px] font-bold uppercase tracking-wider">
        <AlertTriangle size={11} /> Warning
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-success-soft text-success border border-[#A3D9A3] rounded-sm text-[10px] font-bold uppercase tracking-wider">
      <CheckCircle2 size={11} /> All Systems Normal
    </span>
  );
}

function RiskRing({ risk }: { risk: number }) {
  const size = 96;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(risk / 100, 1));
  const color = risk > 70 ? "#D13438" : risk > 40 ? "#FF8C00" : "#107C10";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="#EDEBE9"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-bold font-mono leading-none"
          style={{ color }}
        >
          {risk}
        </span>
        <span className="text-[8px] text-[#605E5C] font-mono">/100</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warning" | "success" | "neutral";
}) {
  const valueColor =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-text-main";
  return (
    <div className="bg-[#FAF9F8] border border-[#EDEBE9] rounded-md p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[#605E5C]">
        <Icon size={11} />
        <span className="text-[9px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-base font-bold font-mono leading-none ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-[#A19F9D]">{sub}</p>}
    </div>
  );
}

function IncidentRow({ inc }: { inc: PastIncident }) {
  return (
    <tr className="border-b border-[#EDEBE9] hover:bg-[#FAF9F8] transition-colors">
      <td className="py-2.5 px-3">
        <span className="font-mono text-[10px] text-[#605E5C]">{inc.id}</span>
      </td>
      <td className="py-2.5 px-3 text-[11px] text-text-main">{inc.cause}</td>
      <td className="py-2.5 px-3 text-[10px] text-[#605E5C] font-mono whitespace-nowrap">
        {inc.date}
      </td>
      <td className="py-2.5 px-3 text-[10px] font-mono text-[#605E5C] whitespace-nowrap">
        {inc.duration}
      </td>
      <td className="py-2.5 px-3 text-[10px] font-mono">
        {inc.affectedSubs.toLocaleString()}
      </td>
      <td className="py-2.5 px-3">
        <span
          className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${inc.resolved ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
          {inc.resolved ? "Resolved" : "Open"}
        </span>
      </td>
    </tr>
  );
}

export function LGASummaryPanel({
  lgaId,
  onViewIncident,
  isTriggering,
}: LGASummaryPanelProps) {
  const { data: lgas } = useQuery<LGA[]>({
    queryKey: ["riskMap"],
    queryFn: fetchRiskMap,
    refetchInterval: 5000,
  });

  const liveLga = lgas?.find((l) => l.id === lgaId);
  const risk = liveLga?.risk ?? 12;
  const meta = LGA_BY_ID[lgaId];
  const kpi = getKpi(lgaId);
  const storedResolved = JSON.parse(localStorage.getItem(`rg_resolved_${lgaId}`) ?? "[]") as PastIncident[];
  const staticIncidents = lgaId === "ikeja" ? [] : (PAST_INCIDENTS[lgaId] ?? []);
  const seen = new Set<string>();
  const pastIncidents = [...storedResolved, ...staticIncidents].filter((inc) => {
    if (seen.has(inc.id)) return false;
    seen.add(inc.id);
    return true;
  });
  const isHighRisk = risk > 40;
  const isRecovered = storedResolved.length > 0 && lgaId === "ikeja";

  // Whether this LGA can trigger a live investigation (only Ikeja has backend support)
  const canInvestigate = lgaId === "ikeja";

  return (
    <motion.div
      key={lgaId}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-4 h-full overflow-y-auto"
    >
      {/* ── Header ─────────────────────────────────── */}
      <div className="panel-card bg-white flex-none">
        <div className="px-5 py-4 border-b border-[#EDEBE9] bg-[#FAF9F8] flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary rounded-md">
              <MapPin size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main leading-tight">
                {meta?.name ?? lgaId}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[#605E5C] font-medium">
                  {meta?.city ?? "—"}
                </span>
                <span className="text-[#D2D0CE]">·</span>
                <span className="text-[10px] text-[#605E5C]">
                  {meta?.state ?? "—"} State
                </span>
                <span className="text-[#D2D0CE]">·</span>
                <span className="text-[10px] font-mono text-[#605E5C]">
                  {meta?.tower_prefix}-*
                </span>
              </div>
            </div>
          </div>
          <StatusBadge risk={risk} />
        </div>

        {/* Risk + KPIs */}
        <div className="px-5 py-4 flex items-center gap-6">
          <div className="flex flex-col items-center gap-1 flex-none">
            <RiskRing risk={risk} />
            <span className="text-[9px] font-semibold text-[#605E5C] uppercase tracking-wider">
              Risk Score
            </span>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2.5">
            <KpiCard
              icon={Users}
              label="Subscribers"
              value={kpi.subscribers.toLocaleString()}
              sub="Active MSISDNs"
            />
            <KpiCard
              icon={Wifi}
              label="Network Uptime"
              value={`${kpi.uptime}%`}
              sub="Rolling 30d"
              tone={kpi.uptime < 98 ? "warning" : "success"}
            />
            <KpiCard
              icon={Radio}
              label="Active Cells"
              value={kpi.cells.toString()}
              sub="BTS online"
            />
            <KpiCard
              icon={Zap}
              label="Avg Latency"
              value={`${kpi.latencyMs} ms`}
              sub="Core roundtrip"
              tone={kpi.latencyMs > 50 ? "warning" : "success"}
            />
          </div>
        </div>

        {/* CTA — show only if risk is elevated or it's Ikeja */}
        {(isHighRisk || canInvestigate) && (
          <div
            className={`px-5 py-3 border-t flex items-center justify-between ${
              isRecovered
                ? "bg-success-soft border-[#A3D9A3]"
                : isHighRisk
                  ? "bg-danger-soft border-[#F5C6C7]"
                  : "bg-blue-soft border-[#B3D7F2]"
            }`}
          >
            <div className="flex items-center gap-2">
              {isRecovered ? (
                <CheckCircle2 size={14} className="text-success" />
              ) : isHighRisk ? (
                <AlertTriangle size={14} className="text-danger" />
              ) : (
                <Activity size={14} className="text-primary" />
              )}
              <p
                className={`text-xs font-semibold ${isRecovered ? "text-success" : isHighRisk ? "text-danger" : "text-primary"}`}
              >
                {isRecovered
                  ? "Incident contained — network stabilising"
                  : isHighRisk
                    ? "Risk threshold breached — immediate investigation required"
                    : `Simulate network incident for ${meta?.name ?? lgaId}`}
              </p>
            </div>
            <button
              onClick={onViewIncident}
              disabled={isTriggering}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors disabled:opacity-60 ${
                isRecovered
                  ? "bg-success text-white hover:bg-[#0a6a0a]"
                  : isHighRisk
                    ? "bg-danger text-white hover:bg-[#b02c30]"
                    : "bg-primary text-white hover:bg-[#006CBE]"
              }`}
            >
              {isTriggering ? "Launching..." : isRecovered ? "View Incident Report" : "View Active Incident"}
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── System Health ──────────────────────────── */}
      <div className="panel-card bg-white flex-none">
        <div className="px-4 py-3 border-b border-[#EDEBE9] bg-[#FAF9F8]">
          <h3 className="text-[10px] font-bold text-[#605E5C] uppercase tracking-widest flex items-center gap-2">
            <Shield size={12} />
            Domain Health Overview
          </h3>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-2.5">
          {[
            "Packet Loss & Latency",
            "BTS Power Stability",
            "Customer Complaints",
            "Billing System",
            "Recharge Velocity",
            "Social Media Sentiment",
          ].map((label) => {
            const pct = getDomainHealth(label, lgaId, isRecovered);
            const tone = lgaId === "ikeja" ? getDomainHealthTone(label, pct) : "#107C10";
            return (
              <div key={label}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-text-main font-medium">{label}</span>
                  <span className="font-mono text-[#605E5C]">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#EDEBE9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: tone }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Past Incidents ────────────────────────── */}
      <div className="panel-card bg-white flex-none">
        <div className="px-4 py-3 border-b border-[#EDEBE9] bg-[#FAF9F8] flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#605E5C] uppercase tracking-widest flex items-center gap-2">
            <Clock size={12} />
            Past Incidents
          </h3>
          <span className="text-[10px] font-mono text-[#605E5C]">
            {pastIncidents.length} record{pastIncidents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {pastIncidents.length === 0 ? (
          <div className="px-4 py-8 flex flex-col items-center gap-2 text-center text-[#A19F9D]">
            <CheckCircle2 size={28} className="opacity-30" />
            <p className="text-xs font-medium">
              No incidents recorded for this LGA
            </p>
            <p className="text-[10px]">
              Network has been operating within normal parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-background">
                <tr>
                  {[
                    "Ref ID",
                    "Cause",
                    "Date",
                    "Duration",
                    "Affected Subs",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[9px] font-bold text-[#605E5C] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastIncidents.map((inc) => (
                  <IncidentRow key={inc.id} inc={inc} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
