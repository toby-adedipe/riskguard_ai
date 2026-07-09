# Phase 0 spec — replay ingestion + machine-initiated analysis

_Build spec for the team. Turns two pitch claims into real behavior, additively, against the existing `api/app` modules. Scope: 3–5 focused days. See `pitch/mtn-meeting/04-product-roadmap.md` for why this is Phase 0._

> **Status (2026-07-09): north-star implementation spec, not current behavior.**
> The retained `/simulation/*` path loads an explicit presentation fixture so
> the `dev` frontend remains usable. It is not replay ingestion, detection, or
> an agent wake-up. Those capabilities begin with the modules defined below.

## 1. Goal

Two deliverables:

- **A — Replay adapter + real detection.** Ingest a file of incident telemetry (CSV/JSONL), normalize to `SignalEvent`, run a genuine (simple, data-driven) detector that writes `RiskScore` and opens an `Incident` with computed `IncidentImpact`. Feeding a *different* file must produce a *different, sensible* result — no hardcoded 87.
- **B — Machine-initiated analysis handoff.** When detection opens an
  incident, it emits a durable `IncidentOpened` event. A connected W1/W2 agent
  runtime consumes that event and persists grounded responses without a human
  query. Until that runtime exists, analysis remains explicitly pending; Phase
  0 must not synthesize role responses to make the flow look complete.

Deliverable A makes *"send us any past incident export and we'll show you your
own outage in RiskGuard"* true. Deliverable B establishes the unprompted handoff;
*"it listens and concludes on its own"* becomes true only when the real W1/W2
runtime consumes that event. The interim UI must show analysis as unavailable.

## 2. Reality check (what exists today in `api/app`)

- **Contracts are retained** in `app/core/schemas.py`: `SignalEvent`,
  `FeatureWindow`, `SignalEvidence`, `RiskScore`, `Incident`,
  `IncidentImpact`, `AuditLogEntry`, and the grounded `AgentResponse`. Build
  against these seams; evolve them deliberately instead of redefining them in
  an engine module.
- **The active dashboard is fixture-backed.** `demo_data/` contains the Ikeja
  presentation scenario, and `simulation/services.py` loads it into the risk
  and incident repositories. That proves API/UI integration only; it is not a
  detector, replay source, or calibrated model.
- **W0 is a conformance spike.** The copilot package composes prompts, requests
  strict provider output, extracts a grounded response, and writes a
  transcript. It does not execute a model-driven tool loop. The interactive
  query endpoint intentionally returns `503`.
- **There is no production engine.** No active module converts arbitrary
  telemetry into features, correlated incidents, or automatic agent wake-ups.
- **Repositories are currently process-local singletons.** Phase 0 may reuse
  them for the first replay slice, but must keep ingestion, engine, and HTTP
  boundaries explicit so persistence can be replaced later.

Implication: Phase 0 replaces the fixture as the source of risk and incident
state; it does not extend the retired deterministic runtime.

## 3. Deliverable A — replay ingestion + detection

### 3.1 New: `app/engine/` (pure risk math, no FastAPI)
Framework-free library the ingestion service calls. Keeps the blueprint boundary ("risk math never imports controllers").

```
app/engine/
  __init__.py
  polarity.py     # KPI -> "higher_is_worse" | "lower_is_worse"
  features.py     # rolling window per (lga_id, kpi) -> FeatureWindow + SignalEvidence
  scoring.py      # FeatureWindows for an LGA -> RiskScore (0-100, severity, ttb)
  impact.py       # Incident + IncidentImpact from lga_profile fixture
  classify.py     # NCC major-outage rulepack -> {is_major, thresholds_hit, reasons}
  config.py       # window size, severity thresholds, Z_MAX, breach line
```

**`features.py`** — maintain a rolling window (deque of last `N` samples, default N=30) per `(lga_id, kpi)`. On each `SignalEvent`:
- `rolling_mean`, `rolling_stddev` over the window; `z = (value - mean) / max(stddev, eps)`.
- `delta_pct` from `baseline_value` if present, else vs `rolling_mean`.
- Apply polarity: anomaly only in the harmful direction (availability/success ↓ is bad; drop-call/failure/congestion/complaints ↑ is bad).
- `anomaly_score = min(1.0, abs(z) / Z_MAX)` (Z_MAX≈6), zeroed if the deviation is in the benign direction.
- Emit a `FeatureWindow` and a `SignalEvidence` (carry `evidence_id` from the event; `summary` = human line like "cell availability 71% vs 99% baseline (z=-5.2)"). Persist evidence (see 3.3).

**`scoring.py`** — per LGA, aggregate current `FeatureWindow.anomaly_score` across domains/kpis (weighted mean of the top-k contributors, k=5). Map to `RiskScore.score` 0–100. Severity: green `<40`, amber `40–70`, red `>70` (from `config.py`). `confidence` from total `sample_count`. `time_to_breach_minutes`: linear extrapolation of the score's recent slope to the red line; `None` if flat/falling.

**`impact.py`** — reads an `lga_profile` fixture (`lga_id -> {subscribers, enterprise_lines, arpu_daily_ngn, sites}`). When an incident opens, compute `IncidentImpact`:
- `affected_subscribers = round(subscribers * degradation_fraction)` where degradation_fraction derives from the worst availability KPI.
- `revenue_at_risk_ngn = affected_subscribers * arpu_daily_ngn * outage_hours/24`.
- `compensation_exposure_ngn` per NCC airtime-credit logic: `affected_subscribers * avg_daily_spend * credit_days` (document the assumed formula in code).
- `cause` inferred from the top contributing `(domain, kpi)` (e.g. transport/`cell_availability_pct` → "backbone/transport degradation").
Every number is a function of inputs. Keep the formula transparent and commented.

**`classify.py`** — NCC rulepack as data: major-outage if `affected_subscribers/total >= 0.05` OR `distinct_affected_lgas >= 5` OR `affected_sites >= 100` (config-driven thresholds). Return `{is_major, thresholds_hit[], reasons[]}`. This is the first regulator rulepack; structure it so a second (NERC/CBN) is a new data file, not new code.

### 3.2 New: `app/modules/ingestion/` (adapter plane)
```
app/modules/ingestion/
  __init__.py
  source.py       # SignalSource protocol: def stream() -> Iterator[SignalEvent]
  replay.py       # ReplaySource(path, mapping): file rows -> SignalEvent
  mapping.py      # column-mapping config (customer CSV columns -> SignalEvent fields)
  service.py      # IngestionService.run(source): drive detection + persistence + event
  routes.py       # POST /ingestion/replay, GET /ingestion/status
  schemas.py      # ReplayRequest, IngestionStatus
  db.py           # IngestionStateRepository (progress/status), singleton
```

`SignalSource` is the seam that lets a live Kafka/webhook feed replace the file later with no change downstream:
```python
class SignalSource(Protocol):
    def stream(self) -> Iterator[SignalEvent]: ...
```

`IngestionService.run(source)` pseudocode:
```
for event in source.stream():
    evidence, feature = engine.features.update(event)      # updates rolling state
    evidence_repo.add(evidence)
    score = engine.scoring.score_lga(event.lga_id)
    risk_repo.upsert(score)                                  # existing singleton
    if score.severity == "red" and not incidents_repo.open_for(event.lga_id):
        incident = engine.impact.open_incident(event.lga_id, lga_profile)
        incidents_repo.upsert(incident)                      # existing singleton
        events.emit(IncidentOpened(incident.incident_id))    # -> Deliverable B
    elif recovered(score) and incidents_repo.open_for(event.lga_id):
        incidents_repo.set_phase(incident_id, "recovery")
```
Replay may run synchronously (fast, bounded file) or paced (sleep between timestamps) via a `speed` param so the UI shows the curve build. Start synchronous; add pacing only if the demo needs it.

### 3.3 New evidence store
Add `app/modules/evidence/db.py` with `EvidenceRepository` (singleton, `add`/`get`/`list_for_lga`) so agent facts can resolve `evidence_id`. `SignalEvidence` already exists in `core/schemas.py`.

### 3.4 Endpoints
- `POST /ingestion/replay` — body `{fixture: "ikeja_fibre_cut"}` or an uploaded file; starts a run, returns run id.
- `GET /ingestion/status` — `{state, events_processed, incidents_opened}`.
Wire both routers in `app/__init__.py` (alongside the existing `include_router` calls).

## 4. Deliverable B — machine-initiated grounded analysis

### 4.1 Event seam (no import cycle)
Add `app/core/events.py` — a tiny synchronous in-process publisher: `subscribe(event_type, handler)`, `emit(event)`. Ingestion depends only on `core.events`, never on copilot. At app startup in `create_app()`, register the orchestrator as a subscriber to `IncidentOpened`. This keeps the dependency arrow ingestion → core ← copilot.

### 4.2 Define the runtime handoff
Add a narrow port behind the event seam; do not restore the retired
`copilot/services.py` runtime or implement a fixed role playbook:
```python
class IncidentAnalysisRuntime(Protocol):
    def start_for_incident(self, incident_id: str) -> str: ...  # run id
```
The Phase-0 handler may persist `pending_runtime` with the incident and event
ids, but it does not emit `AgentResponse`. W1/W2 supplies the real budgeted
model-to-tool loop described in `AGENT_PRODUCT_PLAN.md`; the claim validator
then gates every fact against the evidence repository before a response is
persisted. Runtime availability changes status, never the detector outcome.

### 4.3 Read path
Add to the `incidents` module: `GET /incidents/{incident_id}/analysis`. Before
W1/W2 is connected it returns an explicit `pending_runtime` status and no
conclusions. After connection it returns the run status plus validated
`AgentResponse` records. Keep `POST /copilot/query` disabled until the same
runtime supports grounded drill-down.

## 5. The ingestion file format (the "send us your incident export" contract)

Document this in `app/modules/ingestion/mapping.py` and a short `docs/INGESTION_FORMAT.md`. Minimum columns:

| column | required | maps to |
|---|---|---|
| `timestamp` | yes | `SignalEvent.timestamp` (ISO 8601) |
| `lga_id` (or region key) | yes | `SignalEvent.lga_id` |
| `domain` | yes | `SignalEvent.domain` |
| `kpi` | yes | `SignalEvent.kpi` |
| `value` | yes | `SignalEvent.value` |
| `baseline_value` | no | `SignalEvent.baseline_value` |
| `site_id`/`bts_id`/... | no | `SignalEvent.dimensions.*` |
| `source_system` | no | `SignalEvent.source_system` |

`mapping.py` holds a `{customer_column -> signal_field}` dict so a real MTN/Airtel export maps without code changes. Unknown KPIs are rejected with a clear error listing the accepted `SignalKpi` values.

## 6. Fixtures (`app/demo_data/`)
- `lga_profile.json` — per-LGA subscribers/enterprise_lines/arpu/sites (real numbers, one source of truth; fixes the 18,420 vs 145,800 inconsistency by making it data).
- `ikeja_fibre_cut.csv` — the canonical scenario as telemetry, calibrated so detection *derives* a high score (not asserts it).
- `surulere_congestion.csv` — a *different* scenario (different domain/kpi/LGA) to prove the detector generalizes.

## 7. Boundaries & non-goals

**Reuse, don't touch:** `core/schemas.py` contracts; existing `risk`/`incidents` repo singletons; existing `/risk/map` and `/incidents/{id}` endpoints.
**Do not:** put risk math in `app/modules/*/routes.py`; hard-import copilot from ingestion; add a `utils`/`common` catch-all; introduce ML libs (Isolation Forest/SHAP) or SK/Azure/LLM; add auth, a real DB, or websockets. All explicitly deferred (YAGNI / Phase 1+).

## 8. Task breakdown (ordered, assignable)
0. Run `scan_architecture.py --mode pre` (done — baseline captured).
1. `engine/polarity.py` + `engine/config.py` + unit tests for polarity.
2. `engine/features.py` (rolling window → FeatureWindow + SignalEvidence) + tests.
3. `engine/scoring.py` (LGA score, severity, ttb) + tests.
4. `evidence` repo; wire features to persist evidence.
5. `engine/impact.py` + `engine/classify.py` + `lga_profile.json` + tests (numbers derive from inputs).
6. `ingestion` module: `source.py`, `replay.py`, `mapping.py`, `service.py`, `db.py`, `routes.py`, `schemas.py`; wire router.
7. `core/events.py`; emit `IncidentOpened` from ingestion.
8. `copilot/orchestrator.py` + claim validator + `AgentRunRepository`; subscribe in `create_app()`.
9. `GET /incidents/{id}/analysis`; keep `/copilot/query`.
10. Two fixtures; end-to-end run of each.
11. Frontend (separate track): replace "Trigger Ikeja" with "Start replay"; poll `/incidents/{id}/analysis`; render the auto-conclusion.
12. Run `scan_architecture.py --mode post`; review the diff against this plan.

## 9. Definition of done
- `POST /ingestion/replay {fixture: "ikeja_fibre_cut"}` → `/risk/map` shows a derived red score for Ikeja; `/incidents/{id}` returns computed impact.
- Running `surulere_congestion` instead yields a **different** LGA, cause, and exposure — proving no hardcoding.
- Within the same run, `GET /incidents/{id}/analysis` returns non-empty `AgentResponse`s that were produced **without any `/copilot/query` call**, and **every `fact.evidence_id` resolves** in `EvidenceRepository`; a fabricated-claim unit test is rejected by the validator.
- `engine/` imports no FastAPI; ingestion imports no copilot.
- `pre`/`post` architecture scans reviewed; no new large-file or catch-all smells.

## 10. Why this is the right first build
It is pipeline-independent: it upgrades the demo for MTN *and* makes "send us one incident export" a real, near-zero-integration offer for Airtel, IHS, a DisCo, or a bank — the Ring-1 pipeline from the roadmap. It attacks the two cheapest high-leverage gaps (replay, real classification) and the highest-narrative one (autonomy), and it defers the expensive moat (real detection ML) to Phase 1 without blocking the sales motion.
