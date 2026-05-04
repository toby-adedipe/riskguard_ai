# Engineer 2 Integration Guide
> Data & Risk Engine → API Layer · Favour → Ladipo

---

## Setup

Add `data-engine/` to your Python path or copy engine files into `api/app/engine/`.

```python
import sys
sys.path.insert(0, "data-engine/")
```

---

## What to Import

```python
from generator import SyntheticEventGenerator
from scoring   import RiskScoringEngine
from features  import FeatureEngine
from normalizer import EventNormalizer
from resolver  import EntityResolver
from impact    import IncidentImpactBuilder
from recovery  import RecoveryModel
from simulation import run_pre_action_simulation
from schemas   import SignalEvent, RiskScore, Incident
from repos     import DictSignalEventRepo, DictRiskScoreRepo, DictIncidentRepo
```

---

## Wire-Up (do this once at app startup)

```python
resolver   = EntityResolver()
normalizer = EventNormalizer(resolver, baseline_stats={})
features   = FeatureEngine(window_size=3)
scoring    = RiskScoringEngine(features)

sig_repo   = DictSignalEventRepo()   # swap with your impl when ready
score_repo = DictRiskScoreRepo()
inc_repo   = DictIncidentRepo()

generator  = SyntheticEventGenerator(normalizer, sig_repo, score_repo)
generator.start()                    # starts background thread immediately
```

---

## Your Endpoints → My Methods

| Your Endpoint | Call |
|---|---|
| `POST /simulation/start` | `generator.start()` |
| `POST /simulation/trigger` | `generator.trigger_ikeja()` |
| `POST /actions/approve` | `generator.enter_recovery()` then `RecoveryModel(incident_id).tick()` on each poll |
| `POST /simulation/reset` | `generator.reset()` |
| `POST /actions/simulate` | `run_pre_action_simulation(incident_id, action_ids)` |
| `GET /risk/map` (poll) | `scoring.score("IKEJA")` → returns `RiskScore` |
| `GET /incidents/{id}` | `IncidentImpactBuilder().build(incident_id)` → returns `Incident` |

---

## Repository Interfaces You Must Implement

Replace the `Dict*` stubs with your own — just satisfy these signatures:

```python
class SignalEventRepository(Protocol):
    def append(self, event: SignalEvent) -> None: ...

class RiskScoreRepository(Protocol):
    def upsert(self, score: RiskScore) -> None: ...
    def get(self, lga_id: str) -> RiskScore | None: ...

class IncidentRepository(Protocol):
    def upsert(self, incident: Incident) -> None: ...
    def get(self, incident_id: str) -> Incident | None: ...
    def set_phase(self, incident_id: str, phase: str) -> None: ...
```

---

## Recovery Flow (after approval)

```python
model = RecoveryModel("INC-2025-0502-IKEJA-001")

# Call on every 5-second poll until model.is_complete
score = model.tick()          # RiskScore, starts 87 → floors at 42 by tick 12
inc_repo.set_phase(incident_id, "recovery")
score_repo.upsert(score)
```

---

## Demo Numbers (never change these)

| Fact | Value |
|---|---|
| Peak risk score | **87** |
| Time to breach | **47 minutes** |
| Subscribers affected | **18,420** |
| Enterprise lines | **312** |
| Revenue at risk | **NGN 8,700,000** |
| NCC compensation exposure | **NGN 2,100,000** |
| Recovery floor | **42** |

---

## Verify Integration

```bash
cd data-engine/
python3 -m pytest tests/test_smoke.py -v   # all 10 must pass
```
