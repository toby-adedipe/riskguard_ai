from __future__ import annotations

from app.core.schemas import InvestigationRun
from app.modules.copilot.harness import HarnessRunReport
from app.modules.copilot.report_documents import CompiledReportDocument
from app.modules.copilot.schemas import FollowUpExchange


class InvestigationRunRepository:
    def __init__(self) -> None:
        self._runs: dict[str, InvestigationRun] = {}
        self._reports: dict[str, HarnessRunReport] = {}
        self._documents: dict[str, CompiledReportDocument] = {}
        self._follow_ups: dict[str, list[FollowUpExchange]] = {}

    def create(self, run: InvestigationRun) -> InvestigationRun:
        self._runs[run.run_id] = run
        return run

    def get(self, run_id: str) -> InvestigationRun | None:
        return self._runs.get(run_id)

    def list_for_incident(self, incident_id: str) -> list[InvestigationRun]:
        return [run for run in self._runs.values() if run.incident_id == incident_id]

    def update(self, run: InvestigationRun) -> InvestigationRun:
        self._runs[run.run_id] = run
        return run

    def create_report(self, report: HarnessRunReport) -> HarnessRunReport:
        self._reports[report.harness_run_id] = report
        return report

    def get_report(self, harness_run_id: str) -> HarnessRunReport | None:
        return self._reports.get(harness_run_id)

    def store_report_document(
        self,
        harness_run_id: str,
        document: CompiledReportDocument,
    ) -> CompiledReportDocument:
        self._documents[harness_run_id] = document
        return document

    def get_report_document(self, harness_run_id: str) -> CompiledReportDocument | None:
        return self._documents.get(harness_run_id)

    def list_reports_for_incident(self, incident_id: str) -> list[HarnessRunReport]:
        return [
            report
            for report in self._reports.values()
            if report.incident_id == incident_id
        ]

    def append_follow_up(
        self,
        harness_run_id: str,
        exchange: FollowUpExchange,
    ) -> FollowUpExchange:
        self._follow_ups.setdefault(harness_run_id, []).append(exchange)
        return exchange

    def list_follow_ups(
        self,
        harness_run_id: str,
        conversation_id: str | None = None,
    ) -> list[FollowUpExchange]:
        exchanges = self._follow_ups.get(harness_run_id, [])
        if conversation_id is None:
            return list(exchanges)
        return [
            exchange
            for exchange in exchanges
            if exchange.conversation_id == conversation_id
        ]


_repo = InvestigationRunRepository()


def get_investigation_run_repo() -> InvestigationRunRepository:
    return _repo
