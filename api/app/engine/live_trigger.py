"""Live demo orchestrator.

Runs the full Ikeja demo as a scripted background sequence and emits events
to the EventLog so the frontend can render the agent's thinking in real time.

Phases:
  1. Stream telemetry + climbing score (~6s, 12 ticks)
  2. Wake the agent (1s pause)
  3. Run the copilot investigation with an instrumented tool registry that
     emits a `tool_call` / `tool_result` event for every backend call. We
     also synthesize role_start / role_complete and progressively emit
     facts/inferences/recommendations from each role.
  4. Final report event with the harness_run_id.

The score writes to risk_repo on every tick so the existing /risk/map polling
keeps working while the live event stream tells the richer story.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.schemas import (
    AgentResponse,
    Incident,
    IncidentImpact,
    InvestigationTrigger,
    RiskScore,
)
from app.engine.constants import (
    IKEJA_FIXTURES,
    IKEJA_INCIDENT_TRAJECTORY,
    IKEJA_INCIDENT_Z_SCORES,
)
from app.engine.event_log import EventLog
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.harness import HarnessRunReport, InvestigationHarness
from app.modules.copilot.orchestrator import MainInvestigationAgent
from app.modules.copilot.report_documents import build_compiled_report_document
from app.modules.copilot.role_plugins import AgentExecutionContext
from app.modules.copilot.semantic_runtime import SemanticKernelRoleRunner
from app.modules.copilot.services import DemoCopilotToolBackend
from app.modules.copilot.tool_contracts import CopilotToolBackend, ToolName
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.validation import ClaimValidator
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository

logger = logging.getLogger(__name__)

INCIDENT_ID = "INC-2026-IKEJA-001"
LGA_ID = "ikeja"
CAUSE = "network outage"

# Domain → metric label / unit / Lagos baseline (mean, std). The values are
# pulled from data-engine/output/calibration.py but vendored here so the demo
# doesn't depend on numpy at import time.
_DOMAIN_METRICS: dict[str, tuple[str, str, float, float]] = {
    "network": ("dropped_call_rate_pct", "%", 1.26, 3.32),
    "bts": ("site_availability_pct", "%", 92.4, 4.34),
    "billing": ("failed_charging_pct", "%", 0.0504, 0.01),
    "complaints": ("ticket_volume_per_hr", "tickets/hr", 100.81, 41.68),
    "social_media": ("social_posts_per_hr", "posts/hr", 14.0, 35.1),
    "recharge": ("failed_topup_pct", "%", 0.0499, 0.01),
}

_DOMAIN_LABEL: dict[str, str] = {
    "network": "Network performance",
    "bts": "BTS availability",
    "billing": "Billing system",
    "complaints": "Customer complaints",
    "social_media": "Social listening",
    "recharge": "Recharge platform",
}

_LIVE_DOMAIN_Z_SCORES: dict[str, float] = {
    **IKEJA_INCIDENT_Z_SCORES,
    "social_media": 4.9,
}

_BTS_SITES: list[str] = list(IKEJA_FIXTURES.get("unstable_sites") or IKEJA_FIXTURES["bts_sites"])

# Plain-English copy for tool calls. Maps (role, tool_name) → "human form".
_TOOL_COPY: dict[tuple[str, str], str] = {
    ("investigation_harness", "get_incident_context"): "Pulling incident header and impact",
    ("investigation_harness", "get_risk_snapshot"): "Reading current risk score",
    ("investigation_harness", "get_feature_windows"): "Loading 15-minute rolling z-score windows",
    ("investigation_harness", "get_signal_evidence"): "Collecting cross-domain signal evidence",
    ("network_risk", "get_incident_context"): "Pulling incident details",
    ("network_risk", "get_risk_snapshot"): "Reading current risk score",
    ("network_risk", "get_signal_evidence"): "Fetching network + BTS signal evidence",
    ("network_risk", "get_feature_windows"): "Loading rolling network/BTS windows",
    ("revenue_assurance", "get_incident_context"): "Pulling incident details",
    ("revenue_assurance", "estimate_impact"): "Estimating revenue exposure",
    ("revenue_assurance", "get_signal_evidence"): "Fetching billing/sales/recharge evidence",
    ("customer_experience", "estimate_impact"): "Counting affected subscribers",
    ("customer_experience", "get_signal_evidence"): "Fetching complaints, social listening + device evidence",
    ("mitigation", "get_incident_context"): "Pulling incident details",
    ("mitigation", "get_mitigation_playbook"): "Loading mitigation playbook for this risk type",
    ("mitigation", "run_pre_action_simulation"): "Running pre-action simulation across options",
    ("mitigation", "write_investigation_note"): "Recording mitigation note in audit trail",
    ("compliance", "get_incident_context"): "Pulling incident details",
    ("compliance", "estimate_impact"): "Estimating compliance impact",
    ("compliance", "get_audit_trail"): "Reviewing audit trail",
    ("compliance", "generate_ncc_pack_draft"): "Drafting NCC compliance pack",
    ("compliance", "validate_claims_against_context"): "Cross-checking claims against context",
}

_ROLE_LABEL: dict[str, str] = {
    "network_risk": "Network Risk",
    "revenue_assurance": "Revenue Assurance",
    "customer_experience": "Customer Experience",
    "mitigation": "Mitigation Planner",
    "compliance": "Compliance Officer",
    "investigation_harness": "Investigation Harness",
}

# Orchestrator narration shown BEFORE the role card appears, explaining
# the reasoning for dispatching this specialist. This is the visible chain of
# thought that connects one role's output to the next one's invocation.
_DISPATCH_REASONING: dict[str, str] = {
    "network_risk": (
        "The loudest anomalies are in network and BTS — dispatching the Network "
        "Risk specialist first to confirm whether this is a cluster-wide "
        "degradation or a single-cell flap."
    ),
    "revenue_assurance": (
        "Network specialist confirmed access degradation. Now I need to quantify "
        "the revenue exposure for the operator — calling Revenue Assurance to "
        "estimate impact in NGN and enterprise lines."
    ),
    "customer_experience": (
        "Revenue impact is significant; the operator will want a subscriber count. "
        "Activating Customer Experience to count affected MSISDNs and check the "
        "complaint surge."
    ),
    "mitigation": (
        "Three specialists confirmed the outage profile. Score is above 75 — that "
        "triggers the mitigation gate. Engaging the Mitigation Planner to compare "
        "playbook options against do-nothing."
    ),
    "compliance": (
        "Score is at 87 with subscriber impact above 18,000. NCC compensation "
        "exposure is non-trivial. Pulling in Compliance Officer to pre-stage the "
        "regulatory pack while we still have time to breach."
    ),
}

_SYNTHESIS_NOTE: dict[str, str] = {
    "network_risk": "Network specialist done.",
    "revenue_assurance": "Revenue exposure quantified.",
    "customer_experience": "Subscriber impact confirmed.",
    "mitigation": "Mitigation playbook scored.",
    "compliance": "Compliance pack staged.",
    "investigation_harness": "Harness sweep complete.",
}

TELEMETRY_TICK_SECONDS = 0.25
WAKE_PAUSE_SECONDS = 0.35
NARRATION_PAUSE_SECONDS = 0.55
ROLE_START_PAUSE_SECONDS = 0.15
ROLE_COMPLETE_PAUSE_SECONDS = 0.2
TOOL_CALL_PAUSE_SECONDS = 0.15
TOOL_RESULT_PAUSE_SECONDS = 0.1
FACT_PAUSE_SECONDS = 0.08


def _fmt_value(domain: str, value: float) -> str:
    metric_name, unit, _, _ = _DOMAIN_METRICS[domain]
    if unit == "%":
        return f"{value:.2f}%"
    if unit == "tickets/hr":
        return f"{value:.0f} tickets/hr"
    return f"{value:.2f}"


class _InstrumentedToolRegistry(ToolRegistry):
    """ToolRegistry that emits tool_call / tool_result events as it works."""

    def __init__(
        self,
        backend: CopilotToolBackend,
        event_log: EventLog,
        on_role_change,
    ) -> None:
        super().__init__(backend)
        self._log = event_log
        self._current_role: str | None = None
        self._on_role_change = on_role_change

    def call(self, role: str, tool_name: ToolName, /, *args, **kwargs):  # type: ignore[override]
        if role != self._current_role:
            previous = self._current_role
            self._current_role = role
            self._on_role_change(previous, role)

        copy = _TOOL_COPY.get((role, tool_name), tool_name.replace("_", " "))
        self._log.append(
            "tool_call",
            role=role,
            role_label=_ROLE_LABEL.get(role, role),
            tool=tool_name,
            description=copy,
            args=_summarize_args(args, kwargs),
        )
        time.sleep(TOOL_CALL_PAUSE_SECONDS)
        try:
            result = super().call(role, tool_name, *args, **kwargs)
        except Exception as exc:
            self._log.append(
                "tool_error",
                role=role,
                tool=tool_name,
                error=str(exc),
            )
            raise
        self._log.append(
            "tool_result",
            role=role,
            role_label=_ROLE_LABEL.get(role, role),
            tool=tool_name,
            summary=_summarize_result(tool_name, result),
        )
        time.sleep(TOOL_RESULT_PAUSE_SECONDS)
        return result


def _summarize_args(args: tuple, kwargs: dict) -> str:
    parts: list[str] = []
    for value in args:
        parts.append(_short(value))
    for key, value in kwargs.items():
        parts.append(f"{key}={_short(value)}")
    return ", ".join(parts) if parts else "—"


def _short(value: Any) -> str:
    if isinstance(value, list):
        if not value:
            return "[]"
        return "[" + ", ".join(_short(item) for item in value[:4]) + ("…" if len(value) > 4 else "") + "]"
    if isinstance(value, str):
        return value
    return str(value)


def _summarize_result(tool_name: str, result: Any) -> str:
    if result is None:
        return "no result"
    if tool_name == "get_signal_evidence":
        items = list(result)
        if not items:
            return "no evidence rows"
        domains = sorted({item.domain for item in items})
        return f"{len(items)} evidence rows across {', '.join(domains)}"
    if tool_name == "get_feature_windows":
        items = list(result)
        return f"{len(items)} rolling windows"
    if tool_name == "get_risk_snapshot":
        return f"score {result.score:.0f}/100, severity {result.severity}"
    if tool_name == "get_incident_context":
        if hasattr(result, "phase"):
            return f"{result.cause} in {result.lga_id}, phase {result.phase}"
        return "no active incident"
    if tool_name == "estimate_impact":
        subs = result.get("affected_subscribers") if isinstance(result, dict) else None
        if subs is not None:
            return f"{subs:,} subscribers, ₦{result.get('revenue_at_risk_ngn', 0):,.0f} at risk"
        return "impact computed"
    if tool_name == "get_mitigation_playbook":
        return f"{len(result.options)} mitigation options"
    if tool_name == "run_pre_action_simulation":
        return f"do-nothing curve {result.do_nothing_curve} vs {len(result.actions)} action curves"
    if tool_name == "get_audit_trail":
        return f"{len(list(result))} audit entries"
    if tool_name == "generate_ncc_pack_draft":
        return "NCC pack draft prepared"
    if tool_name == "validate_claims_against_context":
        return f"validation status: {result.get('status', 'unknown') if isinstance(result, dict) else 'unknown'}"
    if tool_name == "write_investigation_note":
        if isinstance(result, dict):
            return f"note {result.get('note_id', '')}"
        return "note recorded"
    return "result returned"


def run_live_trigger(
    *,
    risk_repo: RiskScoreRepository,
    incident_repo: IncidentRepository,
    audit_repo: AuditLogRepository,
    compliance_repo: CompliancePackRepository,
    run_repo: InvestigationRunRepository,
    event_log: EventLog,
    session_id: str,
    wake_threshold: float = 65.0,
) -> None:
    """Background-thread entry point for one full live demo run."""
    try:
        _run(
            risk_repo=risk_repo,
            incident_repo=incident_repo,
            audit_repo=audit_repo,
            compliance_repo=compliance_repo,
            run_repo=run_repo,
            event_log=event_log,
            session_id=session_id,
            wake_threshold=wake_threshold,
        )
    except Exception as exc:
        logger.exception("live_trigger crashed")
        event_log.append("error", message=f"Live demo crashed: {exc}")
        event_log.append("complete", status="failed")


def _run(
    *,
    risk_repo: RiskScoreRepository,
    incident_repo: IncidentRepository,
    audit_repo: AuditLogRepository,
    compliance_repo: CompliancePackRepository,
    run_repo: InvestigationRunRepository,
    event_log: EventLog,
    session_id: str,
    wake_threshold: float = 65.0,
) -> None:
    event_log.append(
        "session_started",
        incident_id=INCIDENT_ID,
        lga_id=LGA_ID,
        cause=CAUSE,
    )

    # ---- Phase 1: telemetry climb -------------------------------------------------
    trajectory = list(IKEJA_INCIDENT_TRAJECTORY[:13])  # ~6s at 0.5s/tick
    peak = float(IKEJA_FIXTURES["peak_score"])
    incident_seeded = False

    for tick_idx, score_value in enumerate(trajectory):
        progress = score_value / peak
        now = datetime.now(timezone.utc)
        risk_repo.upsert(
            RiskScore(
                lga_id=LGA_ID,
                score=float(score_value),
                severity=_severity_for(score_value),
                confidence=round(min(0.5 + score_value / 200.0, 0.99), 3),
                time_to_breach_minutes=_ttb_for(score_value),
                updated_at=now,
            )
        )

        # Synthesize 5 telemetry rows per tick (one per domain)
        signals: list[dict[str, Any]] = []
        for domain, peak_z in _LIVE_DOMAIN_Z_SCORES.items():
            metric, unit, mean, std = _DOMAIN_METRICS[domain]
            z = round(peak_z * progress, 2)
            value = round(mean + z * std, 3)
            delta_pct = round((z * std / mean) * 100, 1) if mean != 0 else 0.0
            site = _BTS_SITES[(tick_idx + hash(domain)) % len(_BTS_SITES)]
            signals.append(
                {
                    "site_id": site,
                    "domain": domain,
                    "domain_label": _DOMAIN_LABEL[domain],
                    "metric": metric,
                    "value": value,
                    "value_str": _fmt_value(domain, value),
                    "z_score": z,
                    "delta_pct": delta_pct,
                }
            )
        event_log.append(
            "tick",
            tick=tick_idx,
            score=float(score_value),
            severity=_severity_for(score_value),
            ttb_minutes=_ttb_for(score_value),
            confidence=round(min(0.5 + score_value / 200.0, 0.99), 3),
            signals=signals,
            domain_z_scores={
                domain: round(peak_z * progress, 2)
                for domain, peak_z in _LIVE_DOMAIN_Z_SCORES.items()
            },
        )

        # Seed the incident the moment we cross into red territory so /incidents
        # endpoint resolves while the climb is still in flight.
        if not incident_seeded and score_value >= 65:
            incident_repo.upsert(
                Incident(
                    incident_id=INCIDENT_ID,
                    lga_id=LGA_ID,
                    cause=CAUSE,
                    phase="active",
                    opened_at=now,
                    impact=IncidentImpact(
                        affected_subscribers=int(IKEJA_FIXTURES["subscribers_affected"]),
                        enterprise_lines=int(IKEJA_FIXTURES["enterprise_lines_affected"]),
                        revenue_at_risk_ngn=float(IKEJA_FIXTURES["revenue_at_risk_ngn"]),
                        compensation_exposure_ngn=float(IKEJA_FIXTURES["compensation_exposure_ngn"]),
                        ncc_exposure_summary=(
                            "NCC compensation exposure NGN "
                            f"{IKEJA_FIXTURES['compensation_exposure_ngn']:,.0f} "
                            f"across {IKEJA_FIXTURES['subscribers_affected']:,} subscribers."
                        ),
                    ),
                )
            )
            incident_seeded = True
            event_log.append(
                "incident_opened",
                incident_id=INCIDENT_ID,
                lga_id=LGA_ID,
                cause=CAUSE,
                score=float(score_value),
            )

        time.sleep(TELEMETRY_TICK_SECONDS)

    # Make sure score is at peak.
    risk_repo.upsert(
        RiskScore(
            lga_id=LGA_ID,
            score=float(peak),
            severity="red",
            confidence=0.93,
            time_to_breach_minutes=int(IKEJA_FIXTURES["time_to_breach_minutes"]),
            updated_at=datetime.now(timezone.utc),
        )
    )

    # ---- Phase 2: wake ------------------------------------------------------------
    if peak < wake_threshold:
        event_log.append(
            "threshold_not_met",
            incident_id=INCIDENT_ID,
            peak_score=float(peak),
            threshold=float(wake_threshold),
            message=(
                f"Peak score {peak:.0f} stayed below the selected agent threshold "
                f"{wake_threshold:.0f}. Investigation copilot was not activated."
            ),
        )
        event_log.append(
            "orchestrator_thought",
            text=(
                f"Peak score {peak:.0f} stayed below the selected agent trigger "
                f"threshold of {wake_threshold:.0f}. I am keeping the incident in "
                "telemetry monitoring and not dispatching LLM-backed specialists."
            ),
        )
        event_log.append("complete", status="ok")
        return

    event_log.append(
        "wake",
        incident_id=INCIDENT_ID,
        score=float(peak),
        message=(
            f"Score crossed selected agent threshold {wake_threshold:.0f} and "
            "multi-domain anomalies were confirmed. Activating investigation copilot."
        ),
    )
    time.sleep(WAKE_PAUSE_SECONDS)
    event_log.append(
        "orchestrator_thought",
        text=(
            "Reading peak score 87, 47-minute time-to-breach. Anomalies are "
            "multi-domain — network, BTS, complaints, and social listening all "
            "well above their rolling baselines. This isn't a single-cell flap, it looks "
            "cluster-wide. I'll loop in specialists in priority order before "
            "committing to a mitigation."
        ),
    )
    time.sleep(NARRATION_PAUSE_SECONDS)

    # ---- Phase 3: investigation ---------------------------------------------------
    backend = DemoCopilotToolBackend(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
    )

    dispatched: set[str] = set()
    completed: set[str] = set()

    def on_role_change(previous: str | None, new_role: str) -> None:
        if previous and previous in _ROLE_LABEL and previous not in completed:
            completed.add(previous)
            event_log.append(
                "role_complete",
                role=previous,
                role_label=_ROLE_LABEL.get(previous, previous),
                synthesis=_SYNTHESIS_NOTE.get(previous, ""),
            )
            time.sleep(ROLE_COMPLETE_PAUSE_SECONDS)

        if new_role in _ROLE_LABEL and new_role not in dispatched:
            dispatched.add(new_role)
            reasoning = _DISPATCH_REASONING.get(new_role)
            if reasoning:
                event_log.append("orchestrator_thought", text=reasoning, target_role=new_role)
                time.sleep(NARRATION_PAUSE_SECONDS)
            event_log.append(
                "role_start",
                role=new_role,
                role_label=_ROLE_LABEL.get(new_role, new_role),
            )
            time.sleep(ROLE_START_PAUSE_SECONDS)

    registry = _InstrumentedToolRegistry(backend, event_log, on_role_change)
    settings = get_settings()
    role_runner = (
        SemanticKernelRoleRunner(settings=settings)
        if settings.azure_openai_configured
        else None
    )
    agent = MainInvestigationAgent(
        registry=registry,
        validator=ClaimValidator(),
        runs=run_repo,
        role_runner=role_runner,
    )

    trigger = InvestigationTrigger(
        trigger_id=str(uuid.uuid4()),
        lga_id=LGA_ID,
        incident_id=INCIDENT_ID,
        trigger_type="threshold",
        score=float(peak),
        confidence=0.93,
        time_to_breach_minutes=int(IKEJA_FIXTURES["time_to_breach_minutes"]),
        triggered_domains=list(_LIVE_DOMAIN_Z_SCORES.keys()),
        reason=(
            f"Risk score crossed selected threshold {wake_threshold:.0f} with "
            "multi-domain anomalies (network, bts, complaints)."
        ),
        created_at=datetime.now(timezone.utc),
    )

    # Run the investigation. The instrumented registry emits tool_call/result.
    # When each role's plugin populates its AgentResponse, we surface its facts
    # and inferences progressively.
    harness = InvestigationHarness(
        registry=registry,
        run_role=lambda role_name, ctx: _wrap_role_run(agent, role_name, ctx, event_log),
        validate_response=agent._validate_response,
    )
    try:
        harness_report: HarnessRunReport = harness.run(trigger)
    finally:
        if role_runner is not None:
            role_runner.close()

    # Close the final specialist card without dispatching the harness as a UI role.
    on_role_change(registry._current_role, "investigation_harness")
    event_log.append(
        "role_complete",
        role="investigation_harness",
        role_label=_ROLE_LABEL["investigation_harness"],
    )

    # Persist run + report so the existing /copilot/incidents/.../investigations
    # listing endpoint sees it.
    from app.core.schemas import InvestigationRun

    run = InvestigationRun(
        run_id=str(uuid.uuid4()),
        harness_run_id=harness_report.harness_run_id,
        lga_id=trigger.lga_id,
        incident_id=trigger.incident_id,
        trigger=trigger,
        selected_roles=harness_report.selected_roles,
        tools_called=harness_report.tools_called,
        status="completed" if harness_report.status == "passed" else "failed",
        summary=harness_report.summary,
        created_at=harness_report.started_at,
        completed_at=harness_report.completed_at,
    )
    run_repo.create(run)
    run_repo.create_report(harness_report)
    run_repo.store_report_document(
        harness_report.harness_run_id,
        build_compiled_report_document(harness_report),
    )

    # ---- Phase 4: final report ---------------------------------------------------
    recommendation = harness_report.recommendations[0] if harness_report.recommendations else None
    sim = harness_report.mitigation_simulation

    if recommendation is not None:
        event_log.append(
            "orchestrator_thought",
            text=(
                f"All five specialists reported in. Mitigation Planner picked "
                f"`{_action_label(recommendation.action)}` as the strongest action — "
                "its projected curve clears the recovery floor of 42 well before "
                "do-nothing breaches. Surfacing the recommendation to the operator "
                "with the full decision trail."
            ),
        )
        time.sleep(NARRATION_PAUSE_SECONDS)
    event_log.append(
        "report_ready",
        harness_run_id=harness_report.harness_run_id,
        incident_id=harness_report.incident_id,
        summary=harness_report.summary,
        selected_roles=harness_report.selected_roles,
        recommended_action=recommendation.action if recommendation else None,
        recommended_action_label=_action_label(recommendation.action) if recommendation else None,
        do_nothing_curve=sim.do_nothing_curve if sim else None,
        recovery_curve=(
            next(
                (item.projected_score_curve for item in sim.actions if item.recommended),
                sim.actions[0].projected_score_curve if sim and sim.actions else None,
            )
            if sim
            else None
        ),
        evidence_count=len(harness_report.evidence),
    )
    event_log.append("complete", status="ok", harness_run_id=harness_report.harness_run_id)


def _wrap_role_run(
    agent: MainInvestigationAgent,
    role_name: str,
    ctx: AgentExecutionContext,
    event_log: EventLog,
) -> AgentResponse:
    """Run a role and emit progressive fact/inference events from its output."""
    response = agent._run_role(role_name, ctx)

    # Surface facts as they're "produced" with a tiny pause for animation.
    for fact in response.facts:
        event_log.append(
            "fact",
            role=role_name,
            role_label=_ROLE_LABEL.get(role_name, role_name),
            claim=fact.claim,
            evidence_id=fact.evidence_id,
        )
        time.sleep(FACT_PAUSE_SECONDS)
    for inference in response.inferences:
        event_log.append(
            "inference",
            role=role_name,
            role_label=_ROLE_LABEL.get(role_name, role_name),
            claim=inference.claim,
            confidence=inference.confidence,
        )
        time.sleep(FACT_PAUSE_SECONDS)
    for recommendation in response.recommendations:
        event_log.append(
            "recommendation",
            role=role_name,
            role_label=_ROLE_LABEL.get(role_name, role_name),
            action=recommendation.action,
            action_label=_action_label(recommendation.action),
            requires_approval=recommendation.requires_approval,
        )
        time.sleep(FACT_PAUSE_SECONDS)
    return response


def _action_label(action_id: str) -> str:
    return {
        "reroute_traffic": "Reroute traffic",
        "dispatch_field_team": "Dispatch field team",
    }.get(action_id, action_id.replace("_", " ").title())


def _severity_for(score: float) -> str:
    if score >= 65:
        return "red"
    if score >= 35:
        return "amber"
    return "green"


def _ttb_for(score: float) -> int | None:
    if score >= 80:
        return int(IKEJA_FIXTURES["time_to_breach_minutes"])
    if score >= 35:
        return max(5, int(120 - (score - 35) * 2))
    return None


_lock = threading.Lock()
_active_thread: threading.Thread | None = None


def start_live_trigger(**kwargs: Any) -> str:
    """Spawns the live trigger on a background thread; returns the session_id.

    Cancels any previous run by replacing the event log session id; the old
    thread will keep running but its events stay tagged with the previous
    session id and will be filtered out by the frontend.
    """
    global _active_thread

    session_id = str(uuid.uuid4())
    event_log: EventLog = kwargs["event_log"]
    event_log.reset(session_id)

    with _lock:
        _active_thread = threading.Thread(
            target=run_live_trigger,
            kwargs={**kwargs, "session_id": session_id},
            name=f"live-trigger-{session_id[:8]}",
            daemon=True,
        )
        _active_thread.start()

    return session_id
