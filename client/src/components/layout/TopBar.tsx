import { Activity } from "lucide-react";
import { api } from "../../lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TopBarProps {
  agentThreshold: number;
  onAgentThresholdChange: (threshold: number) => void;
  onIncidentDetection: (id: string | null) => void;
}

const AGENT_THRESHOLDS = [65, 75, 85, 90];

export function TopBar({
  agentThreshold,
  onAgentThresholdChange,
  onIncidentDetection,
}: TopBarProps) {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: () => api.post("/simulation/start"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      onIncidentDetection(null);
    },
  });

  const mitigateMutation = useMutation({
    mutationFn: () => api.post("/simulation/mitigate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      queryClient.invalidateQueries({ queryKey: ["incident"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post("/simulation/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      onIncidentDetection(null);
    },
  });

  return (
    <header className="h-14 bg-white border-b border-border-base px-6 flex items-center justify-between sticky top-0 z-10 shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <Activity size={18} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-bold text-lg tracking-tight leading-none text-text-main">
            RiskGuard <span className="text-primary">AI</span>
          </h1>
          <div className="mt-1 px-1.5 py-0.5 bg-blue-soft rounded-sm text-[8px] font-bold uppercase tracking-widest text-primary border border-[#B3D7F2] inline-block w-fit">
            Operational Command
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-2.5 py-1.5 border border-border-base rounded bg-[#FAF9F8]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#605E5C]">
            Agent trigger
          </span>
          <select
            value={agentThreshold}
            onChange={(event) => onAgentThresholdChange(Number(event.target.value))}
            className="text-xs font-semibold text-text-main bg-white border border-border-base rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary"
          >
            {AGENT_THRESHOLDS.map((threshold) => (
              <option key={threshold} value={threshold}>
                {threshold}
              </option>
            ))}
          </select>
        </label>
        {/* <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded hover:bg-[#006CBE] disabled:opacity-50 transition-colors"
        >
          Start Simulation
        </button>
        <button
          onClick={() => mitigateMutation.mutate()}
          disabled={mitigateMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold border border-success text-success rounded hover:bg-success-soft disabled:opacity-50 transition-colors"
        >
          Apply Mitigation
        </button>
        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold border border-border-base text-[#605E5C] rounded hover:bg-background disabled:opacity-50 transition-colors"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset System"}
        </button> */}
      </div>
    </header>
  );
}
