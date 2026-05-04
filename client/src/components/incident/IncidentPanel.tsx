import { useQuery } from "@tanstack/react-query";
import { api, Incident } from "../../lib/api";
import { AlertCircle, Users, Briefcase, DollarSign, ShieldAlert, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import React from "react";

interface IncidentPanelProps {
  incidentId: string | null;
  children?: React.ReactNode;
}

export function IncidentPanel({ incidentId, children }: IncidentPanelProps) {
  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["incident", incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}`).then((res) => res.data),
    enabled: !!incidentId,
    refetchInterval: 5000,
  });

  if (!incidentId) {
    return (
      <div className="panel-card h-full flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <ShieldAlert size={48} className="mb-4 opacity-20" />
        <h3 className="font-bold text-lg text-slate-300">No Active Incidents</h3>
        <p className="text-sm max-w-[240px]">Select an LGA from the Risk Radar to view live operational data.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="panel-card h-full animate-pulse" />;
  }

  if (!incident) return null;

  const metrics = [
    { label: "Affected Subs", value: incident.affectedSubscribers.toLocaleString(), sub: "+12% in 5m", color: "text-slate-900", subColor: "text-red-500" },
    { label: "Revenue at Risk", value: incident.revenueAtRisk, sub: "Projected Hourly", color: "text-slate-900", subColor: "text-red-500" },
    { label: "NCC Exposure", value: "Tier-1", sub: "High Compliance Risk", color: "text-slate-900", subColor: "text-amber-500" },
    { label: "Current Phase", value: incident.phase === "active" ? "ACTIVE" : "RECOVERY", sub: `ID: ${incident.id}`, color: incident.phase === "active" ? "text-red-600" : "text-green-600", subColor: "text-slate-400" },
  ];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-none">
        {metrics.map((m) => (
          <div key={m.label} className="panel-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{m.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${m.color}`}>{m.value}</p>
            <p className={`text-[10px] font-medium ${m.subColor}`}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        {/* Cause / Detail Card */}
        <div className="panel-card flex flex-col bg-white overflow-hidden">
          <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-tight">Incident Analysis</h3>
            <span className={`status-badge ${incident.phase === 'active' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
              {incident.phase}
            </span>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Root Cause Determination</p>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {incident.cause}
              </h2>
            </div>
            
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Event Sequence
              </p>
              <div className="space-y-4">
                {incident.timeline.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full border-2 border-slate-300 bg-white" />
                      {i !== incident.timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono font-bold text-slate-400">{step.time}</p>
                      <p className="text-xs font-medium text-slate-700 leading-snug">{step.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-slate-50 border-t flex justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Risk Level</p>
              <p className="text-lg font-mono font-bold text-red-600 tracking-tighter">{incident.riskScore}/100</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Time to Breach</p>
              <p className="text-lg font-mono font-bold text-slate-800 tracking-tighter">{incident.timeToBreach}</p>
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
