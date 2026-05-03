from __future__ import annotations

from fixtures import IKEJA_FIXTURES

try:
    from output.lga_map import (
        get_lga_for_tower,
        get_city_for_tower,
        CITY_TO_LGAS,
        TOWER_PREFIX_TO_CITY,
    )
    _LGA_MAP_READY = True
except ImportError:
    _LGA_MAP_READY = False
    print("WARN: output/lga_map.py not found — run build_lga_map.py first")


class EntityResolver:
    def __init__(self) -> None:
        self._fixture_sites: set[str] = set(IKEJA_FIXTURES["bts_sites"])
        self._fixture_lga: str = IKEJA_FIXTURES["lga_id"]          # "IKEJA"
        self._fixture_city: str = "Lagos"

    def resolve_lga(self, site_id: str) -> str:
        """Maps site_id (tower_id) → lga_id."""
        if site_id in self._fixture_sites:
            return self._fixture_lga
        if not _LGA_MAP_READY:
            return "UNKNOWN"
        return get_lga_for_tower(site_id)

    def resolve_city(self, site_id: str) -> str:
        """Maps site_id → city name."""
        if site_id in self._fixture_sites:
            return self._fixture_city
        if not _LGA_MAP_READY:
            return "UNKNOWN"
        return get_city_for_tower(site_id)

    def resolve_cluster(self, lga_id: str) -> str:
        """Returns the cluster ID for an LGA. Ikeja → LAGOS_CENTRAL."""
        if lga_id == self._fixture_lga:
            return IKEJA_FIXTURES["cluster_id"]
        if not _LGA_MAP_READY:
            return "UNKNOWN"
        city = self._lga_to_city(lga_id)
        return f"{city.upper().replace(' ', '_')}_CLUSTER"

    def sites_for_lga(self, lga_id: str) -> list[str]:
        """Returns known site_ids for a given lga_id."""
        if lga_id == self._fixture_lga:
            return IKEJA_FIXTURES["bts_sites"]
        if not _LGA_MAP_READY:
            return []
        prefix = self._lga_to_prefix(lga_id)
        if not prefix:
            return []
        city  = TOWER_PREFIX_TO_CITY.get(prefix, "")
        lgas  = CITY_TO_LGAS.get(city, [])
        if lga_id not in lgas:
            return []
        idx = lgas.index(lga_id)
        # Deterministic: same as get_lga_for_tower — tower number % len(lgas) == idx
        return [f"{prefix}-{str(i).zfill(4)}" for i in range(idx, 9999, len(lgas))][:8]

    # ------------------------------------------------------------------ helpers

    def _lga_to_city(self, lga_id: str) -> str:
        if not _LGA_MAP_READY:
            return ""
        for city, lgas in CITY_TO_LGAS.items():
            if lga_id in lgas:
                return city
        return ""

    def _lga_to_prefix(self, lga_id: str) -> str | None:
        if not _LGA_MAP_READY:
            return None
        for prefix, city in TOWER_PREFIX_TO_CITY.items():
            if lga_id in CITY_TO_LGAS.get(city, []):
                return prefix
        return None
