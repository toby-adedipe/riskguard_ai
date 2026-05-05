import { Play, Zap, Wrench, RotateCcw, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { useSimulation } from "../../context/SimulationContext";
import type { SimulationPhase } from "../../types";

const PHASES: { id: SimulationPhase; label: string; icon: React.ElementType; color: string }[] = [
  { id: "baseline", label: "Baseline", icon: Activity, color: "text-[#107C10]" },
  { id: "incident", label: "Trigger Ikeja", icon: Zap, color: "text-[#D13438]" },
  { id: "mitigation", label: "Mitigate", icon: Wrench, color: "text-[#FF8C00]" },
  { id: "recovery", label: "Recovery", icon: Play, color: "text-[#0078D4]" },
];

const PHASE_LABEL: Record<SimulationPhase, string> = {
  baseline: "All systems nominal — Lagos network stable",
  incident: "CRITICAL: Ikeja LGA risk score 87 — breach in 47 min",
  mitigation: "Mitigation in progress — traffic reroute approved",
  recovery: "Recovering — risk score dropping from 87 → 42",
};

const PHASE_COLOR: Record<SimulationPhase, string> = {
  baseline: "bg-[#DFF6DD] text-[#107C10] border-[#107C10]/20",
  incident: "bg-[#FDE7E9] text-[#D13438] border-[#D13438]/20",
  mitigation: "bg-[#FFF4CE] text-[#FF8C00] border-[#FF8C00]/20",
  recovery: "bg-[#C7E0F4]/40 text-[#0078D4] border-[#0078D4]/20",
};

export default function SimulationBar() {
  const { phase, setPhase } = useSimulation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex-none bg-white border-b border-[#D2D0CE] px-5 py-3 flex items-center gap-4">
      <div className="flex items-center gap-2 flex-none">
        <RotateCcw size={13} className="text-[#605E5C]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#605E5C]">
          Simulation
        </span>
      </div>

      <div className="flex items-center gap-1">
        {PHASES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPhase(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              phase === id
                ? "bg-[#0078D4] text-white shadow-sm"
                : "text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className={`flex-1 flex items-center justify-center`}>
        <span
          className={`px-3 py-1 rounded border text-[11px] font-semibold ${PHASE_COLOR[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-none text-[11px] text-[#605E5C]">
        <span className="font-mono">Lagos NOC</span>
        <span>·</span>
        <span className="font-mono">{now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>
    </header>
  );
}
