from __future__ import annotations

from data_engine.trajectories import PRE_ACTION_CURVES


def run_pre_action_simulation(
    incident_id: str,
    action_ids: list[str],
) -> dict[str, list[tuple[int, float]]]:
    """
    Returns score-over-time curves for each action + do_nothing baseline.
    Output: {action_id: [(minute_offset, score), ...], "do_nothing": [...]}
    Each curve has 12 data points (1 hour at 5-min intervals).
    do_nothing curve is always ≥ any action curve at every step.
    """
    ...
