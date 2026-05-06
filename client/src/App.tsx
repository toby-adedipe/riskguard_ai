/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { RiskRadar } from "./components/risk/RiskRadar";
import { LGASummaryPanel } from "./components/lga/LGASummaryPanel";
import { IncidentPanel } from "./components/incident/IncidentPanel";
import { CopilotPanel } from "./components/copilot/CopilotPanel";
import { MitigationPanel } from "./components/mitigation/MitigationPanel";
import { CompliancePackView } from "./components/compliance/CompliancePack";
import { LiveInvestigation } from "./components/live/LiveInvestigation";
import { api } from "./lib/api";
import { DEFAULT_LGA_ID } from "./lib/lgas";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

interface SimulationCommandResponse {
  ok: boolean;
  status: { mode: string; incident_id: string | null };
  session_id?: string | null;
}

function Shell() {
  // LGA selection — Ikeja selected by default so the right panel is never empty
  const [selectedLgaId, setSelectedLgaId] = useState<string>(DEFAULT_LGA_ID);
  // Whether the user has drilled into incident detail mode (from LGA summary CTA)
  const [showIncidentDetail, setShowIncidentDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"incident" | "compliance">("incident");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [agentThreshold, setAgentThreshold] = useState(65);
  const queryClient = useQueryClient();

  const triggerIkeja = useMutation({
    mutationFn: () =>
      api.post<SimulationCommandResponse>("/simulation/trigger/ikeja", {
        agent_threshold: agentThreshold,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["riskMap"] });
      const incidentId = response.data.status.incident_id ?? "INC-2025-IKEJA-001";
      setSelectedIncidentId(incidentId);
      const sessionId = response.data.session_id;
      if (sessionId) setLiveSessionId(sessionId);
      setShowIncidentDetail(true);
    },
  });

  const handleSelectLGA = (lgaId: string) => {
    setSelectedLgaId(lgaId);
    // Going back to summary mode when user picks a different LGA
    setShowIncidentDetail(false);
  };

  const handleViewIncident = () => {
    // Ikeja is the only LGA with a live backend investigation
    if (selectedLgaId === "ikeja") {
      triggerIkeja.mutate();
    } else {
      // For other LGAs just show the operational panel without a live trigger
      setShowIncidentDetail(true);
    }
  };

  const handleDismissLive = () => {
    setLiveSessionId(null);
    setShowIncidentDetail(false);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <TopBar
        agentThreshold={agentThreshold}
        onAgentThresholdChange={setAgentThreshold}
        onIncidentDetection={(id) => {
          setSelectedIncidentId(id);
          if (id === null) {
            setLiveSessionId(null);
            setShowIncidentDetail(false);
          }
        }}
      />

      {liveSessionId ? (
        <LiveInvestigation
          sessionId={liveSessionId}
          incidentId={selectedIncidentId}
          onDismiss={handleDismissLive}
        />
      ) : (
        <main className="flex-1 flex overflow-hidden">
          {/* ── Left sidebar ── */}
          <aside className="w-96 bg-white border-r border-[#D2D0CE] flex flex-col flex-none shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
            <div className="px-4 py-3 border-b border-[#EDEBE9] flex-none bg-[#FAF9F8]">
              <h2 className="text-[10px] font-bold text-[#605E5C] uppercase tracking-[0.15em]">Risk Radar — LGAs</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RiskRadar
                selectedLgaId={selectedLgaId}
                onSelectLGA={handleSelectLGA}
              />
            </div>
          </aside>

          {/* ── Right panel ── */}
          <section className="flex-1 flex flex-col p-5 gap-4 overflow-hidden bg-background">
            {!showIncidentDetail ? (
              /* LGA Summary view — default */
              <LGASummaryPanel
                lgaId={selectedLgaId}
                onViewIncident={handleViewIncident}
                isTriggering={triggerIkeja.isPending}
              />
            ) : (
              /* Incident detail view — after CTA click */
              <>
                {/* Back button + tabs */}
                <div className="flex items-center gap-3 flex-none">
                  <button
                    onClick={() => setShowIncidentDetail(false)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#605E5C] border border-border-base rounded-md hover:bg-white transition-colors"
                  >
                    ← Back to {selectedLgaId.replace(/_/g, " ")}
                  </button>
                  <div className="flex bg-[#EDEBE9] p-1 rounded-md border border-[#D2D0CE]">
                    <button
                      onClick={() => setActiveTab("incident")}
                      className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                        activeTab === "incident"
                          ? "bg-white shadow-sm text-primary border border-[#D2D0CE]"
                          : "text-[#605E5C] hover:text-text-main"
                      }`}
                    >
                      Operational Command
                    </button>
                    <button
                      onClick={() => setActiveTab("compliance")}
                      className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                        activeTab === "compliance"
                          ? "bg-white shadow-sm text-primary border border-[#D2D0CE]"
                          : "text-[#605E5C] hover:text-text-main"
                      }`}
                    >
                      Compliance Documentation
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {activeTab === "incident" ? (
                    <IncidentPanel incidentId={selectedIncidentId}>
                      <CopilotPanel incidentId={selectedIncidentId} />
                      <MitigationPanel incidentId={selectedIncidentId} />
                    </IncidentPanel>
                  ) : (
                    <CompliancePackView incidentId={selectedIncidentId} />
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
