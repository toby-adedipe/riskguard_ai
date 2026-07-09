import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MitigationAction, approveAction, fetchMitigationActions } from "../../lib/api";
import { useState } from "react";

interface MitigationPanelProps {
  incidentId: string | null;
}

export function MitigationPanel({ incidentId }: MitigationPanelProps) {
  const queryClient = useQueryClient();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const { data: actions, isLoading } = useQuery<MitigationAction[]>({
    queryKey: ["mitigationActions", incidentId],
    queryFn: () => fetchMitigationActions(incidentId || ""),
    enabled: !!incidentId,
  });

  const approveMutation = useMutation({
    mutationFn: (actionId: string) => approveAction({ incidentId, actionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      queryClient.invalidateQueries({ queryKey: ["incident"] });
      queryClient.invalidateQueries({ queryKey: ["simulationStatus"] });
    },
  });

  if (!incidentId) return null;

  const selectedAction =
    actions?.find((action) => action.id === selectedActionId) ?? actions?.[0];
  const projectedTarget = selectedAction?.projectedScoreCurve.at(-1);

  return (
    <div className="panel-card flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-[#EDEBE9] bg-[#FAF9F8] flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#605E5C] uppercase tracking-widest">Mitigation Strategy</h3>
        <span className="text-[10px] text-[#605E5C] font-mono uppercase tracking-wider">Simulation Active</span>
      </div>

      <div className="p-0 overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-background text-[#605E5C] uppercase text-[9px] sticky top-0">
            <tr>
              <th className="px-4 py-2.5 font-bold tracking-wider">Action</th>
              <th className="px-4 py-2.5 font-bold text-right tracking-wider">Risk Δ</th>
              <th className="px-4 py-2.5 font-bold text-right tracking-wider">Conf.</th>
              <th className="px-4 py-2.5 font-bold text-right tracking-wider">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDEBE9]">
            {isLoading && [...Array(3)].map((_, i) => (
              <tr key={i} className="animate-pulse bg-[#FAF9F8]">
                <td className="p-3 h-10" colSpan={4}></td>
              </tr>
            ))}
            {actions?.map((action) => (
              <tr
                key={action.id}
                className={`hover:bg-[#FAF9F8] transition-colors ${action.id === selectedAction?.id ? "bg-blue-soft/30" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-bold text-text-main">{action.name}</div>
                  <div className="text-[9px] text-[#605E5C] mt-0.5">{action.timeToEffect} effect lag</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${action.riskReduction > 0 ? "text-success" : "text-[#605E5C]"}`}>
                    {action.riskReduction > 0 ? `-${action.riskReduction} pts` : "N/A"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[#605E5C] font-mono">
                  {(action.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 text-right">
                  {action.id !== "baseline" ? (
                    <button
                      onClick={() => {
                        setSelectedActionId(action.id);
                        approveMutation.mutate(action.id);
                      }}
                      disabled={approveMutation.isPending}
                      className="text-primary font-bold hover:underline disabled:opacity-50 text-xs"
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

      <div className="px-4 py-3 border-t border-[#EDEBE9] bg-[#FAF9F8] mt-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-[#605E5C] uppercase tracking-widest">Recovery Projection</span>
          <span className="text-[10px] text-success font-bold uppercase tracking-wide">
            {projectedTarget === undefined
              ? "Select an action"
              : `Projected target: ${projectedTarget} risk score`}
          </span>
        </div>
        <div className="h-10 w-full flex items-end gap-0.5 rounded overflow-hidden">
          {selectedAction?.projectedScoreCurve.map((score, index) => (
            <div
              key={`${selectedAction.id}-${index}`}
              className={`flex-1 ${score > 70 ? "bg-danger" : score > 40 ? "bg-warning" : "bg-success"}`}
              style={{ height: `${Math.max(4, Math.min(100, score))}%` }}
              title={`Projected risk score ${score}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
