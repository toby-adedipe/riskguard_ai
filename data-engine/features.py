from __future__ import annotations

from collections import deque

from schemas import SignalEvent


class FeatureEngine:
    """
    Maintains a rolling window of SignalEvents per (lga_id, domain).
    Returns the mean z-score across the last `window_size` ticks.

    Window size 3 is sufficient for the demo:
    - Baseline: small z-scores (~0.5–1.5) → score stays green (10–25)
    - Incident: large z-scores (2.9–6.5) → score climbs to 87 within 3 ticks
    - Recovery: z-scores decay along IKEJA_RECOVERY_TRAJECTORY
    """

    def __init__(self, window_size: int = 3) -> None:
        self._window_size = window_size
        # {lga_id: {domain: deque[float]}}
        self._windows: dict[str, dict[str, deque[float]]] = {}

    def ingest(self, event: SignalEvent) -> None:
        """Adds a SignalEvent's z_score to the rolling window for its lga + domain."""
        lga    = event.lga_id
        domain = event.domain

        if lga not in self._windows:
            self._windows[lga] = {}
        if domain not in self._windows[lga]:
            self._windows[lga][domain] = deque(maxlen=self._window_size)

        self._windows[lga][domain].append(event.z_score)

    def get_domain_zscore(self, lga_id: str, domain: str) -> float:
        """
        Returns the mean z-score across the rolling window for a domain in an LGA.
        Returns 0.0 if no events have been ingested yet for that lga + domain.
        """
        try:
            window = self._windows[lga_id][domain]
            if not window:
                return 0.0
            return sum(window) / len(window)
        except KeyError:
            return 0.0

    def override_zscore(self, lga_id: str, domain: str, z_score: float) -> None:
        """
        Directly sets the z-score for an lga + domain, filling the entire window.
        Used by SyntheticEventGenerator to instantly apply IKEJA_INCIDENT_Z_SCORES
        without waiting for the window to fill.
        """
        if lga_id not in self._windows:
            self._windows[lga_id] = {}
        self._windows[lga_id][domain] = deque(
            [z_score] * self._window_size, maxlen=self._window_size
        )

    def reset_lga(self, lga_id: str) -> None:
        """Clears all windows for an LGA. Called on generator reset."""
        self._windows.pop(lga_id, None)

    def snapshot(self, lga_id: str) -> dict[str, float]:
        """Returns current z-score per domain for an LGA. Useful for debugging."""
        if lga_id not in self._windows:
            return {}
        return {
            domain: self.get_domain_zscore(lga_id, domain)
            for domain in self._windows[lga_id]
        }
