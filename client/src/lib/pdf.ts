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
  const BLK: [number, number, number] = [0, 0, 0];
  const GREY: [number, number, number] = [80, 80, 80];
  const LGREY: [number, number, number] = [240, 240, 240];
  const M = 14; // margin

  const fmtNGN = (n: number | undefined) =>
    n != null ? `NGN ${Math.round(n).toLocaleString("en-NG")}` : "N/A";
  const fmtNum = (n: number | undefined) =>
    n != null ? n.toLocaleString() : "N/A";
  const titleCase = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const plain = (
    startY: number,
    rows: [string, string][],
  ) => {
    autoTable(doc, {
      startY,
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 1.8, textColor: BLK },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 72, textColor: GREY },
      },
      theme: "plain",
      tableLineColor: [210, 210, 210],
      tableLineWidth: 0.1,
    });
    return (doc as any).lastAutoTable.finalY + 3;
  };

  const secHead = (title: string, y: number): number => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(M, y, w - M, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLK);
    doc.text(title.toUpperCase(), M, y + 4.5);
    return y + 7;
  };

  const newPage = (y: number, minSpace = 40): number => {
    if (y > doc.internal.pageSize.getHeight() - minSpace) {
      doc.addPage();
      return 12;
    }
    return y;
  };

  // ── Document title ────────────────────────────────────────────
  let y = 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLK);
  doc.text("NCC QUALITY OF SERVICE — INCIDENT COMPLIANCE REPORT", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(
    `Ref: REG/NCC/LGS/${incidentId}   ·   Operator: MTN Nigeria Communications PLC   ·   Generated: ${today}`,
    M,
    y,
  );
  y += 6;

  // ── 1. Incident Summary ───────────────────────────────────────
  y = secHead("1. Incident Summary", y);
  y = plain(y, [
    ["Incident Reference", pack.incidentId ?? incidentId],
    ["LGA / Zone", titleCase(pack.lgaId ?? "")],
    ["Date & Time of Detection (WAT)", pack.openedAt ? new Date(pack.openedAt).toLocaleString("en-NG", { hour12: false }) : "N/A"],
    ["Cause / Classification", titleCase(pack.cause ?? "")],
    ["Phase at Report", titleCase(pack.phase ?? "")],
    ["Risk Score at Peak", pack.riskScore != null ? `${pack.riskScore} / 100` : "N/A"],
    ["Estimated Time-to-Breach", pack.timeToBreach != null ? `${pack.timeToBreach} minutes` : "N/A"],
  ]);

  // ── 2. Impact Assessment ──────────────────────────────────────
  y = secHead("2. Impact Assessment", y);
  y = plain(y, [
    ["Total Impacted Subscribers (MSISDN)", fmtNum(pack.impactedSubscribers)],
    ["Enterprise Lines Affected", fmtNum(pack.enterpriseLines)],
    ["Estimated Revenue at Risk", fmtNGN(pack.revenueAtRisk)],
    ["Regulatory Compensation Exposure", fmtNGN(pack.compensationExposure)],
    ["NCC Regulatory Exposure Summary", pack.nccExposureSummary ?? "N/A"],
  ]);

  // ── 3. Affected Services  +  4. Network KPIs ─────────────────
  const colW = (w - M * 2 - 6) / 2;
  const col2X = M + colW + 6;
  const twoColY = y;

  // draw each column header independently within its own x-range
  const colSecHead = (title: string, x: number, cw: number, cy: number): number => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(x, cy, x + cw, cy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLK);
    doc.text(title.toUpperCase(), x, cy + 4.5);
    return cy + 7;
  };

  const svcDataY = colSecHead("3. Affected Services", M, colW, twoColY);
  autoTable(doc, {
    startY: svcDataY,
    body: pack.affectedServices.map((s) => [titleCase(s)]),
    margin: { left: M, right: M + colW + 8 },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: BLK },
    theme: "plain",
    tableLineColor: [210, 210, 210],
    tableLineWidth: 0.1,
  });
  const svcBottom = (doc as any).lastAutoTable.finalY + 3;

  const kpiDataY = colSecHead("4. Network KPIs at Breach", col2X, colW, twoColY);
  autoTable(doc, {
    startY: kpiDataY,
    body: Object.entries(pack.kpis).map(([k, v]) => [
      titleCase(k),
      typeof v === "number" ? v.toFixed(2) : String(v),
    ]),
    margin: { left: col2X, right: M },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: BLK },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    theme: "plain",
    tableLineColor: [210, 210, 210],
    tableLineWidth: 0.1,
  });
  const kpiBottom = (doc as any).lastAutoTable.finalY + 3;

  y = Math.max(svcBottom, kpiBottom);

  // ── 5. Incident Timeline ──────────────────────────────────────
  y = secHead("5. Incident Timeline", y);
  autoTable(doc, {
    startY: y,
    head: [["#", "Event"]],
    body: pack.timeline.map((e, i) => [i + 1, e]),
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: BLK },
    headStyles: { fillColor: LGREY, textColor: BLK, fontStyle: "bold", fontSize: 7.5, lineColor: [180,180,180], lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ── 6. Root Cause ─────────────────────────────────────────────
  y = newPage(y, 50);
  y = secHead("6. Root Cause Analysis (RCA)", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLK);
  const rcaLines = doc.splitTextToSize(pack.rootCause ?? "Not available.", w - M * 2);
  doc.text(rcaLines, M, y);
  y += rcaLines.length * 4.5 + 4;

  // ── 7. Corrective Actions ────────────────────────────────────
  y = newPage(y, 40);
  y = secHead("7. Corrective Actions Taken / Planned", y);
  autoTable(doc, {
    startY: y,
    head: [["#", "Action"]],
    body: pack.correctiveActions.map((a, i) => [i + 1, a]),
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: BLK },
    headStyles: { fillColor: LGREY, textColor: BLK, fontStyle: "bold", fontSize: 7.5, lineColor: [180,180,180], lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ── 8. Evidence Reference Log ────────────────────────────────
  y = newPage(y, 35);
  y = secHead("8. Evidence Reference Log", y);
  autoTable(doc, {
    startY: y,
    head: [["#", "Evidence Entry"]],
    body: pack.evidenceLogs.map((log, i) => [i + 1, log]),
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 1.5, textColor: GREY },
    headStyles: { fillColor: LGREY, textColor: BLK, fontStyle: "bold", fontSize: 7.5, lineColor: [180,180,180], lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    theme: "grid",
  });

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
  doc.rect(14, y, w - 28, 1, "F");
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.green);
  doc.text("RECOMMENDATION READY", 14, y);
  y += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text(recommendation, 14, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  const summaryLines = doc.splitTextToSize(report.summary ?? "", w - 28);
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 4 + 5;

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
    styles: { fontSize: 8, cellPadding: 2, textColor: C.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, fillColor: C.surface, textColor: C.muted },
    },
    theme: "plain",
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── Role roster ───────────────────────────────────────────────
  if (report.selected_roles.length > 0) {
    y = sectionTitle(doc, "Specialist Agents Dispatched", y);
    autoTable(doc, {
      startY: y,
      head: [["#", "Agent Role", "Status"]],
      body: report.selected_roles.map((role, i) => [i + 1, role.replace(/_/g, " "), "Complete"]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2, textColor: C.text },
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
      styles: { fontSize: 8, cellPadding: 2, textColor: C.text },
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
