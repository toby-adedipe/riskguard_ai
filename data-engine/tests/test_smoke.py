"""
Smoke test — full chain from trigger to recovery.
Run from data-engine/:  python -m pytest tests/test_smoke.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fixtures import IKEJA_FIXTURES, IKEJA_INCIDENT_Z_SCORES, DOMAIN_WEIGHTS
from schemas import SignalEvent, RiskScore, Incident
from resolver import EntityResolver
from normalizer import EventNormalizer
from features import FeatureEngine
from scoring import RiskScoringEngine
from generator import SyntheticEventGenerator
from impact import IncidentImpactBuilder
from recovery import RecoveryModel
from simulation import run_pre_action_simulation
from repos import DictSignalEventRepo, DictRiskScoreRepo, DictIncidentRepo

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _build_engine():
    """Wires the full engine stack with in-memory repos."""
    resolver  = EntityResolver()
    baselines = {}                     # empty — generator sets z-scores directly
    normalizer = EventNormalizer(resolver, baselines)
    features   = FeatureEngine(window_size=3)
    scoring    = RiskScoringEngine(features)
    sig_repo   = DictSignalEventRepo()
    score_repo = DictRiskScoreRepo()
    generator  = SyntheticEventGenerator(normalizer, sig_repo, score_repo)
    return generator, features, scoring, sig_repo, score_repo


# ---------------------------------------------------------------------------
# Test 1 — imports succeed and fixtures load
# ---------------------------------------------------------------------------

def test_imports_and_fixtures():
    assert IKEJA_FIXTURES["lga_id"] == "IKEJA"
    assert IKEJA_FIXTURES["subscribers_affected"] == 18_420
    assert IKEJA_FIXTURES["peak_score"] == 87.0
    assert IKEJA_FIXTURES["recovery_floor"] == 42.0
    assert IKEJA_FIXTURES["time_to_breach_minutes"] == 47
    assert len(IKEJA_FIXTURES["bts_sites"]) == 8
    assert len(IKEJA_FIXTURES["unstable_sites"]) == 7


# ---------------------------------------------------------------------------
# Test 2 — EntityResolver maps Ikeja sites correctly
# ---------------------------------------------------------------------------

def test_resolver_ikeja_sites():
    resolver = EntityResolver()
    for site in IKEJA_FIXTURES["bts_sites"]:
        assert resolver.resolve_lga(site) == "IKEJA"
        assert resolver.resolve_city(site) == "Lagos"
    assert resolver.resolve_cluster("IKEJA") == "LAGOS_CENTRAL"


# ---------------------------------------------------------------------------
# Test 3 — FeatureEngine z-score override and retrieval
# ---------------------------------------------------------------------------

def test_feature_engine_override():
    fe = FeatureEngine(window_size=3)
    fe.override_zscore("IKEJA", "network", 6.5)
    assert fe.get_domain_zscore("IKEJA", "network") == 6.5
    assert fe.get_domain_zscore("IKEJA", "unknown_domain") == 0.0
    assert fe.get_domain_zscore("UNKNOWN_LGA", "network") == 0.0


# ---------------------------------------------------------------------------
# Test 4 — RiskScoringEngine produces exactly 87 for Ikeja incident
# ---------------------------------------------------------------------------

def test_trigger_ikeja_peak_score():
    fe = FeatureEngine(window_size=3)

    # Inject incident z-scores directly
    for domain, z in IKEJA_INCIDENT_Z_SCORES.items():
        fe.override_zscore("IKEJA", domain, z)

    scoring = RiskScoringEngine(fe)
    result  = scoring.score("IKEJA")

    assert result.score == 87.0,                        f"Expected 87.0, got {result.score}"
    assert result.severity == "critical",               f"Expected critical, got {result.severity}"
    assert result.time_to_breach_minutes == 47,         f"Expected 47, got {result.time_to_breach_minutes}"
    assert result.lga_id == "IKEJA"
    assert len(result.contributing_domains) > 0


# ---------------------------------------------------------------------------
# Test 5 — Baseline score stays green (< 25) for non-incident LGA
# ---------------------------------------------------------------------------

def test_baseline_score_is_green():
    fe = FeatureEngine(window_size=3)
    for domain in DOMAIN_WEIGHTS:
        fe.override_zscore("SURULERE", domain, 0.4)

    scoring = RiskScoringEngine(fe)
    result  = scoring.score("SURULERE")

    assert result.score < 25.0, f"Baseline score too high: {result.score}"
    assert result.severity in ("low", "medium")


# ---------------------------------------------------------------------------
# Test 6 — IncidentImpactBuilder returns all 6 load-bearing numbers
# ---------------------------------------------------------------------------

def test_incident_impact_numbers():
    builder  = IncidentImpactBuilder()
    incident = builder.build(IKEJA_FIXTURES["incident_id"])

    assert incident.subscribers_affected      == 18_420
    assert incident.enterprise_lines_affected == 312
    assert incident.revenue_at_risk_ngn       == 8_700_000.0
    assert incident.compensation_exposure_ngn == 2_100_000.0
    assert incident.peak_score                == 87.0
    assert incident.time_to_breach_minutes    == 47
    assert incident.phase                     == "active"
    assert incident.lga_id                    == "IKEJA"


# ---------------------------------------------------------------------------
# Test 7 — RecoveryModel reaches floor by tick 12, never goes below 42
# ---------------------------------------------------------------------------

def test_recovery_reaches_floor():
    model  = RecoveryModel(IKEJA_FIXTURES["incident_id"])
    scores = [model.tick().score for _ in range(15)]

    assert scores[0]  == 87.0,              f"Recovery must start at 87, got {scores[0]}"
    assert scores[-1] <= 42.0,              f"Recovery must floor at 42, got {scores[-1]}"
    assert all(s >= 42.0 for s in scores),  f"Score went below 42: {min(scores)}"
    assert model.is_complete


# ---------------------------------------------------------------------------
# Test 8 — Pre-action simulation curves are valid
# ---------------------------------------------------------------------------

def test_simulation_curves():
    result = run_pre_action_simulation(
        incident_id = IKEJA_FIXTURES["incident_id"],
        action_ids  = ["traffic_reroute", "field_dispatch", "combined"],
    )

    assert "do_nothing" in result
    assert "traffic_reroute" in result

    do_nothing = [s for _, s in result["do_nothing"]]
    reroute    = [s for _, s in result["traffic_reroute"]]

    assert len(do_nothing) == 12
    assert all(
        do_nothing[i] >= reroute[i] for i in range(12)
    ), "do_nothing must be >= traffic_reroute at every step"

    # Minute offsets must be 0, 5, 10, ...
    offsets = [t for t, _ in result["do_nothing"]]
    assert offsets == list(range(0, 60, 5))

    # Unknown action silently excluded
    unknown = run_pre_action_simulation(IKEJA_FIXTURES["incident_id"], ["unknown_action"])
    assert "unknown_action" not in unknown


# ---------------------------------------------------------------------------
# Test 9 — Generator tick emits events and repos receive them
# ---------------------------------------------------------------------------

def test_generator_emits_events():
    generator, features, scoring, sig_repo, score_repo = _build_engine()

    # Manual tick (no background thread)
    generator._tick()

    events = sig_repo.recent()
    assert len(events) > 0
    assert all(isinstance(e, SignalEvent) for e in events)
    assert any(e.lga_id == "IKEJA" for e in events)


# ---------------------------------------------------------------------------
# Test 10 — Full demo path: trigger → peak 87 → simulate → recover → 42
# ---------------------------------------------------------------------------

def test_full_demo_path():
    fe      = FeatureEngine(window_size=3)
    scoring = RiskScoringEngine(fe)

    # 1. Baseline — Ikeja is green
    for domain in DOMAIN_WEIGHTS:
        fe.override_zscore("IKEJA", domain, 0.4)
    baseline = scoring.score("IKEJA")
    assert baseline.score < 25.0

    # 2. Trigger — inject incident z-scores
    for domain, z in IKEJA_INCIDENT_Z_SCORES.items():
        fe.override_zscore("IKEJA", domain, z)
    peak = scoring.score("IKEJA")
    assert peak.score == 87.0
    assert peak.severity == "critical"

    # 3. Simulate
    curves = run_pre_action_simulation(
        IKEJA_FIXTURES["incident_id"], ["traffic_reroute"]
    )
    assert curves["do_nothing"][0] == (0, 87)

    # 4. Approve → build incident
    incident = IncidentImpactBuilder().build(IKEJA_FIXTURES["incident_id"])
    assert incident.subscribers_affected == 18_420

    # 5. Recover → score reaches 42
    model  = RecoveryModel(IKEJA_FIXTURES["incident_id"])
    scores = [model.tick().score for _ in range(13)]
    assert scores[-1] <= 42.0

    print("\n  Full demo path: PASSED")
    print(f"  baseline={baseline.score} → peak={peak.score} → floor={scores[-1]}")
