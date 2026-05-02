"""Shared Pydantic shapes that cross domain boundaries.

These are the contracts named in docs/MVP_BLUEPRINT.md §5. They live here so
every module imports the same definition. Module-specific request/response
shapes belong in each module's `schemas.py`.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


Severity = Literal["green", "amber", "red"]
SeverityHint = Literal["low", "medium", "high", "critical"]
IncidentPhase = Literal["active", "mitigating", "recovery", "resolved"]
SignalDomain = Literal[
    "network",
    "bts",
    "billing",
    "sales",
    "recharge",
    "complaints",
    "device_sessions",
]

NetworkKpi = Literal[
    "cell_availability_pct",
    "dropped_call_rate_pct",
    "congestion_rate_pct",
]
BtsKpi = Literal[
    "site_availability_pct",
    "bts_dropped_call_rate_pct",
    "bts_congestion_rate_pct",
]
BillingKpi = Literal[
    "failed_rating_events",
    "invoice_mismatch_rate_pct",
    "revenue_leakage_anomaly_score",
]
SalesKpi = Literal[
    "activation_success_rate_pct",
    "dealer_channel_availability_pct",
    "b2b_order_failure_rate_pct",
]
RechargeKpi = Literal["recharge_success_rate_pct"]
ComplaintsKpi = Literal["complaint_volume", "complaint_rate_per_1k_subscribers"]
DeviceSessionKpi = Literal[
    "session_failure_rate_pct",
    "attach_failure_rate_pct",
]
SignalKpi = Literal[
    "cell_availability_pct",
    "dropped_call_rate_pct",
    "congestion_rate_pct",
    "site_availability_pct",
    "bts_dropped_call_rate_pct",
    "bts_congestion_rate_pct",
    "failed_rating_events",
    "invoice_mismatch_rate_pct",
    "revenue_leakage_anomaly_score",
    "activation_success_rate_pct",
    "dealer_channel_availability_pct",
    "b2b_order_failure_rate_pct",
    "recharge_success_rate_pct",
    "complaint_volume",
    "complaint_rate_per_1k_subscribers",
    "session_failure_rate_pct",
    "attach_failure_rate_pct",
]


class SignalDimensions(BaseModel):
    cluster_id: str | None = None
    site_id: str | None = None
    bts_id: str | None = None
    sector_id: str | None = None
    channel_id: str | None = None
    dealer_id: str | None = None
    enterprise_account_id: str | None = None
    customer_segment: Literal["consumer", "sme", "enterprise"] | None = None
    service_type: str | None = None
    device_cohort: str | None = None


class SignalEvent(BaseModel):
    """Canonical synthetic stream record shared across all telecom domains."""

    event_id: str
    lga_id: str
    domain: SignalDomain
    kpi: SignalKpi
    value: float
    unit: str | None = None
    source_system: str = "synthetic"
    baseline_value: float | None = None
    delta_pct: float | None = None
    threshold_value: float | None = None
    anomaly_score: float | None = Field(default=None, ge=0, le=1)
    severity_hint: SeverityHint | None = None
    sample_window_minutes: int | None = None
    correlation_key: str | None = None
    evidence_id: str | None = None
    dimensions: SignalDimensions = Field(default_factory=SignalDimensions)
    timestamp: datetime


class FeatureWindow(BaseModel):
    """Derived rolling window used by the risk engine for scoring/prediction."""

    lga_id: str
    domain: SignalDomain
    kpi: SignalKpi
    window_minutes: int
    current_value: float
    rolling_mean: float
    rolling_stddev: float
    z_score: float
    delta_pct: float
    anomaly_score: float = Field(ge=0, le=1)
    sample_count: int = Field(ge=1)
    time_to_breach_minutes: int | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    updated_at: datetime


class SignalEvidence(BaseModel):
    """Normalized evidence returned to agents instead of raw telemetry rows."""

    evidence_id: str
    lga_id: str
    incident_id: str | None = None
    domain: SignalDomain
    kpi: SignalKpi
    current_value: float
    baseline_value: float | None = None
    delta_pct: float | None = None
    anomaly_score: float | None = Field(default=None, ge=0, le=1)
    severity_hint: SeverityHint | None = None
    summary: str
    source_system: str = "synthetic"
    timestamp: datetime
    related_event_ids: list[str] = Field(default_factory=list)
    dimensions: SignalDimensions = Field(default_factory=SignalDimensions)


class RiskScore(BaseModel):
    lga_id: str
    score: float = Field(ge=0, le=100)
    severity: Severity
    confidence: float = Field(ge=0, le=1)
    time_to_breach_minutes: int | None = None
    updated_at: datetime


class IncidentImpact(BaseModel):
    affected_subscribers: int
    enterprise_lines: int
    revenue_at_risk_ngn: float
    compensation_exposure_ngn: float
    ncc_exposure_summary: str


class Incident(BaseModel):
    incident_id: str
    lga_id: str
    cause: str
    phase: IncidentPhase
    opened_at: datetime
    impact: IncidentImpact


class AuditLogEntry(BaseModel):
    entry_id: str
    incident_id: str
    operator: str
    action_id: str
    expected_impact: str
    rationale: str
    timestamp: datetime


class AgentFact(BaseModel):
    claim: str
    evidence_id: str


class AgentInference(BaseModel):
    claim: str
    confidence: float = Field(ge=0, le=1)


class AgentRecommendation(BaseModel):
    action: str
    requires_approval: bool = True


class AgentResponse(BaseModel):
    agent_role: str
    incident_id: str
    facts: list[AgentFact] = Field(default_factory=list)
    inferences: list[AgentInference] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
    validation_status: Literal["passed", "revised", "rejected"] = "passed"
