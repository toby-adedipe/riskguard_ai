from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class SignalEvent(BaseModel):
    event_id: str
    lga_id: str
    cluster_id: str
    site_id: str
    domain: Literal["network", "bts", "billing", "complaints", "recharge", "device_sessions"]
    metric_name: str
    value: float
    baseline_mean: float
    baseline_std: float
    z_score: float
    timestamp: datetime
    mode: Literal["baseline", "incident", "recovery"]


class RiskScore(BaseModel):
    lga_id: str
    score: float                   # 0–100; peak Ikeja = 87
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float              # 0–1
    time_to_breach_minutes: int    # 47 at peak
    contributing_domains: list[str]
    computed_at: datetime


class Incident(BaseModel):
    incident_id: str               # "INC-2025-0502-IKEJA-001"
    lga_id: str
    cause: str
    phase: Literal["active", "recovery", "resolved"]
    subscribers_affected: int      # 18_420
    enterprise_lines_affected: int # 312
    revenue_at_risk_ngn: float     # 8_700_000.0
    compensation_exposure_ngn: float  # 2_100_000.0
    peak_score: float              # 87.0
    current_score: float
    time_to_breach_minutes: int    # 47
    started_at: datetime
    updated_at: datetime
    signal_evidence_ids: list[str]
