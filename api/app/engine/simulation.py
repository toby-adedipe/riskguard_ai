from typing import List

def run_pre_action_simulation(incident_id: str, action_ids: List[str]) -> dict:
    return {
        "incident_id": incident_id,
        "do_nothing_curve": [87, 87, 87, 87],
        "actions": [
            {"action_id": aid, "projected_score_curve": [70, 65, 60, 55], "confidence": 0.6, "time_to_effect_minutes": 10}
            for aid in action_ids
        ],
    }
