from __future__ import annotations

import html
import re
from dataclasses import dataclass
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.modules.copilot.harness import HarnessRunReport


DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MEDIA_TYPE = "application/pdf"


@dataclass(frozen=True)
class CompiledReportDocument:
    filename: str
    media_type: str
    content: bytes


def build_compiled_report_document(report: HarnessRunReport) -> CompiledReportDocument:
    title, body = report_markdown(report)
    return CompiledReportDocument(
        filename=f"riskguard-investigation-{report.harness_run_id}.pdf",
        media_type=PDF_MEDIA_TYPE,
        content=build_report_pdf(title=title, body_markdown=body),
    )


def report_markdown(report: HarnessRunReport) -> tuple[str, str]:
    evidence_lines = "\n".join(
        f"- **{item.evidence_id}:** {item.summary} Source: {item.source_system or 'investigation'}."
        for item in report.evidence
    ) or "- No evidence references were persisted with this run."
    step_lines = "\n".join(
        f"- **{step.title}:** {step.status}. {step.summary}"
        for step in report.steps
    )
    recommendation_lines = "\n".join(
        f"- **{item.action}:** approval required: {item.requires_approval}."
        for item in report.recommendations
    ) or "- No supported mitigation recommendation was produced."
    simulation = report.mitigation_simulation
    if simulation is not None:
        recommended = next((item for item in simulation.actions if item.recommended), None)
        recommended_curve = recommended.projected_score_curve if recommended is not None else []
        simulation_text = (
            f"The do-nothing score curve is {simulation.do_nothing_curve}. "
            f"The recommended action is {simulation.recommended_action_id}. "
            f"The recommended action curve is {recommended_curve}. {simulation.summary}"
        )
    else:
        simulation_text = "No mitigation simulation was persisted with this run."

    title = f"RiskGuard AI Investigation Report - {report.incident_id or report.lga_id}"
    body = f"""
# Executive Summary
RiskGuard AI completed an investigation for {report.incident_id or report.lga_id}. {report.summary}

The report status is **{report.status}**. The decision trail is grounded in **{len(report.evidence)} evidence references** collected during the run. The investigation used playbook **{report.playbook_id}** and selected these specialist roles: **{', '.join(report.selected_roles)}**.

Next actions captured by the investigation are:
{_markdown_list(report.next_actions)}

---PAGE BREAK---

# Incident Context
The triggering condition was: {report.trigger_reason}

The investigation started at {report.started_at.isoformat()} and completed at {report.completed_at.isoformat()}. The selected specialists performed role-specific checks before the final operator report was compiled.

# Evidence Review
{evidence_lines}

# Customer and Social Media Impact
Customer-impact evidence includes complaints, device-session data, and social-media listening when present in the saved report. Social evidence is treated as corroborating customer pressure, not as a replacement for network telemetry. These signals help the operator understand public escalation risk and affected-customer perception.

# Revenue and Regulatory Exposure
Revenue and compliance exposure were assessed from persisted impact estimates, audit trail checks, and NCC pack readiness where those tools were available. Compliance outputs remain subject to operator review before external submission.

# Mitigation Assessment
{simulation_text}

# Recommended Decision
{recommendation_lines}

---PAGE BREAK---

# Open Risks and Next Actions
{step_lines}

The operator should validate the recommended mitigation action, confirm customer communications, and preserve the evidence references listed above for audit and post-incident review.
""".strip()
    return title, body


def build_report_docx(*, title: str, body_markdown: str) -> bytes:
    paragraphs = _markdown_to_docx_paragraphs(title, body_markdown)
    document_xml = _document_xml(paragraphs)
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types_xml())
        archive.writestr("_rels/.rels", _rels_xml())
        archive.writestr("word/_rels/document.xml.rels", _document_rels_xml())
        archive.writestr("word/styles.xml", _styles_xml())
        archive.writestr("word/numbering.xml", _numbering_xml())
        archive.writestr("word/header1.xml", _header_xml())
        archive.writestr("word/footer1.xml", _footer_xml())
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("docProps/core.xml", _core_props_xml(title))
        archive.writestr("docProps/app.xml", _app_props_xml())
    return buffer.getvalue()


def build_report_pdf(*, title: str, body_markdown: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.78 * inch,
        bottomMargin=0.72 * inch,
        title=title,
        author="RiskGuard AI",
    )
    styles = _pdf_styles()
    story = _markdown_to_pdf_story(title, body_markdown, styles)
    doc.build(story, onFirstPage=_draw_pdf_frame, onLaterPages=_draw_pdf_frame)
    return buffer.getvalue()


def _markdown_to_pdf_story(title: str, markdown: str, styles: dict[str, ParagraphStyle]) -> list:
    story: list = [
        Paragraph("RISKGUARD AI / OPERATIONAL COMMAND", styles["kicker"]),
        Spacer(1, 0.12 * inch),
        Paragraph(_pdf_escape(title), styles["title"]),
        Spacer(1, 0.08 * inch),
        Paragraph(
            "Network incident handover report for executive, NOC, compliance, and revenue assurance review.",
            styles["subtitle"],
        ),
        Spacer(1, 0.06 * inch),
        _summary_strip("Generated from validated investigation evidence and mitigation simulations.", styles),
        Spacer(1, 0.24 * inch),
    ]
    current_heading: str | None = None
    first_body_in_section = False
    pending_page_break = False
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "---PAGE BREAK---":
            pending_page_break = True
            continue
        if pending_page_break:
            story.append(PageBreak())
            pending_page_break = False
        if line.startswith("# "):
            current_heading = line[2:]
            first_body_in_section = True
            story.append(Spacer(1, 0.14 * inch))
            story.append(Paragraph(_pdf_escape(current_heading), styles["heading"]))
            story.append(Spacer(1, 0.05 * inch))
            continue
        if line.startswith("## "):
            current_heading = line[3:]
            first_body_in_section = True
            story.append(Paragraph(_pdf_escape(current_heading), styles["subheading"]))
            continue
        if line.startswith("- "):
            story.append(Paragraph(_pdf_inline(line[2:]), styles["bullet"], bulletText="-"))
            continue
        if current_heading == "Recommended Decision":
            story.append(_decision_callout(_pdf_inline(line), styles))
        elif current_heading == "Executive Summary" and first_body_in_section:
            story.append(_executive_callout(_pdf_inline(line), styles))
        else:
            story.append(Paragraph(_pdf_inline(line), styles["body"]))
        first_body_in_section = False
    return story


def _pdf_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "RiskGuardKicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#1D4ED8"),
            spaceAfter=2,
            tracking=1.4,
        ),
        "title": ParagraphStyle(
            "RiskGuardTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=27,
            leading=31,
            textColor=colors.HexColor("#0B1220"),
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "RiskGuardSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=13.5,
            leading=17,
            textColor=colors.HexColor("#334155"),
        ),
        "body": ParagraphStyle(
            "RiskGuardBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14.2,
            textColor=colors.HexColor("#1E293B"),
            spaceAfter=7,
        ),
        "lead": ParagraphStyle(
            "RiskGuardLead",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=11.8,
            leading=16,
            textColor=colors.HexColor("#0F172A"),
        ),
        "heading": ParagraphStyle(
            "RiskGuardHeading",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15.2,
            leading=18,
            textColor=colors.HexColor("#0B1220"),
            spaceBefore=7,
            spaceAfter=6,
        ),
        "subheading": ParagraphStyle(
            "RiskGuardSubheading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#1E3A8A"),
            spaceBefore=7,
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "RiskGuardBullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12.8,
            textColor=colors.HexColor("#334155"),
            leftIndent=14,
            bulletIndent=2,
            spaceAfter=3.5,
        ),
        "small": ParagraphStyle(
            "RiskGuardSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#64748B"),
        ),
        "footer": ParagraphStyle(
            "RiskGuardFooter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748B"),
            alignment=TA_RIGHT,
        ),
    }


def _summary_strip(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    table = Table([[Paragraph(_pdf_escape(text), styles["small"])]], colWidths=[6.95 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DBEAFE")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def _executive_callout(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    table = Table([[Paragraph(text, styles["lead"])]], colWidths=[6.95 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("LINEBEFORE", (0, 0), (-1, -1), 4, colors.HexColor("#2563EB")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def _decision_callout(text: str, styles: dict[str, ParagraphStyle]) -> KeepTogether:
    table = Table([[Paragraph(text, styles["body"])]], colWidths=[6.95 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
                ("LINEBEFORE", (0, 0), (-1, -1), 4, colors.HexColor("#059669")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 0.05 * inch)])


def _draw_pdf_frame(canvas, doc) -> None:
    canvas.saveState()
    width, height = LETTER
    canvas.setStrokeColor(colors.HexColor("#DBEAFE"))
    canvas.setLineWidth(0.7)
    canvas.line(doc.leftMargin, height - 0.52 * inch, width - doc.rightMargin, height - 0.52 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(doc.leftMargin, height - 0.44 * inch, "RISKGUARD AI INVESTIGATION REPORT")
    canvas.drawRightString(width - doc.rightMargin, 0.42 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _pdf_escape(text: str) -> str:
    return html.escape(text, quote=False)


def _pdf_inline(text: str) -> str:
    escaped = _pdf_escape(text)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)


def _markdown_list(items: list[str]) -> str:
    if not items:
        return "- No next actions were captured."
    return "\n".join(f"- {item}" for item in items)


def _markdown_to_docx_paragraphs(title: str, markdown: str) -> list[str]:
    paragraphs = [
        _paragraph("RISKGUARD AI / OPERATIONAL COMMAND", style="CoverKicker"),
        _paragraph(title, style="CoverTitle"),
        _paragraph("Network incident handover report for executive, NOC, compliance, and revenue assurance review.", style="CoverSubtitle"),
        _paragraph("Generated from validated investigation evidence and mitigation simulations.", style="CoverMeta"),
    ]
    current_heading: str | None = None
    first_body_in_section = False
    pending_page_break = False
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "---PAGE BREAK---":
            pending_page_break = True
            continue
        if line.startswith("# "):
            current_heading = line[2:]
            first_body_in_section = True
            paragraphs.append(_paragraph(current_heading, style="SectionHeading", page_break_before=pending_page_break))
            pending_page_break = False
            continue
        if line.startswith("## "):
            current_heading = line[3:]
            first_body_in_section = True
            paragraphs.append(_paragraph(current_heading, style="Subheading", page_break_before=pending_page_break))
            pending_page_break = False
            continue
        if line.startswith("- "):
            paragraphs.append(_paragraph(f"- {line[2:]}", style="ListParagraph"))
            continue
        style = "ExecutiveLead" if current_heading == "Executive Summary" and first_body_in_section else "BodyText"
        if current_heading == "Recommended Decision":
            style = "DecisionCallout"
        paragraphs.append(_paragraph(line, style=style))
        first_body_in_section = False
    return paragraphs


def _paragraph(
    text: str,
    *,
    style: str | None = None,
    num_id: int | None = None,
    page_break_before: bool = False,
) -> str:
    p_pr = _paragraph_properties(style=style, num_id=num_id, page_break_before=page_break_before)
    return f"<w:p>{p_pr}{''.join(_runs(text, style=style))}</w:p>"


def _paragraph_properties(*, style: str | None, num_id: int | None, page_break_before: bool = False) -> str:
    children: list[str] = []
    if style:
        children.append(f"<w:pStyle w:val=\"{style}\"/>")
    if page_break_before:
        children.append("<w:pageBreakBefore/>")
    children.extend(_direct_paragraph_properties(style))
    if num_id is not None:
        children.append(
            f"<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"{num_id}\"/></w:numPr>"
        )
    if not children:
        return ""
    return f"<w:pPr>{''.join(children)}</w:pPr>"


def _direct_paragraph_properties(style: str | None) -> list[str]:
    if style == "CoverKicker":
        return [
            '<w:spacing w:before="100" w:after="140"/>',
            '<w:shd w:val="clear" w:color="auto" w:fill="EAF2FF"/>',
            '<w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="2563EB"/></w:pBdr>',
        ]
    if style == "CoverTitle":
        return [
            '<w:spacing w:before="80" w:after="180"/>',
            '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="12" w:color="2563EB"/></w:pBdr>',
        ]
    if style == "CoverSubtitle":
        return ['<w:spacing w:after="120" w:line="300" w:lineRule="auto"/>']
    if style == "CoverMeta":
        return [
            '<w:spacing w:after="420"/>',
            '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="14" w:color="CBD5E1"/></w:pBdr>',
        ]
    if style == "ExecutiveLead":
        return [
            '<w:spacing w:before="80" w:after="220" w:line="320" w:lineRule="auto"/>',
            '<w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>',
            '<w:pBdr><w:left w:val="single" w:sz="14" w:space="8" w:color="2563EB"/></w:pBdr>',
        ]
    if style == "DecisionCallout":
        return [
            '<w:spacing w:before="80" w:after="160" w:line="300" w:lineRule="auto"/>',
            '<w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/>',
            '<w:pBdr><w:left w:val="single" w:sz="14" w:space="8" w:color="059669"/></w:pBdr>',
        ]
    if style == "ListParagraph":
        return ['<w:spacing w:after="90" w:line="280" w:lineRule="auto"/>', '<w:ind w:left="360"/>']
    if style == "SectionHeading":
        return [
            '<w:keepNext/>',
            '<w:spacing w:before="340" w:after="120"/>',
            '<w:pBdr><w:bottom w:val="single" w:sz="5" w:space="6" w:color="BFDBFE"/></w:pBdr>',
            '<w:outlineLvl w:val="0"/>',
        ]
    if style == "Subheading":
        return ['<w:keepNext/>', '<w:spacing w:before="220" w:after="80"/>', '<w:outlineLvl w:val="1"/>']
    return ['<w:spacing w:after="150" w:line="300" w:lineRule="auto"/>']


def _runs(text: str, *, style: str | None) -> list[str]:
    if text == "":
        return [f"<w:r>{_run_properties(style=style)}<w:t></w:t></w:r>"]
    runs: list[str] = []
    cursor = 0
    for match in re.finditer(r"\*\*(.+?)\*\*", text):
        if match.start() > cursor:
            runs.append(_run(text[cursor:match.start()], style=style))
        runs.append(_run(match.group(1), style=style, bold=True))
        cursor = match.end()
    if cursor < len(text):
        runs.append(_run(text[cursor:], style=style))
    return runs


def _run(text: str, *, style: str | None, bold: bool = False) -> str:
    run_props = _run_properties(style=style, bold=bold)
    return f"<w:r>{run_props}<w:t xml:space=\"preserve\">{html.escape(text)}</w:t></w:r>"


def _run_properties(*, style: str | None, bold: bool = False) -> str:
    font = "Helvetica Neue"
    size = "21"
    color = "1E293B"
    props = []
    if style == "CoverKicker":
        size = "18"
        color = "1D4ED8"
        props.extend(["<w:b/>", "<w:caps/>", '<w:spacing w:val="28"/>'])
    elif style == "CoverTitle":
        size = "44"
        color = "0B1220"
        props.append("<w:b/>")
    elif style == "CoverSubtitle":
        size = "25"
        color = "334155"
    elif style == "CoverMeta":
        size = "19"
        color = "64748B"
    elif style == "ExecutiveLead":
        size = "24"
        color = "0F172A"
    elif style == "DecisionCallout":
        size = "21"
        color = "064E3B"
    elif style == "ListParagraph":
        size = "20"
        color = "334155"
    elif style == "SectionHeading":
        size = "30"
        color = "0B1220"
        props.append("<w:b/>")
    elif style == "Subheading":
        size = "24"
        color = "1E3A8A"
        props.append("<w:b/>")
    if bold and "<w:b/>" not in props:
        props.append("<w:b/>")
    return (
        "<w:rPr>"
        f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>'
        f'<w:sz w:val="{size}"/><w:color w:val="{color}"/>'
        + "".join(props)
        + "</w:rPr>"
    )


def _document_xml(paragraphs: list[str]) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {''.join(paragraphs)}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/>
      <w:footerReference w:type="default" r:id="rId3"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1152" w:right="1296" w:bottom="1152" w:left="1296" w:header="576" w:footer="576"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def _content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def _rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def _document_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>"""


def _styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:sz w:val="21"/><w:color w:val="1E293B"/></w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="150" w:line="300" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="BodyText">
    <w:name w:val="Body Text"/>
    <w:pPr><w:spacing w:after="150" w:line="300" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:sz w:val="21"/><w:color w:val="1E293B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverKicker">
    <w:name w:val="Cover Kicker"/>
    <w:pPr>
      <w:spacing w:before="100" w:after="140"/>
      <w:shd w:val="clear" w:color="auto" w:fill="EAF2FF"/>
      <w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="2563EB"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:b/><w:caps/><w:sz w:val="18"/><w:color w:val="1D4ED8"/><w:spacing w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverTitle">
    <w:name w:val="Cover Title"/>
    <w:pPr>
      <w:spacing w:before="80" w:after="180"/>
      <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="12" w:color="2563EB"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="44"/><w:color w:val="0B1220"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverSubtitle">
    <w:name w:val="Cover Subtitle"/>
    <w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="25"/><w:color w:val="334155"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverMeta">
    <w:name w:val="Cover Meta"/>
    <w:pPr><w:spacing w:after="420"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="14" w:color="CBD5E1"/></w:pBdr></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="19"/><w:color w:val="64748B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ExecutiveLead">
    <w:name w:val="Executive Lead"/>
    <w:basedOn w:val="BodyText"/>
    <w:pPr>
      <w:spacing w:before="80" w:after="220" w:line="320" w:lineRule="auto"/>
      <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
      <w:pBdr><w:left w:val="single" w:sz="14" w:space="8" w:color="2563EB"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="24"/><w:color w:val="0F172A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="DecisionCallout">
    <w:name w:val="Decision Callout"/>
    <w:basedOn w:val="BodyText"/>
    <w:pPr>
      <w:spacing w:before="80" w:after="160" w:line="300" w:lineRule="auto"/>
      <w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/>
      <w:pBdr><w:left w:val="single" w:sz="14" w:space="8" w:color="059669"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:color w:val="064E3B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="BodyText"/>
    <w:pPr><w:spacing w:after="90" w:line="280" w:lineRule="auto"/><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="SectionHeading">
    <w:name w:val="Section Heading"/>
    <w:basedOn w:val="BodyText"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="340" w:after="120"/>
      <w:pBdr><w:bottom w:val="single" w:sz="5" w:space="6" w:color="BFDBFE"/></w:pBdr>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="30"/><w:color w:val="0B1220"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subheading">
    <w:name w:val="Subheading"/>
    <w:basedOn w:val="BodyText"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="HeaderText">
    <w:name w:val="Header Text"/>
    <w:pPr><w:spacing w:after="0"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="DBEAFE"/></w:pBdr></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:caps/><w:sz w:val="16"/><w:color w:val="64748B"/><w:spacing w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FooterText">
    <w:name w:val="Footer Text"/>
    <w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="16"/><w:color w:val="64748B"/></w:rPr>
  </w:style>
</w:styles>"""


def _numbering_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#x2022;"/>
      <w:suff w:val="space"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="420" w:hanging="240"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""


def _header_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="HeaderText"/><w:spacing w:after="0"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="DBEAFE"/></w:pBdr></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue"/><w:caps/><w:sz w:val="16"/><w:color w:val="64748B"/><w:spacing w:val="20"/></w:rPr><w:t xml:space="preserve">RiskGuard AI Investigation Report</w:t></w:r>
  </w:p>
</w:hdr>"""


def _footer_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="FooterText"/><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue"/><w:sz w:val="16"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">Internal operational report</w:t></w:r>
  </w:p>
</w:ftr>"""


def _core_props_xml(title: str) -> str:
    escaped_title = html.escape(title)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escaped_title}</dc:title>
  <dc:creator>RiskGuard AI</dc:creator>
  <cp:lastModifiedBy>RiskGuard AI</cp:lastModifiedBy>
</cp:coreProperties>"""


def _app_props_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>RiskGuard AI</Application>
</Properties>"""
