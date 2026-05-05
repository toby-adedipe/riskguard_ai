import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CopilotResponse, fetchCopilot } from "../../lib/api";
import { Bot, Search, Info, Lightbulb, CheckCircle2, ChevronDown, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface CopilotPanelProps {
  incidentId: string | null;
}

const ROLES = [
  { id: "network_risk", label: "Network Operations" },
  { id: "revenue_assurance", label: "Revenue Assurance" },
  { id: "customer_experience", label: "Customer Experience" },
  { id: "mitigation", label: "Tactical Mitigation" },
  { id: "compliance", label: "Legal & Compliance" },
];

export function CopilotPanel({ incidentId }: CopilotPanelProps) {
  const [role, setRole] = useState("network_risk");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CopilotResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { role: string; query: string; incident_id: string }) =>
      fetchCopilot(payload),
    onSuccess: (data) => {
      setResponse(data);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentId || !query.trim()) return;
    mutation.mutate({ role, query, incident_id: incidentId });
  };

  return (
    <div className="panel-card flex flex-col bg-white min-h-[300px]">
      <div className="p-3 border-b flex items-center justify-between bg-slate-50">
        <h3 className="text-xs font-bold text-slate-600 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          COPILOT INVESTIGATION
        </h3>
        <span className="text-[10px] text-slate-400 italic">Validation: {response?.validation_status || "Pending..."}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!response && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 py-8 text-slate-900">
            <Bot size={32} />
            <p className="text-xs mt-2 font-medium">Ready for investigation query</p>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex flex-col gap-3">
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
          </div>
        )}

        <AnimatePresence>
          {response && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="p-3 bg-white border border-slate-200 rounded">
                <p className="text-xs leading-relaxed text-slate-800">{response.answer}</p>
              </div>

              {/* Facts (Blue Soft) */}
              <div className="p-3 bg-blue-soft border border-blue-100 rounded">
                <div className="flex items-center gap-2 mb-1 text-blue-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Facts</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">{response.facts}</p>
              </div>

              {/* Inferences (Warning Soft) */}
              <div className="p-3 bg-warning-soft border border-amber-100 rounded">
                <div className="flex items-center gap-2 mb-1 text-amber-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Inferences</span>
                </div>
                <p className="text-xs leading-relaxed italic text-slate-700">{response.inferences}</p>
              </div>

              {/* Recommendations (Success Soft) */}
              <div className="p-3 bg-success-soft border border-green-100 rounded">
                <div className="flex items-center gap-2 mb-1 text-green-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Recommendations</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 font-medium">{response.recommendations}</p>
              </div>

              {response.sources.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="flex items-center gap-2 mb-1 text-slate-600">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sources</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {response.sources.map((source) => (
                      <span
                        key={source.evidenceId}
                        title={source.label}
                        className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-600"
                      >
                        {source.evidenceId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-slate-50 border-t flex gap-2">
        <select 
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-xs border border-slate-200 rounded p-1 bg-white outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask copilot about mitigation..."
          className="flex-1 text-xs border border-slate-200 rounded px-2 bg-white outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          disabled={!incidentId || mutation.isPending}
        />
        <button 
          type="submit"
          disabled={!incidentId || mutation.isPending || !query.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
