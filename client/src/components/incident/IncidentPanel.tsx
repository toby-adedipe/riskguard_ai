import { useQuery } from "@tanstack/react-query";
import { Incident, fetchIncident } from "../../lib/api";
import { ShieldAlert } from "lucide-react";
import React from "react";

interface IncidentPanelProps {
  incidentId: string | null;
  children?: React.ReactNode;
}

export function IncidentPanel({ incidentId, children }: IncidentPanelProps) {
  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["incident", incidentId],
    queryFn: () => fetchIncident(incidentId),
    enabled: !!incidentId,
    refetchInterval: 5000,
  });

  if (!incidentId) {
    return (
      <div className="panel-card h-full flex flex-col items-center justify-center p-12 text-center text-[#605E5C]">
        <ShieldAlert size={48} className="mb-4 opacity-20" />
        <h3 className="font-bold text-lg text-[#A19F9D]">No Active Incidents</h3>
        <p className="text-sm max-w-[240px]">Select an LGA from the Risk Radar to view live operational data.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="panel-card h-full animate-pulse" />;
  }

  if (!incident) return null;

  const metrics = [
    { label: "Affected Subs", value: incident.affectedSubscribers.toLocaleString(), sub: "+12% in 5m", color: "text-text-main", subColor: "text-danger" },
    { label: "Revenue at Risk", value: incident.revenueAtRisk, sub: "Projected Hourly", color: "text-text-main", subColor: "text-danger" },
    { label: "NCC Exposure", value: "Tier-1", sub: "High Compliance Risk", color: "text-text-main", subColor: "text-warning" },
    { label: "Current Phase", value: incident.phase === "active" ? "ACTIVE" : "RECOVERY", sub: `ID: ${incident.id}`, color: incident.phase === "active" ? "text-danger" : "text-success", subColor: "text-[#605E5C]" },
  ];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-none">
        {metrics.map((m) => (
          <div key={m.label} className="panel-card p-4 bg-white">
            <p className="text-[10px] font-bold text-[#605E5C] uppercase tracking-wider mb-1">{m.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${m.color}`}>{m.value}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${m.subColor}`}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        <div className="panel-card flex flex-col bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDEBE9] bg-[#FAF9F8] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#605E5C] uppercase tracking-widest">Incident Analysis</h3>
            <span className={`status-badge ${incident.phase === 'active' ? 'bg-danger-soft text-danger border-[#F5C6C7]' : 'bg-success-soft text-success border-[#A3D9A3]'}`}>
              {incident.phase}
            </span>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold text-[#605E5C] uppercase tracking-wider mb-1">Root Cause Determination</p>
              <h2 className="text-lg font-bold text-text-main leading-tight">
                {incident.cause}
              </h2>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#605E5C] uppercase mb-3 tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                Event Sequence
              </p>
              <div className="space-y-4">
                {incident.timeline.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full border-2 border-border-base bg-white" />
                      {i !== incident.timeline.length - 1 && <div className="w-px flex-1 bg-border-base my-1" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono font-bold text-[#605E5C]">{step.time}</p>
                      <p className="text-xs font-medium text-text-main leading-snug">{step.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-[#FAF9F8] border-t border-[#EDEBE9] flex justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#605E5C] uppercase tracking-wider">Risk Level</p>
              <p className="text-lg font-mono font-bold text-danger tracking-tighter">{incident.riskScore}/100</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#605E5C] uppercase tracking-wider">Time to Breach</p>
              <p className="text-lg font-mono font-bold text-text-main tracking-tighter">{incident.timeToBreach}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
