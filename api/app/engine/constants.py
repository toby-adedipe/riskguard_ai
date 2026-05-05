"""Bridge to the data-engine constants used by the live demo."""
from __future__ import annotations

import sys
from pathlib import Path

_DATA_ENGINE_DIR = Path(__file__).resolve().parents[3] / "data-engine"
if _DATA_ENGINE_DIR.is_dir() and str(_DATA_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_DATA_ENGINE_DIR))

from fixtures import (  # noqa: E402
    IKEJA_FIXTURES,
    IKEJA_INCIDENT_Z_SCORES,
)
from trajectories import (  # noqa: E402
    IKEJA_INCIDENT_TRAJECTORY,
    PRE_ACTION_CURVES,
)

__all__ = [
    "IKEJA_FIXTURES",
    "IKEJA_INCIDENT_TRAJECTORY",
    "IKEJA_INCIDENT_Z_SCORES",
    "PRE_ACTION_CURVES",
]
