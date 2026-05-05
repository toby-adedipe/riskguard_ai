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
    <header className="h-14 bg-white border-b px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
          <Activity size={18} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-bold text-lg tracking-tight leading-none text-slate-900">
            RiskGuard <span className="text-blue-600">AI</span>
          </h1>
          <div className="mt-1 px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 inline-block w-fit">
            Operational Command
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-2.5 py-1.5 border border-slate-200 rounded bg-slate-50">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Agent trigger
          </span>
          <select
            value={agentThreshold}
            onChange={(event) => onAgentThresholdChange(Number(event.target.value))}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
          >
            {AGENT_THRESHOLDS.map((threshold) => (
              <option key={threshold} value={threshold}>
                {threshold}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Start Simulation
        </button>
        <button
          onClick={() => mitigateMutation.mutate()}
          disabled={mitigateMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold border border-green-200 text-green-600 rounded hover:bg-green-50 disabled:opacity-50 transition-colors"
        >
          Apply Mitigation
        </button>
        <button 
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset System"}
        </button>
      </div>
    </header>
  );
}
