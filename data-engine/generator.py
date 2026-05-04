from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Literal

from schemas import SignalEvent
from fixtures import (
    IKEJA_FIXTURES,
    IKEJA_INCIDENT_Z_SCORES,
    DOMAIN_WEIGHTS,
    CALIBRATION_FACTOR,
)
from trajectories import (
    IKEJA_BASELINE_SCORE,
    IKEJA_INCIDENT_TRAJECTORY,
    IKEJA_RECOVERY_TRAJECTORY,
)

# Baseline LGAs that stay green during the demo — cosmetic variation only
_BASELINE_LGAS: list[dict] = [
    {"lga_id": "SURULERE",  "cluster_id": "LAGOS_SOUTH",    "site_id": "LAG-0021"},
    {"lga_id": "MAINLAND",  "cluster_id": "LAGOS_CENTRAL",  "site_id": "LAG-0042"},
    {"lga_id": "ALIMOSHO",  "cluster_id": "LAGOS_WEST",     "site_id": "LAG-0063"},
]

# Baseline z-scores per domain for non-incident LGAs (cosmetic — keeps map green)
_BASELINE_Z_SCORES: dict[str, float] = {
    "network":        0.4,
    "bts":            0.3,
    "complaints":     0.5,
    "billing":        0.2,
    "recharge":       0.3,
    "device_sessions":0.2,
}

# Metric name emitted per domain (what the normalizer sees)
_DOMAIN_METRIC: dict[str, str] = {
    "network":        "packet_loss_pct",
    "bts":            "power_draw_watts",
    "complaints":     "ticket_volume_per_hr",
    "billing":        "failed_charging_pct",
    "recharge":       "failed_topup_pct",
    "device_sessions":"session_failure_pct",
}

Mode = Literal["baseline", "incident", "recovery"]


class SyntheticEventGenerator:
    """
    Drives all four simulation modes on a background thread (5-second tick).

    Modes:
      baseline  — all LGAs emit low z-score events (score 10–25)
      incident  — Ikeja emits IKEJA_INCIDENT_Z_SCORES; score climbs to 87
      recovery  — Ikeja z-scores decay along IKEJA_RECOVERY_TRAJECTORY
      (reset)   — hard reset back to baseline, thread restarts

    The generator writes SignalEvents through two interfaces:
      normalizer          — converts raw dict → SignalEvent
      signal_event_repo   — persists SignalEvent (Engineer 2's interface)

    It also exposes the current RiskScore for Ikeja via score_repo so
    Engineer 2's SimulationController can read it on each poll.
    """

    def __init__(self, normalizer, signal_event_repo, risk_score_repo=None) -> None:
        self._normalizer         = normalizer
        self._signal_event_repo  = signal_event_repo
        self._risk_score_repo    = risk_score_repo   # optional until Eng 2 provides it

        self._mode: Mode         = "baseline"
        self._tick_index: int    = 0
        self._ikeja_tick: int    = 0   # separate counter for Ikeja trajectory

        self._stop_event         = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock               = threading.Lock()

    # ------------------------------------------------------------------ public

    def start(self) -> None:
        """Begins emitting baseline events on a background thread."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def trigger_ikeja(self) -> None:
        """Switches Ikeja to incident mode."""
        with self._lock:
            self._mode       = "incident"
            self._ikeja_tick = 0

    def enter_recovery(self) -> None:
        """Switches Ikeja to recovery mode."""
        with self._lock:
            self._mode       = "recovery"
            self._ikeja_tick = 0

    def reset(self) -> None:
        """Hard reset — stops thread, clears state, restarts at baseline."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)
        with self._lock:
            self._mode       = "baseline"
            self._tick_index = 0
            self._ikeja_tick = 0
        self.start()

    # ------------------------------------------------------------------ internal

    def _run(self) -> None:
        import time
        while not self._stop_event.is_set():
            self._tick()
            self._stop_event.wait(timeout=5)   # 5-second tick

    def _tick(self) -> None:
        with self._lock:
            mode       = self._mode
            tick_index = self._tick_index
            ikeja_tick = self._ikeja_tick
            self._tick_index += 1
            if mode in ("incident", "recovery"):
                self._ikeja_tick += 1

        # Emit baseline events for all non-Ikeja LGAs
        for lga in _BASELINE_LGAS:
            for domain in DOMAIN_WEIGHTS:
                event = self._make_event(
                    lga_id     = lga["lga_id"],
                    cluster_id = lga["cluster_id"],
                    site_id    = lga["site_id"],
                    domain     = domain,
                    z_score    = _BASELINE_Z_SCORES[domain],
                    mode       = "baseline",
                    tick_index = tick_index,
                )
                self._emit(event)

        # Emit Ikeja events based on current mode
        ikeja_events = self._ikeja_events(mode, ikeja_tick, tick_index)
        for event in ikeja_events:
            self._emit(event)

    def _ikeja_events(
        self, mode: Mode, ikeja_tick: int, tick_index: int
    ) -> list[SignalEvent]:
        events = []
        sites  = IKEJA_FIXTURES["bts_sites"]

        if mode == "baseline":
            for site_id in sites:
                for domain in DOMAIN_WEIGHTS:
                    events.append(self._make_event(
                        lga_id     = IKEJA_FIXTURES["lga_id"],
                        cluster_id = IKEJA_FIXTURES["cluster_id"],
                        site_id    = site_id,
                        domain     = domain,
                        z_score    = _BASELINE_Z_SCORES[domain],
                        mode       = "baseline",
                        tick_index = tick_index,
                    ))

        elif mode == "incident":
            # Use hardcoded incident z-scores — deterministic, no RNG
            traj_idx = min(ikeja_tick, len(IKEJA_INCIDENT_TRAJECTORY) - 1)
            # Scale z-scores proportionally to trajectory progress
            progress = IKEJA_INCIDENT_TRAJECTORY[traj_idx] / IKEJA_FIXTURES["peak_score"]
            for site_id in IKEJA_FIXTURES["unstable_sites"]:
                for domain, peak_z in IKEJA_INCIDENT_Z_SCORES.items():
                    events.append(self._make_event(
                        lga_id     = IKEJA_FIXTURES["lga_id"],
                        cluster_id = IKEJA_FIXTURES["cluster_id"],
                        site_id    = site_id,
                        domain     = domain,
                        z_score    = round(peak_z * progress, 3),
                        mode       = "incident",
                        tick_index = tick_index,
                    ))
            # Stable site stays at baseline
            stable_site = sites[-1]   # BTS_IKEJA_008
            for domain in DOMAIN_WEIGHTS:
                events.append(self._make_event(
                    lga_id     = IKEJA_FIXTURES["lga_id"],
                    cluster_id = IKEJA_FIXTURES["cluster_id"],
                    site_id    = stable_site,
                    domain     = domain,
                    z_score    = _BASELINE_Z_SCORES[domain],
                    mode       = "incident",
                    tick_index = tick_index,
                ))

        elif mode == "recovery":
            traj_idx      = min(ikeja_tick, len(IKEJA_RECOVERY_TRAJECTORY) - 1)
            current_score = IKEJA_RECOVERY_TRAJECTORY[traj_idx]
            progress      = current_score / IKEJA_FIXTURES["peak_score"]
            for site_id in sites:
                for domain, peak_z in IKEJA_INCIDENT_Z_SCORES.items():
                    events.append(self._make_event(
                        lga_id     = IKEJA_FIXTURES["lga_id"],
                        cluster_id = IKEJA_FIXTURES["cluster_id"],
                        site_id    = site_id,
                        domain     = domain,
                        z_score    = round(peak_z * progress, 3),
                        mode       = "recovery",
                        tick_index = tick_index,
                    ))

        return events

    def _make_event(
        self,
        lga_id: str,
        cluster_id: str,
        site_id: str,
        domain: str,
        z_score: float,
        mode: Mode,
        tick_index: int,
    ) -> SignalEvent:
        """
        Builds a SignalEvent directly without going through the normalizer.
        z_score is set explicitly — the generator owns the z-score in incident/recovery.
        baseline_mean and baseline_std are retrieved from the normalizer's baselines.
        """
        city         = self._normalizer._resolver.resolve_city(site_id)
        mean, std    = self._normalizer._lookup_baseline(city, domain, _DOMAIN_METRIC[domain])
        value        = mean + z_score * (std or 1.0)

        return SignalEvent(
            event_id        = f"EVT-{tick_index:06d}-{site_id}-{domain}",
            lga_id          = lga_id,
            cluster_id      = cluster_id,
            site_id         = site_id,
            domain          = domain,
            metric_name     = _DOMAIN_METRIC[domain],
            value           = round(value, 4),
            baseline_mean   = mean,
            baseline_std    = std,
            z_score         = z_score,
            timestamp       = datetime.now(timezone.utc),
            mode            = mode,
        )

    def _emit(self, event: SignalEvent) -> None:
        """Writes event to repo. Swallowed exceptions protect the tick loop."""
        try:
            self._signal_event_repo.append(event)
        except Exception as exc:
            print(f"WARN generator emit failed: {exc}")
