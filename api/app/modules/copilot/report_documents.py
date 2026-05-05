from __future__ import annotations

import html
import re
from dataclasses import dataclass
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from app.modules.copilot.harness import HarnessRunReport


DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@dataclass(frozen=True)
class CompiledReportDocument:
    filename: str
    media_type: str
    content: bytes


def build_compiled_report_document(report: HarnessRunReport) -> CompiledReportDocument:
    title, body = report_markdown(report)
    return CompiledReportDocument(
        filename=f"riskguard-investigation-{report.harness_run_id}.docx",
        media_type=DOCX_MEDIA_TYPE,
        content=build_report_docx(title=title, body_markdown=body),
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
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("docProps/core.xml", _core_props_xml(title))
        archive.writestr("docProps/app.xml", _app_props_xml())
    return buffer.getvalue()


def _markdown_list(items: list[str]) -> str:
    if not items:
        return "- No next actions were captured."
    return "\n".join(f"- {item}" for item in items)


def _markdown_to_docx_paragraphs(title: str, markdown: str) -> list[str]:
    paragraphs = [
        _paragraph("RiskGuard AI", style="ReportKicker"),
        _paragraph(title, style="Title"),
        _paragraph("Operational incident handover report", style="Subtitle"),
        _paragraph("", style="Body"),
    ]
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "---PAGE BREAK---":
            paragraphs.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>")
            continue
        if line.startswith("# "):
            paragraphs.append(_paragraph(line[2:], style="Heading1"))
            continue
        if line.startswith("## "):
            paragraphs.append(_paragraph(line[3:], style="Heading2"))
            continue
        if line.startswith("- "):
            paragraphs.append(_paragraph(f"- {line[2:]}", style="ListParagraph"))
            continue
        paragraphs.append(_paragraph(line, style="Body"))
    return paragraphs


def _paragraph(text: str, *, style: str | None = None, num_id: int | None = None) -> str:
    p_pr = _paragraph_properties(style=style, num_id=num_id)
    return f"<w:p>{p_pr}{''.join(_runs(text))}</w:p>"


def _paragraph_properties(*, style: str | None, num_id: int | None) -> str:
    children: list[str] = []
    if style:
        children.append(f"<w:pStyle w:val=\"{style}\"/>")
    if num_id is not None:
        children.append(
            f"<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"{num_id}\"/></w:numPr>"
        )
    if not children:
        return ""
    return f"<w:pPr>{''.join(children)}</w:pPr>"


def _runs(text: str) -> list[str]:
    if text == "":
        return ["<w:r><w:t></w:t></w:r>"]
    runs: list[str] = []
    cursor = 0
    for match in re.finditer(r"\*\*(.+?)\*\*", text):
        if match.start() > cursor:
            runs.append(_run(text[cursor:match.start()]))
        runs.append(_run(match.group(1), bold=True))
        cursor = match.end()
    if cursor < len(text):
        runs.append(_run(text[cursor:]))
    return runs


def _run(text: str, *, bold: bool = False) -> str:
    run_props = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f"<w:r>{run_props}<w:t xml:space=\"preserve\">{html.escape(text)}</w:t></w:r>"


def _document_xml(paragraphs: list[str]) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(paragraphs)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1440" w:bottom="1080" w:left="1440" w:header="720" w:footer="720"/>
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
</Relationships>"""


def _styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Body">
    <w:name w:val="Body"/>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ReportKicker">
    <w:name w:val="Report Kicker"/>
    <w:pPr><w:spacing w:before="120" w:after="80"/><w:jc w:val="left"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:caps/><w:sz w:val="20"/><w:color w:val="2563EB"/><w:spacing w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr>
      <w:spacing w:before="80" w:after="160"/>
      <w:pBdr><w:bottom w:val="single" w:sz="10" w:space="8" w:color="2563EB"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="38"/><w:color w:val="0F172A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr><w:spacing w:after="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="64748B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Body"/>
    <w:pPr><w:spacing w:after="90" w:line="276" w:lineRule="auto"/><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Body"/>
    <w:next w:val="Body"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="30"/><w:color w:val="0F172A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Body"/>
    <w:next w:val="Body"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="25"/><w:color w:val="334155"/></w:rPr>
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
