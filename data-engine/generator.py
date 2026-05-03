from __future__ import annotations

from data_engine.schemas import SignalEvent


class SyntheticEventGenerator:
    def __init__(self, normalizer, signal_event_repo) -> None:
        ...

    def start(self) -> None:
        """Begins emitting baseline events for all LGAs on a background thread (5s tick)."""
        ...

    def trigger_ikeja(self) -> None:
        """Switches Ikeja to incident mode; events use INCIDENT z-scores."""
        ...

    def enter_recovery(self) -> None:
        """Switches Ikeja to recovery mode."""
        ...

    def reset(self) -> None:
        """Returns to baseline, clears incident state, restarts cleanly."""
        ...

    def _tick(self) -> None:
        """Single generator tick — emits one SignalEvent per active LGA per domain."""
        ...
