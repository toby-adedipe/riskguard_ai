class EventNormalizer:
    def __init__(self, resolver, baseline_stats: dict | None = None) -> None:
        self.resolver = resolver
        self.baseline_stats = baseline_stats or {}

    def normalize(self, raw_event: dict) -> dict:
        return raw_event
