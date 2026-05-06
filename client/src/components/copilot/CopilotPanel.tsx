import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CopilotResponse, fetchCopilot } from "../../lib/api";
import { Bot, Send } from "lucide-react";
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
      <div className="px-4 py-3 border-b border-[#EDEBE9] flex items-center justify-between bg-[#FAF9F8]">
        <h3 className="text-xs font-bold text-[#605E5C] flex items-center gap-2 uppercase tracking-widest">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          Copilot Investigation
        </h3>
        <span className="text-[10px] text-[#605E5C] font-mono">Validation: {response?.validation_status || "Pending"}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!response && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 py-8 text-text-main">
            <Bot size={32} />
            <p className="text-xs mt-2 font-medium">Ready for investigation query</p>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex flex-col gap-3">
            <div className="h-4 bg-background rounded w-full animate-pulse" />
            <div className="h-4 bg-background rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-background rounded w-1/2 animate-pulse" />
          </div>
        )}

        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="p-3 bg-white border border-border-base rounded-md">
                <p className="text-xs leading-relaxed text-text-main">{response.answer}</p>
              </div>

              <div className="p-3 bg-blue-soft border border-[#B3D7F2] rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#004578]">Facts</span>
                </div>
                <p className="text-xs leading-relaxed text-text-main">{response.facts}</p>
              </div>

              <div className="p-3 bg-warning-soft border border-[#FFD08A] rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B5A00]">Inferences</span>
                </div>
                <p className="text-xs leading-relaxed italic text-text-main">{response.inferences}</p>
              </div>

              <div className="p-3 bg-success-soft border border-[#A3D9A3] rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#054A05]">Recommendations</span>
                </div>
                <p className="text-xs leading-relaxed text-text-main font-medium">{response.recommendations}</p>
              </div>

              {response.sources.length > 0 && (
                <div className="p-3 bg-[#FAF9F8] border border-border-base rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#605E5C]">Sources</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {response.sources.map((source) => (
                      <span
                        key={source.evidenceId}
                        title={source.label}
                        className="px-1.5 py-0.5 rounded-sm border border-border-base bg-white text-[10px] font-mono text-[#605E5C]"
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

      <form onSubmit={handleSubmit} className="p-3 bg-[#FAF9F8] border-t border-[#EDEBE9] flex gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-xs border border-border-base rounded-sm p-1 bg-white outline-none focus:ring-1 focus:ring-primary text-text-main"
        >
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask copilot about mitigation..."
          className="flex-1 text-xs border border-border-base rounded-sm px-2 bg-white outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 text-text-main placeholder:text-[#A19F9D]"
          disabled={!incidentId || mutation.isPending}
        />
        <button
          type="submit"
          disabled={!incidentId || mutation.isPending || !query.trim()}
          className="px-3 py-1 bg-primary text-white rounded-sm text-xs font-bold hover:bg-[#006CBE] transition-colors disabled:opacity-50"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
