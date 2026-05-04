/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { RiskRadar } from "./components/risk/RiskRadar";
import { IncidentPanel } from "./components/incident/IncidentPanel";
import { CopilotPanel } from "./components/copilot/CopilotPanel";
import { MitigationPanel } from "./components/mitigation/MitigationPanel";
import { CompliancePackView } from "./components/compliance/CompliancePack";
import { RecoveryView } from "./components/risk/RecoveryView";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"incident" | "compliance">("incident");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
        <TopBar onIncidentDetection={(id) => setSelectedIncidentId(id)} />
        
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar: Risk Radar */}
          <aside className="w-72 bg-white border-r flex flex-col flex-none">
            <div className="p-4 border-b flex-none">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Risk Radar (LGAs)</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RiskRadar 
                onSelectLGA={(lgaId) => {
                  if (lgaId === "ikeja") {
                    setSelectedIncidentId("INC-IK-001");
                  }
                }} 
              />
            </div>
            <div className="p-4 border-t bg-slate-50 flex-none">
              <RecoveryView />
            </div>
          </aside>

          {/* Content Area */}
          <section className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            <div className="flex bg-slate-100 p-1 rounded-lg self-start flex-none">
              <button 
                onClick={() => setActiveTab("incident")}
                className={`px-4 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  activeTab === "incident" ? "bg-white shadow text-slate-900 border border-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Operational Command
              </button>
              <button 
                onClick={() => setActiveTab("compliance")}
                className={`px-4 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  activeTab === "compliance" ? "bg-white shadow text-slate-900 border border-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Compliance Documentation
              </button>
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
          </section>
        </main>
      </div>
    </QueryClientProvider>
  );
}
