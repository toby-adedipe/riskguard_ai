import { useQuery } from "@tanstack/react-query";
import { CompliancePack, fetchCompliancePack } from "../../lib/api";
import { exportCompliancePdf } from "../../lib/pdf";
import { Download } from "lucide-react";
import { useState } from "react";
import { LGA_NAMES } from "../../lib/lgas";

interface CompliancePackViewProps {
  incidentId: string | null;
}

const fmt = (n: number) => n.toLocaleString("en-NG");
const fmtNGN = (n: number) =>
  `₦${Math.round(n).toLocaleString("en-NG")}`;

function kpiLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CompliancePackView({ incidentId }: CompliancePackViewProps) {
  const [exporting, setExporting] = useState(false);

  const { data: pack, isLoading } = useQuery<CompliancePack>({
    queryKey: ["compliancePack", incidentId],
    queryFn: () => fetchCompliancePack(incidentId!),
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
      <div className="h-full flex items-center justify-center text-sm text-[#605E5C]">
        No incident selected. Trigger an investigation to generate documentation.
      </div>
    );
  }

  if (isLoading) return <div className="h-full bg-white animate-pulse rounded" />;
  if (!pack) return null;

  const lgaName =
    (LGA_NAMES as Record<string, string>)[pack.lgaId] ?? pack.lgaId;
  const openedDate = new Date(pack.openedAt);
  const dateStr = openedDate.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = openedDate.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const kpiEntries = Object.entries(pack.kpis);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden border border-border-base rounded-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border-base flex-none bg-[#FAF9F8]">
        <span className="text-[10px] font-mono text-[#605E5C] uppercase tracking-widest">
          NCC QoS Compliance — REG/NCC/LGS/{pack.incidentId}
        </span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#605E5C] text-text-main rounded text-[10px] font-semibold hover:bg-[#EDEBE9] transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          <Download size={11} />
          {exporting ? "Generating…" : "Export PDF"}
        </button>
      </div>

      {/* Document body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 text-[#1a1a1a]">
        {/* Document title block */}
        <div className="mb-5 pb-4 border-b-2 border-black">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#605E5C] mb-1">
            Nigerian Communications Commission — Quality of Service Incident Report
          </p>
          <h1 className="text-base font-bold tracking-tight leading-tight">
            Network Outage Incident Report: {lgaName} Local Government Area
          </h1>
          <p className="text-[11px] text-text-main mt-0.5">
            Operator: MTN Nigeria Communications PLC &nbsp;·&nbsp; Incident Ref:{" "}
            <span className="font-mono font-semibold">{pack.incidentId}</span>{" "}
            &nbsp;·&nbsp; Classification: Service Degradation / Outage
          </p>
        </div>

        {/* Section 1 — Incident Summary */}
        <DocSection num="1" title="Incident Summary">
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Incident Reference" value={pack.incidentId} mono />
              <Row label="LGA / Zone" value={`${lgaName} (${pack.lgaId.toUpperCase()})`} />
              <Row label="Date of Occurrence" value={dateStr} />
              <Row label="Time of Detection (WAT)" value={timeStr} />
              <Row label="Cause / Classification" value={pack.cause} />
              <Row
                label="Phase at Report"
                value={pack.phase.charAt(0).toUpperCase() + pack.phase.slice(1)}
              />
              <Row
                label="Risk Score at Peak"
                value={pack.riskScore !== null ? `${pack.riskScore}/100` : "N/A"}
                mono
              />
              <Row
                label="Time-to-Breach Estimate"
                value={
                  pack.timeToBreach !== null ? `${pack.timeToBreach} minutes` : "N/A"
                }
              />
            </tbody>
          </table>
        </DocSection>

        {/* Section 2 — Impact Assessment */}
        <DocSection num="2" title="Impact Assessment">
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row
                label="Total Impacted Subscribers (MSISDN)"
                value={fmt(pack.impactedSubscribers)}
                mono
              />
              <Row
                label="Enterprise Lines Affected"
                value={fmt(pack.enterpriseLines)}
                mono
              />
              <Row
                label="Estimated Revenue at Risk"
                value={fmtNGN(pack.revenueAtRisk)}
                mono
              />
              <Row
                label="Regulatory Compensation Exposure"
                value={fmtNGN(pack.compensationExposure)}
                mono
              />
              <Row
                label="NCC Regulatory Exposure"
                value={pack.nccExposureSummary}
              />
            </tbody>
          </table>
        </DocSection>

        {/* Section 3 — Affected Services & KPIs — side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <DocSection num="3" title="Affected Services" inline>
            <ul className="text-xs space-y-0.5 mt-1">
              {pack.affectedServices.map((s) => (
                <li key={s} className="flex gap-1.5">
                  <span className="text-[#605E5C] font-mono">—</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </DocSection>

          <DocSection num="4" title="Network KPIs at Breach" inline>
            <table className="w-full text-xs border-collapse mt-1">
              <tbody>
                {kpiEntries.map(([key, val]) => (
                  <tr key={key} className="border-b border-[#EDEBE9]">
                    <td className="py-0.5 pr-3 text-text-main w-2/3">{kpiLabel(key)}</td>
                    <td className="py-0.5 font-mono font-semibold text-right">
                      {typeof val === "number" ? val.toFixed(2) : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocSection>
        </div>

        {/* Section 5 — Incident Timeline */}
        <DocSection num="5" title="Incident Timeline">
          <ol className="text-xs space-y-0.5 mt-1 list-none">
            {pack.timeline.map((entry, i) => (
              <li key={i} className="flex gap-2 border-b border-[#EDEBE9] py-1">
                <span className="font-mono text-[#605E5C] flex-none w-4 text-right">
                  {i + 1}.
                </span>
                <span className="text-[#1a1a1a]">{entry}</span>
              </li>
            ))}
          </ol>
        </DocSection>

        {/* Section 6 — Root Cause Analysis */}
        <DocSection num="6" title="Root Cause Analysis (RCA)">
          <p className="text-xs leading-relaxed border-l-2 border-black pl-3 mt-1 text-[#1a1a1a]">
            {pack.rootCause}
          </p>
        </DocSection>

        {/* Section 7 — Corrective Actions */}
        <DocSection num="7" title="Corrective Actions Taken / Planned">
          <ol className="text-xs space-y-0.5 mt-1 list-none">
            {pack.correctiveActions.map((action, i) => (
              <li key={i} className="flex gap-2 border-b border-[#EDEBE9] py-1">
                <span className="font-mono text-[#605E5C] flex-none w-4 text-right">
                  {i + 1}.
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </DocSection>

        {/* Section 8 — Evidence Reference Log */}
        <DocSection num="8" title="Evidence Reference Log">
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1 pr-4 font-semibold w-8">#</th>
                <th className="text-left py-1 font-semibold">Evidence Entry</th>
              </tr>
            </thead>
            <tbody>
              {pack.evidenceLogs.map((log, i) => (
                <tr key={i} className="border-b border-[#EDEBE9]">
                  <td className="py-0.5 pr-4 font-mono text-[#605E5C]">{i + 1}</td>
                  <td className="py-0.5 font-mono text-[10px] text-text-main">{log}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-black text-[9px] font-mono text-[#605E5C] flex justify-between">
          <span>
            Generated by RiskGuard AI — MTN Nigeria Network Operations Centre
          </span>
          <span>
            {new Date().toLocaleDateString("en-NG", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}{" "}
            · CONFIDENTIAL — NCC SUBMISSION
          </span>
        </div>
      </div>
    </div>
  );
}

function DocSection({
  num,
  title,
  children,
  inline,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "mb-4"}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[9px] font-mono font-bold text-[#605E5C]">
          {num}.
        </span>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-black">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <tr className="border-b border-[#EDEBE9]">
      <td className="py-1 pr-4 text-[#605E5C] w-1/2">{label}</td>
      <td className={`py-1 text-[#1a1a1a] font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </td>
    </tr>
  );
}
