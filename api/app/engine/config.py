"""Configuration for the deterministic feature and risk engines.

The values are deliberately plain data.  A caller can tune them for a replay
without changing the algorithms, and every term remains inspectable in an
audit or test.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FeatureEngineConfig:
    """Controls robust per-series feature extraction."""

    window_size: int = 30
    window_minutes: int = 30
    min_baseline_samples: int = 5
    robust_z_scale: float = 0.6745
    z_max: float = 6.0
    evidence_threshold: float = 0.4
    absolute_dispersion_floor: float = 1e-6
    relative_dispersion_floor: float = 0.01

    def __post_init__(self) -> None:
        if self.window_size < 2:
            raise ValueError("window_size must be at least 2")
        if not 1 <= self.min_baseline_samples < self.window_size:
            raise ValueError(
                "min_baseline_samples must be at least 1 and smaller than window_size"
            )
        if self.window_minutes < 1:
            raise ValueError("window_minutes must be positive")
        if self.robust_z_scale <= 0:
            raise ValueError("robust_z_scale must be positive")
        if self.z_max <= 0:
            raise ValueError("z_max must be positive")
        if not 0 <= self.evidence_threshold <= 1:
            raise ValueError("evidence_threshold must be between 0 and 1")
        if self.absolute_dispersion_floor <= 0:
            raise ValueError("absolute_dispersion_floor must be positive")
        if self.relative_dispersion_floor < 0:
            raise ValueError("relative_dispersion_floor cannot be negative")


@dataclass(frozen=True, slots=True)
class RiskScoringConfig:
    """Controls transparent rank-weighted aggregation of feature anomalies."""

    top_k: int = 5
    contributor_weights: tuple[float, ...] = (1.0, 0.85, 0.7, 0.55, 0.4)
    amber_threshold: float = 40.0
    red_threshold: float = 70.0
    confidence_sample_target: int = 30

    def __post_init__(self) -> None:
        if self.top_k < 1:
            raise ValueError("top_k must be positive")
        if len(self.contributor_weights) < self.top_k:
            raise ValueError("contributor_weights must provide at least top_k entries")
        if any(weight <= 0 for weight in self.contributor_weights[: self.top_k]):
            raise ValueError("contributor_weights must be positive")
        if not 0 <= self.amber_threshold < self.red_threshold <= 100:
            raise ValueError(
                "severity thresholds must satisfy 0 <= amber < red <= 100"
            )
        if self.confidence_sample_target < 1:
            raise ValueError("confidence_sample_target must be positive")

