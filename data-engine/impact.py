from __future__ import annotations

from data_engine.schemas import Incident
from data_engine.fixtures import IKEJA_FIXTURES


class IncidentImpactBuilder:
    def __init__(self, fixtures: dict = IKEJA_FIXTURES) -> None:
        ...

    def build(self, incident_id: str) -> Incident:
        """
        Returns a fully populated Incident for the given incident_id.
        All 6 load-bearing demo numbers come from IKEJA_FIXTURES.
        """
        ...
