IKEJA_BASELINE_SCORE: float = 15.0

# One value per 5-second tick after trigger_ikeja()
IKEJA_INCIDENT_TRAJECTORY: list[float] = [
    15, 19, 24, 30, 38, 46, 54, 62, 69, 74, 79, 82, 84, 86, 87, 87, 87,
]

# Starts from 87, floors at 42 after enter_recovery()
IKEJA_RECOVERY_TRAJECTORY: list[float] = [
    87, 82, 76, 70, 63, 57, 52, 48, 45, 43, 42, 42, 42,
]

# 12 steps = ~1 hour at 5-min intervals for pre-action simulation
PRE_ACTION_CURVES: dict[str, list[float]] = {
    "do_nothing":      [87, 89, 91, 93, 94, 95, 96, 97, 98, 98, 99, 99],
    "traffic_reroute": [87, 83, 78, 72, 65, 58, 52, 48, 45, 43, 42, 42],
    "field_dispatch":  [87, 85, 82, 79, 75, 70, 64, 58, 52, 47, 44, 43],
    "combined":        [87, 81, 73, 64, 56, 49, 44, 42, 42, 42, 42, 42],
}
