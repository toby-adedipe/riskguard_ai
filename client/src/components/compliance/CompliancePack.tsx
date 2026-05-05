import { useQuery } from "@tanstack/react-query";
import { CompliancePack, fetchCompliancePack } from "../../lib/api";
import { FileText, Download, ShieldCheck, History, ListFilter, Activity, Users, Info, LucideIcon } from "lucide-react";
import React from "react";

interface CompliancePackViewProps {
  incidentId: string | null;
}

export function CompliancePackView({ incidentId }: CompliancePackViewProps) {
  const { data: pack, isLoading } = useQuery<CompliancePack>({
    queryKey: ["compliancePack", incidentId],
    queryFn: () => fetchCompliancePack(incidentId),
    enabled: !!incidentId,
  });

  if (!incidentId) {
    return (
      <div className="panel-card h-[600px] flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-white">
        <FileText size={64} className="mb-4 opacity-10" />
        <h3 className="font-bold text-lg text-slate-300">NCC Compliance Pack</h3>
        <p className="text-sm max-w-[280px]">Regulatory documentation is automatically generated upon incident detection for submission to NCC portals.</p>
      </div>
    );
  }

  if (isLoading) return <div className="panel-card h-[600px] bg-white animate-pulse" />;
  if (!pack) return null;

  return (
    <div className="panel-card bg-white flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white flex-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">NCC Incident Compliance Report</h2>
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none mt-1">Ref: REG-NCC-LGS-{incidentId}</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 transition-all uppercase tracking-tighter">
          <Download size={12} />
          Export PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        <Section title="1. Incident Timeline" icon={History}>
          <div className="p-3 bg-slate-50 rounded border border-slate-100 font-mono text-[10px] text-slate-600">
            {pack.timeline}
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-6">
          <Section title="2. Affected Services" icon={ListFilter}>
            <div className="flex flex-wrap gap-1.5">
              {pack.affectedServices.map(s => (
                <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                  {s}
                </span>
              ))}
            </div>
          </Section>

          <Section title="4. Impact Statistics" icon={Users}>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tighter">{pack.impactedSubscribers.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 font-medium font-mono">MSISDN TOTAL</span>
            </div>
          </Section>
        </div>

        <Section title="3. Quality KPIs" icon={Activity}>
          <div className="p-3 bg-red-50 text-red-700 rounded border border-red-100 font-mono text-[10px] leading-relaxed">
            {pack.kpis}
          </div>
        </Section>

        <Section title="5. Root Cause (RCA)" icon={Info}>
          <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-4 py-1">
            {pack.rootCause}
          </p>
        </Section>

        <Section title="6. Corrective Actions" icon={ShieldCheck}>
          <div className="p-3 bg-slate-50 text-xs text-slate-700 leading-relaxed font-semibold border border-slate-100 rounded">
            {pack.correctiveActions}
          </div>
        </Section>

        <Section title="7. Evidence Logs" icon={FileText}>
          <div className="bg-slate-50 p-3 rounded text-slate-500 font-mono text-[9px] leading-tight border border-slate-100">
            {pack.evidenceLogs}
          </div>
        </Section>
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-center flex-none">
        <p className="text-[9px] text-slate-400 font-medium">
          Digital Signature: <span className="font-mono">RISKGUARD-AI-SECURE-HASH-2026-XQ{incidentId}</span>
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Icon size={16} className="text-slate-400" />
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}
