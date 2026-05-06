import { useQuery } from "@tanstack/react-query";
import { CompliancePack, fetchCompliancePack } from "../../lib/api";
import { exportCompliancePdf } from "../../lib/pdf";
import { FileText, Download, ShieldCheck, History, ListFilter, Activity, Users, Info, LucideIcon } from "lucide-react";
import React, { useState } from "react";

interface CompliancePackViewProps {
  incidentId: string | null;
}

export function CompliancePackView({ incidentId }: CompliancePackViewProps) {
  const [exporting, setExporting] = useState(false);

  const { data: pack, isLoading } = useQuery<CompliancePack>({
    queryKey: ["compliancePack", incidentId],
    queryFn: () => fetchCompliancePack(incidentId),
    enabled: !!incidentId,
  });

  const handleExport = () => {
    if (!pack || !incidentId) return;
    setExporting(true);
    setTimeout(() => {
      exportCompliancePdf(pack, incidentId);
      setExporting(false);
    }, 50);
  };

  if (!incidentId) {
    return (
      <div className="panel-card h-[600px] flex flex-col items-center justify-center p-12 text-center text-[#605E5C] bg-white">
        <FileText size={64} className="mb-4 opacity-10" />
        <h3 className="font-bold text-lg text-[#A19F9D]">NCC Compliance Pack</h3>
        <p className="text-sm max-w-[280px]">Regulatory documentation is automatically generated upon incident detection for submission to NCC portals.</p>
      </div>
    );
  }

  if (isLoading) return <div className="panel-card h-[600px] bg-white animate-pulse" />;
  if (!pack) return null;

  return (
    <div className="panel-card bg-white flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDEBE9] flex items-center justify-between bg-white flex-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#243A5E] text-white rounded-md">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-main">NCC Incident Compliance Report</h2>
            <p className="text-[9px] font-mono text-[#605E5C] uppercase tracking-widest leading-none mt-1">Ref: REG-NCC-LGS-{incidentId}</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#243A5E] text-white rounded-md text-[10px] font-bold hover:bg-[#1a2d4e] transition-all uppercase tracking-wider disabled:opacity-60"
        >
          <Download size={12} />
          {exporting ? "Generating..." : "Export PDF"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        <Section title="1. Incident Timeline" icon={History}>
          <div className="p-3 bg-[#FAF9F8] rounded-md border border-[#EDEBE9] font-mono text-[10px] text-[#605E5C] leading-relaxed">
            {pack.timeline}
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-6">
          <Section title="2. Affected Services" icon={ListFilter}>
            <div className="flex flex-wrap gap-1.5">
              {pack.affectedServices.map(s => (
                <span key={s} className="px-2 py-0.5 bg-blue-soft text-primary rounded-sm text-[10px] font-bold border border-[#B3D7F2]">
                  {s}
                </span>
              ))}
            </div>
          </Section>

          <Section title="4. Impact Statistics" icon={Users}>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tighter text-text-main">{pack.impactedSubscribers.toLocaleString()}</span>
              <span className="text-[10px] text-[#605E5C] font-medium font-mono">MSISDN TOTAL</span>
            </div>
          </Section>
        </div>

        <Section title="3. Quality KPIs" icon={Activity}>
          <div className="p-3 bg-danger-soft text-danger rounded-md border border-[#F5C6C7] font-mono text-[10px] leading-relaxed">
            {pack.kpis}
          </div>
        </Section>

        <Section title="5. Root Cause (RCA)" icon={Info}>
          <p className="text-sm text-[#605E5C] leading-relaxed italic border-l-2 border-[#D2D0CE] pl-4 py-1">
            {pack.rootCause}
          </p>
        </Section>

        <Section title="6. Corrective Actions" icon={ShieldCheck}>
          <div className="p-3 bg-[#FAF9F8] text-xs text-text-main leading-relaxed font-semibold border border-[#EDEBE9] rounded-md">
            {pack.correctiveActions}
          </div>
        </Section>

        <Section title="7. Evidence Logs" icon={FileText}>
          <div className="bg-[#FAF9F8] p-3 rounded-md text-[#605E5C] font-mono text-[9px] leading-tight border border-[#EDEBE9]">
            {pack.evidenceLogs}
          </div>
        </Section>
      </div>

    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[#EDEBE9]">
        <Icon size={15} className="text-[#605E5C]" />
        <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}
