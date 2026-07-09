"""Robust rolling feature extraction for canonical signal events."""

from __future__ import annotations

from collections import defaultdict, deque
from hashlib import sha256
from statistics import median
from typing import TypeAlias

from app.core.schemas import FeatureWindow, SignalEvidence, SignalEvent
from app.engine.config import FeatureEngineConfig
from app.engine.polarity import harmful_z_score


SeriesKey: TypeAlias = tuple[str, str]


class FeatureEngine:
    """Maintain prior-only robust baselines for each ``(lga_id, kpi)``.

    State is intentionally process-local in Phase 0A.  The engine neither
    persists results nor knows about API/application services; those concerns
    belong to the caller.
    """

    def __init__(self, config: FeatureEngineConfig | None = None) -> None:
        self.config = config or FeatureEngineConfig()
        self._samples: dict[SeriesKey, deque[float]] = defaultdict(
            lambda: deque(maxlen=self.config.window_size)
        )
        self._latest: dict[SeriesKey, FeatureWindow] = {}

    def update(
        self, event: SignalEvent
    ) -> tuple[FeatureWindow, SignalEvidence | None]:
        """Derive a feature from prior samples, then append the current sample."""

        key = (event.lga_id, event.kpi)
        prior_samples = list(self._samples[key])
        expected_value, dispersion, baseline_method, baseline_ready = (
            self._baseline(event, prior_samples)
        )

        z_score = (
            self.config.robust_z_scale
            * (event.value - expected_value)
            / dispersion
        )
        harmful_z = harmful_z_score(event.kpi, z_score) if baseline_ready else 0.0
        anomaly_score = min(1.0, harmful_z / self.config.z_max)
        delta_pct = _delta_pct(event.value, expected_value)

        evidence = self._build_evidence(
            event=event,
            expected_value=expected_value,
            dispersion=dispersion,
            baseline_method=baseline_method,
            delta_pct=delta_pct,
            z_score=z_score,
            harmful_z=harmful_z,
            anomaly_score=anomaly_score,
        )
        evidence_ids = [evidence.evidence_id] if evidence is not None else []

        feature = FeatureWindow(
            lga_id=event.lga_id,
            domain=event.domain,
            kpi=event.kpi,
            window_minutes=event.sample_window_minutes or self.config.window_minutes,
            current_value=event.value,
            # These legacy fields retain their names for schema compatibility;
            # expected_value/dispersion state the robust semantics explicitly.
            rolling_mean=expected_value,
            rolling_stddev=dispersion,
            z_score=z_score,
            delta_pct=delta_pct,
            anomaly_score=anomaly_score,
            sample_count=min(len(prior_samples) + 1, self.config.window_size),
            time_to_breach_minutes=None,
            evidence_ids=evidence_ids,
            expected_value=expected_value,
            dispersion=dispersion,
            baseline_method=baseline_method,
            harmful_z_score=harmful_z,
            updated_at=event.timestamp,
        )

        self._samples[key].append(event.value)
        self._latest[key] = feature
        return feature, evidence

    def latest_for_lga(self, lga_id: str) -> list[FeatureWindow]:
        """Return one deterministic, latest feature per KPI for an LGA."""

        features = [
            feature
            for (feature_lga_id, _), feature in self._latest.items()
            if feature_lga_id == lga_id
        ]
        return sorted(features, key=lambda item: (item.domain, item.kpi))

    def _baseline(
        self,
        event: SignalEvent,
        prior_samples: list[float],
    ) -> tuple[float, float, str | None, bool]:
        enough_history = len(prior_samples) >= self.config.min_baseline_samples

        if enough_history:
            expected_value = float(median(prior_samples))
            baseline_method = "global_median_mad"
            baseline_ready = True
        elif event.baseline_value is not None:
            expected_value = event.baseline_value
            baseline_method = "provided_baseline"
            baseline_ready = True
        else:
            # Expose an honest warm-up feature without treating a single prior
            # observation as an authoritative baseline.
            expected_value = (
                float(median(prior_samples)) if prior_samples else event.value
            )
            baseline_method = None
            baseline_ready = False

        sample_centre = (
            float(median(prior_samples)) if prior_samples else expected_value
        )
        mad = (
            float(median(abs(value - sample_centre) for value in prior_samples))
            if prior_samples
            else 0.0
        )
        dispersion_floor = max(
            self.config.absolute_dispersion_floor,
            abs(expected_value) * self.config.relative_dispersion_floor,
        )
        dispersion = max(mad, dispersion_floor)
        return expected_value, dispersion, baseline_method, baseline_ready

    def _build_evidence(
        self,
        *,
        event: SignalEvent,
        expected_value: float,
        dispersion: float,
        baseline_method: str | None,
        delta_pct: float,
        z_score: float,
        harmful_z: float,
        anomaly_score: float,
    ) -> SignalEvidence | None:
        if anomaly_score < self.config.evidence_threshold:
            return None

        evidence_id = event.evidence_id or _stable_evidence_id(event)
        direction = "above" if event.value >= expected_value else "below"
        unit = f" {event.unit}" if event.unit else ""
        summary = (
            f"{event.kpi} is {event.value:g}{unit}, {direction} the expected "
            f"{expected_value:g}{unit} (delta {delta_pct:+.2f}%, robust "
            f"z={z_score:+.2f}, anomaly={anomaly_score:.2f})."
        )

        return SignalEvidence(
            evidence_id=evidence_id,
            lga_id=event.lga_id,
            domain=event.domain,
            kpi=event.kpi,
            current_value=event.value,
            baseline_value=expected_value,
            delta_pct=delta_pct,
            expected_value=expected_value,
            dispersion=dispersion,
            baseline_method=baseline_method,
            harmful_z_score=harmful_z,
            anomaly_score=anomaly_score,
            severity_hint=event.severity_hint or _severity_hint(anomaly_score),
            z_score=z_score,
            anomaly_shape=None,
            summary=summary,
            source_system=event.source_system,
            timestamp=event.timestamp,
            related_event_ids=[event.event_id],
            dimensions=event.dimensions,
        )


def _delta_pct(current_value: float, expected_value: float) -> float:
    if expected_value == 0:
        return 0.0
    return ((current_value - expected_value) / abs(expected_value)) * 100


def _stable_evidence_id(event: SignalEvent) -> str:
    identity = f"{event.lga_id}|{event.kpi}|{event.event_id}".encode()
    digest = sha256(identity).hexdigest()[:20]
    return f"evd:{digest}"


def _severity_hint(anomaly_score: float) -> str:
    if anomaly_score >= 0.85:
        return "critical"
    if anomaly_score >= 0.7:
        return "high"
    if anomaly_score >= 0.5:
        return "medium"
    return "low"
