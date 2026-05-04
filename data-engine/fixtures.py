IKEJA_FIXTURES: dict = {
    "lga_id": "IKEJA",
    "incident_id": "INC-2025-0502-IKEJA-001",
    "cluster_id": "LAGOS_CENTRAL",
    "bts_sites": [
        "BTS_IKEJA_001", "BTS_IKEJA_002", "BTS_IKEJA_003", "BTS_IKEJA_004",
        "BTS_IKEJA_005", "BTS_IKEJA_006", "BTS_IKEJA_007", "BTS_IKEJA_008",
    ],
    "unstable_sites": [
        "BTS_IKEJA_001", "BTS_IKEJA_002", "BTS_IKEJA_003", "BTS_IKEJA_004",
        "BTS_IKEJA_005", "BTS_IKEJA_006", "BTS_IKEJA_007",
    ],
    "subscribers_affected": 18_420,
    "enterprise_lines_affected": 312,
    "revenue_at_risk_ngn": 8_700_000.0,
    "compensation_exposure_ngn": 2_100_000.0,
    "peak_score": 87.0,
    "recovery_floor": 42.0,
    "time_to_breach_minutes": 47,
    "cause": "Compound fibre degradation and BTS power instability across 7 sites",
}

DOMAIN_WEIGHTS: dict[str, float] = {
    "network":    0.35,
    "bts":        0.25,
    "complaints": 0.20,
    "billing":    0.12,
    "recharge":   0.08,
}

IKEJA_INCIDENT_Z_SCORES: dict[str, float] = {
    "network":    6.5,   # packet loss +6.5σ
    "bts":        4.2,   # power stability -4.2σ (7 sites down)
    "complaints": 5.8,   # complaint rate +5.8σ
    "billing":    3.1,   # billing failures +3.1σ
    "recharge":   2.9,   # recharge velocity -2.9σ
}

# raw = Σ(weight_d * clamp(|z_d|, 0, 10))
# raw_ikeja ≈ 5.089 → score = round(clamp(raw * CALIBRATION_FACTOR, 0, 100), 1) = 87
CALIBRATION_FACTOR: float = 17.09
