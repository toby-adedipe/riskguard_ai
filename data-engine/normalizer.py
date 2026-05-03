from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from schemas import SignalEvent
from resolver import EntityResolver


class EventNormalizer:
    """
    Converts raw event dicts → SignalEvent with z_score.

    z_score = (value - baseline_mean) / baseline_std

    Baseline stats are keyed by city (from calibration.py) because
    all 9 datasets use city-level granularity. LGA is resolved via
    EntityResolver and carried on the SignalEvent for downstream use.
    """

    def __init__(self, resolver: EntityResolver, baseline_stats: dict) -> None:
        self._resolver  = resolver
        self._baselines = baseline_stats  # {city: {domain: {metric: {mean, std}}}}

    def normalize(self, raw: dict) -> SignalEvent:
        """
        raw dict must contain:
          site_id, domain, metric_name, value, mode
        optional:
          event_id, timestamp
        """
        site_id     = raw["site_id"]
        domain      = raw["domain"]
        metric_name = raw["metric_name"]
        value       = float(raw["value"])
        mode        = raw.get("mode", "baseline")

        lga_id      = self._resolver.resolve_lga(site_id)
        city        = self._resolver.resolve_city(site_id)
        cluster_id  = self._resolver.resolve_cluster(lga_id)

        baseline_mean, baseline_std = self._lookup_baseline(city, domain, metric_name)
        z_score = (value - baseline_mean) / (baseline_std or 1.0)

        return SignalEvent(
            event_id        = raw.get("event_id", str(uuid.uuid4())),
            lga_id          = lga_id,
            cluster_id      = cluster_id,
            site_id         = site_id,
            domain          = domain,
            metric_name     = metric_name,
            value           = value,
            baseline_mean   = baseline_mean,
            baseline_std    = baseline_std,
            z_score         = round(z_score, 3),
            timestamp       = raw.get("timestamp", datetime.now(timezone.utc)),
            mode            = mode,
        )

    def _lookup_baseline(
        self, city: str, domain: str, metric_name: str
    ) -> tuple[float, float]:
        """Returns (mean, std) from calibration, falling back to safe defaults."""
        city_stats   = self._baselines.get(city, {})
        domain_stats = city_stats.get(domain, {})
        metric_stats = domain_stats.get(metric_name, {})
        mean = float(metric_stats.get("mean", 0.0))
        std  = float(metric_stats.get("std",  1.0))
        return mean, std
