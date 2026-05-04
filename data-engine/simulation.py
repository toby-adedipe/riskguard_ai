from __future__ import annotations

from trajectories import PRE_ACTION_CURVES


def run_pre_action_simulation(
    incident_id: str,
    action_ids: list[str],
) -> dict[str, list[tuple[int, float]]]:
    """
    Returns score-over-time projection curves for each requested action
    plus the do_nothing baseline.

    Output format:
        {
            "do_nothing":      [(0, 87), (5, 89), (10, 91), ...],
            "traffic_reroute": [(0, 87), (5, 83), (10, 78), ...],
            ...
        }

    Each step = 5 minutes. 12 steps = 1 hour total.
    do_nothing curve is always >= every action curve at every step.
    """
    result: dict[str, list[tuple[int, float]]] = {}

    # Always include do_nothing
    keys = ["do_nothing"] + [a for a in action_ids if a != "do_nothing"]

    for action_id in keys:
        curve = PRE_ACTION_CURVES.get(action_id)
        if curve is None:
            continue
        result[action_id] = [(i * 5, score) for i, score in enumerate(curve)]

    return result
