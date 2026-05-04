import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, MitigationAction } from "../../lib/api";
import { ShieldCheck, ArrowRight, TrendingDown, Target, Zap } from "lucide-react";
import { motion } from "motion/react";

interface MitigationPanelProps {
  incidentId: string | null;
}

export function MitigationPanel({ incidentId }: MitigationPanelProps) {
  const queryClient = useQueryClient();

  const { data: actions, isLoading } = useQuery<MitigationAction[]>({
    queryKey: ["mitigationActions", incidentId],
    queryFn: () => api.post("/actions/simulate", { incident_id: incidentId }).then(res => res.data),
    enabled: !!incidentId,
  });

  const approveMutation = useMutation({
    mutationFn: (actionId: string) => api.post("/actions/approve", { action_id: actionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      queryClient.invalidateQueries({ queryKey: ["incident"] });
    },
  });

  if (!incidentId) return null;

  return (
    <div className="panel-card flex flex-col bg-white">
      <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-tight">Mitigation Strategy Panel</h3>
        <span className="text-[10px] text-slate-400 font-mono">SIMULATION ACTIVE</span>
      </div>

      <div className="p-0 overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-500 uppercase text-[9px] sticky top-0">
            <tr>
              <th className="p-3 font-bold">Action</th>
              <th className="p-3 font-bold text-right">Risk Red.</th>
              <th className="p-3 font-bold text-right">Conf.</th>
              <th className="p-3 font-bold text-right">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(3)].map((_, i) => (
              <tr key={i} className="animate-pulse bg-slate-50">
                <td className="p-3 h-10" colSpan={4}></td>
              </tr>
            ))}
            {actions?.map((action) => (
              <tr 
                key={action.id} 
                className={`hover:bg-slate-50 transition-colors ${action.id === 'action-1' ? 'bg-blue-50/30' : ''}`}
              >
                <td className="p-3">
                  <div className="font-bold text-slate-800">{action.name}</div>
                  <div className="text-[9px] text-slate-500">{action.timeToEffect} effect lag</div>
                </td>
                <td className="p-3 text-right">
                  <span className={`font-bold ${action.riskReduction > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {action.riskReduction > 0 ? `-${action.riskReduction}%` : `+14%`}
                  </span>
                </td>
                <td className="p-3 text-right text-slate-500 font-mono">
                  {(action.confidence * 100).toFixed(0)}%
                </td>
                <td className="p-3 text-right">
                  {action.id !== 'baseline' ? (
                    <button 
                      onClick={() => approveMutation.mutate(action.id)}
                      disabled={approveMutation.isPending}
                      className="text-blue-600 font-bold hover:underline disabled:opacity-50"
                    >
                      {approveMutation.isPending ? "..." : "Select"}
                    </button>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t bg-slate-50/50 mt-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recovery Projection</span>
          <span className="text-[10px] text-green-600 font-bold uppercase">Target: 42 Risk Score</span>
        </div>
        <div className="h-12 w-full flex items-end gap-0.5">
          <div className="flex-1 bg-red-500 h-[87%]" />
          <div className="flex-1 bg-red-400 h-[82%]" />
          <div className="flex-1 bg-red-300 h-[78%]" />
          <div className="flex-1 bg-blue-100 h-[60%]" />
          <div className="flex-1 bg-blue-200 h-[55%]" />
          <div className="flex-1 bg-blue-400 h-[48%]" />
          <div className="flex-1 bg-green-500 h-[42%]" />
        </div>
      </div>
    </div>
  );
}
