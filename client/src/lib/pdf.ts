import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CompliancePack } from "./api";

// MS brand palette as RGB
const C = {
  navy: [36, 58, 94] as [number, number, number],
  blue: [0, 120, 212] as [number, number, number],
  red: [209, 52, 56] as [number, number, number],
  green: [16, 124, 16] as [number, number, number],
  surface: [243, 242, 241] as [number, number, number],
  border: [210, 208, 206] as [number, number, number],
  text: [50, 49, 48] as [number, number, number],
  muted: [96, 94, 92] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function addHeader(doc: jsPDF, title: string, ref: string) {
  const w = doc.internal.pageSize.getWidth();

  // Navy header bar
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, w, 28, "F");

  // Brand label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text("RiskGuard AI", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 220);
  doc.text("OPERATIONAL COMMAND · NCC COMPLIANCE", 14, 17);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text(title, 14, 24);

  // Ref on right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 220);
  doc.text(ref, w - 14, 24, { align: "right" });

  // Blue accent line
  doc.setFillColor(...C.blue);
  doc.rect(0, 28, w, 1.5, "F");
}

function addFooter(doc: jsPDF, incidentId: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(14, h - 12, w - 14, h - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      `Digital Signature: RISKGUARD-AI-SECURE-HASH-2026-XQ${incidentId}`,
      14,
      h - 7,
    );
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 7, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.surface);
  doc.rect(14, y, w - 28, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text(title.toUpperCase(), 17, y + 5);
  return y + 10;
}

function bodyText(doc: jsPDF, text: string, y: number, maxWidth?: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(text, maxWidth ?? w - 28);
  doc.text(lines, 14, y);
  return y + lines.length * 5 + 3;
}

function tag(doc: jsPDF, label: string, x: number, y: number): number {
  const textWidth = doc.getTextWidth(label);
  const pad = 3;
  doc.setFillColor(...C.blue);
  doc.roundedRect(x, y - 4, textWidth + pad * 2, 6, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text(label, x + pad, y);
  return x + textWidth + pad * 2 + 3;
}

export function exportCompliancePdf(pack: CompliancePack, incidentId: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().slice(0, 10);

  addHeader(
    doc,
    "NCC Incident Compliance Report",
    `REG-NCC-LGS-${incidentId} · ${today}`,
  );

  let y = 38;

  // ── 1. Incident Timeline ──────────────────────────────────────
  y = sectionTitle(doc, "1. Incident Timeline", y);
  y = bodyText(doc, pack.timeline, y);
  y += 4;

  // ── 2 + 4 two-column row ─────────────────────────────────────
  const colW = (w - 28 - 6) / 2;

  // Section 2 – Affected Services
  doc.setFillColor(...C.surface);
  doc.rect(14, y, colW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text("2. AFFECTED SERVICES", 17, y + 5);
  let tagX = 14;
  let tagY = y + 13;
  for (const svc of pack.affectedServices) {
    const textWidth = doc.getTextWidth(svc);
    const pad = 3;
    if (tagX + textWidth + pad * 2 + 3 > 14 + colW) {
      tagX = 14;
      tagY += 8;
    }
    tagX = tag(doc, svc, tagX, tagY);
  }
  const servicesBottom = tagY + 8;

  // Section 4 – Impact Statistics
  const col2X = 14 + colW + 6;
  doc.setFillColor(...C.surface);
  doc.rect(col2X, y, colW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text("4. IMPACT STATISTICS", col2X + 3, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...C.text);
  doc.text(pack.impactedSubscribers.toLocaleString(), col2X + 3, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("MSISDN TOTAL", col2X + 3, y + 26);

  y = Math.max(servicesBottom, y + 32) + 4;

  // ── 3. Quality KPIs ──────────────────────────────────────────
  y = sectionTitle(doc, "3. Quality KPIs", y);
  // Red-tinted box
  doc.setFillColor(253, 243, 243);
  doc.rect(14, y, w - 28, 14, "F");
  doc.setDrawColor(...C.red);
  doc.setLineWidth(0.4);
  doc.rect(14, y, w - 28, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.red);
  const kpiLines = doc.splitTextToSize(pack.kpis, w - 32);
  doc.text(kpiLines, 17, y + 5);
  y += 18;

  // ── 5. Root Cause (RCA) ──────────────────────────────────────
  y = sectionTitle(doc, "5. Root Cause (RCA)", y);
  // Left border quote style
  doc.setFillColor(...C.border);
  doc.rect(14, y, 1.5, 20, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  const rcaLines = doc.splitTextToSize(pack.rootCause, w - 34);
  doc.text(rcaLines, 19, y + 5);
  y += Math.max(24, rcaLines.length * 5 + 8);

  // ── 6. Corrective Actions ────────────────────────────────────
  y = sectionTitle(doc, "6. Corrective Actions", y);
  const actions = pack.correctiveActions.split(" | ").filter(Boolean);

  autoTable(doc, {
    startY: y,
    head: [["#", "Action"]],
    body: actions.map((a, i) => [i + 1, a]),
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, textColor: C.text },
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: C.surface },
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 7. Evidence Logs ─────────────────────────────────────────
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    addHeader(doc, "NCC Incident Compliance Report (cont.)", `REG-NCC-LGS-${incidentId} · ${today}`);
    y = 38;
  }

  y = sectionTitle(doc, "7. Evidence Logs", y);
  doc.setFillColor(...C.surface);
  const logs = pack.evidenceLogs;
  const logLines = doc.splitTextToSize(logs, w - 32);
  const logHeight = logLines.length * 4.5 + 8;
  doc.rect(14, y, w - 28, logHeight, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(logLines, 17, y + 5);
  y += logHeight + 4;

  addFooter(doc, incidentId);

  doc.save(`riskguard-compliance-${incidentId}-${today}.pdf`);
}

export function exportInvestigationPdf(report: {
  incident_id: string;
  harness_run_id: string;
  summary: string;
  recommended_action_label: string | null;
  recommended_action: string | null;
  selected_roles: string[];
  evidence_count: number;
  do_nothing_curve: number[];
  recovery_curve: number[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().slice(0, 10);
  const incidentId = report.incident_id;
  const recommendation = report.recommended_action_label ?? "No action recommended";

  addHeader(
    doc,
    "AI Investigation Report",
    `${incidentId} · ${today}`,
  );

  let y = 38;

  // ── Recommendation banner ─────────────────────────────────────
  doc.setFillColor(...C.green);
  doc.rect(14, y, w - 28, 1.5, "F");
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.green);
  doc.text("RECOMMENDATION READY", 14, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...C.text);
  doc.text(recommendation, 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  const summaryLines = doc.splitTextToSize(report.summary ?? "", w - 28);
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 5 + 8;

  // ── Decision metrics ──────────────────────────────────────────
  y = sectionTitle(doc, "Decision Trail", y);

  autoTable(doc, {
    startY: y,
    body: [
      ["Incident ID", incidentId],
      ["Harness Run ID", report.harness_run_id],
      ["Roles dispatched", report.selected_roles.length.toString()],
      ["Evidence collected", report.evidence_count.toString()],
      ["Recommended action", recommendation],
    ],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3, textColor: C.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, fillColor: C.surface, textColor: C.muted },
    },
    theme: "plain",
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Role roster ───────────────────────────────────────────────
  if (report.selected_roles.length > 0) {
    y = sectionTitle(doc, "Specialist Agents Dispatched", y);
    autoTable(doc, {
      startY: y,
      head: [["#", "Agent Role", "Status"]],
      body: report.selected_roles.map((role, i) => [i + 1, role.replace(/_/g, " "), "Complete"]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: C.text },
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 30, textColor: C.green, fontStyle: "bold" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Risk curve table ──────────────────────────────────────────
  if (report.do_nothing_curve.length > 0) {
    y = sectionTitle(doc, "Risk Projection — Do Nothing vs. Recommended Action", y);

    const steps = Math.max(report.do_nothing_curve.length, report.recovery_curve.length);
    const rows = Array.from({ length: steps }, (_, i) => [
      `T+${i * 5}m`,
      report.do_nothing_curve[i] != null ? `${report.do_nothing_curve[i].toFixed(1)}` : "—",
      report.recovery_curve[i] != null ? `${report.recovery_curve[i].toFixed(1)}` : "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Time", "Do Nothing (Risk Score)", "With Action (Risk Score)"]],
      body: rows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: C.text },
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles: {
        1: { textColor: C.red, fontStyle: "bold" },
        2: { textColor: C.green, fontStyle: "bold" },
      },
    });
  }

  addFooter(doc, incidentId);
  doc.save(`riskguard-investigation-${incidentId}-${today}.pdf`);
}
