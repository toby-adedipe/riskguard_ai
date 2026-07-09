# Layer 3 — detection engine spec (real, not theatrical)

_Part of the demo→product bundle. This is the layer that decides, unprompted, that an incident is happening. It is deterministic, explainable, and LLM-free by design — the agents (layer 4) reason **about** what this layer detects; they never detect. See [`AGENT_PRODUCT_PLAN.md`](AGENT_PRODUCT_PLAN.md) §2 and [`PHASE0_REPLAY_AUTONOMY_SPEC.md`](PHASE0_REPLAY_AUTONOMY_SPEC.md) (which scaffolds a simpler version this supersedes at Phase 1)._

## 0. What "as real as possible" means here

The demo detector must produce a **defensible** detection, not a scripted one. Concretely, that means four properties the current MVP does not have:

1. **It survives seasonality.** Telecom KPIs have a daily/weekly shape (busy hour, weekend dips). A naive rolling mean flags every 8pm busy hour as an incident. Real detection is deviation from *the expected value for this hour-of-week*, not from a flat average.
2. **It survives noise.** Real feeds have outliers, gaps, and clock skew. Mean/stddev is not robust to these; we use median/MAD and explicit gap handling.
3. **It distinguishes shapes.** A fibre cut is a cliff; a power rundown is a decay; congestion is a swell. The detector must classify the *shape* of the deviation, because that shape is the single most useful input to the forensics agent's differential.
4. **It correlates.** One fibre cut produces dozens of anomalies across sites and KPIs. Real detection groups them into *one* incident with a known blast radius — it does not open forty incidents.

The honest boundary for the demo: detection runs on **replayed real-shaped telemetry** (historical exports or a high-fidelity synthetic generator that includes seasonality and noise), not a live MTN feed. The math is real; the data source is replay. That is exactly the pilot offer ("send us one incident export") made runnable.

## 1. Pipeline overview

```
SignalEvent stream (per lga_id, domain, kpi)
  → 1. Normalize & buffer (per-series windows, gap/skew handling)
  → 2. Baseline (seasonal expected value + short-term drift)
  → 3. Deviation (robust z via median/MAD, polarity-aware)
  → 4. Shape classification (cliff | decay | swell | spike | flap)
  → 5. Per-KPI anomaly score  → emit FeatureWindow + SignalEvidence
  → 6. Correlation & entity resolution (group anomalies → candidate incident)
  → 7. Spatial aggregation (site → cluster → LGA blast radius)
  → 8. Risk scoring (candidate → RiskScore 0–100, severity, confidence)
  → 9. Time-to-breach projection
  → 10. Incident lifecycle state machine (open/dedup/phase/resolve)
        → on OPEN: emit IncidentOpened (wakes layer 4)
```

Steps 1–5 are per-series and cheap (run on every event). Steps 6–10 run per-LGA on a tick (e.g., every 30–60s of sim time) or on threshold crossing.

## 2. Baseline (step 2)

Per `(lga_id, kpi)` (and where volume allows, per `site_id`):

- **Seasonal expected value** `μ_s(t)` = robust central tendency for the same *hour-of-week* bucket (168 buckets), maintained as a decaying median over prior weeks. Falls back to hour-of-day (24 buckets) when history < 2 weeks, and to a global median when history < 2 days. Replay fixtures must carry ≥ a few days so this is meaningful.
- **Short-term drift** `d(t)` = EWMA of the last N samples (N≈10, half-life ~5 min) to catch slow movement the seasonal profile wouldn't.
- **Expected** `x̂(t) = μ_s(t)` for anomaly detection; `d(t)` used for trend/time-to-breach.
- **Dispersion** `σ_s` = MAD (median absolute deviation) of the same seasonal bucket, floored at a per-KPI minimum to avoid divide-by-near-zero on very stable KPIs.

Rationale: seasonal median + MAD is the standard robust choice for periodic, outlier-prone operational metrics. It is fully explainable ("availability is 71% vs an expected 99% for Tuesday 14:00, a 12σ drop"), which the audit trail and the agents require.

## 3. Deviation & polarity (step 3)

- **Robust z**: `z = 0.6745 · (x − x̂) / σ_s`.
- **Polarity** (per KPI, from a config table): availability/success/attach-success KPIs are *lower-is-worse*; drop-call/congestion/failure/complaint/leakage KPIs are *higher-is-worse*. Only harmful-direction deviations produce anomaly; benign-direction deviations are recorded but score 0.
- **Anomaly score** `a = clamp(|z_harmful| / Z_MAX, 0, 1)`, `Z_MAX≈8`. This is the per-KPI, per-series anomaly in [0,1].

## 4. Shape classification (step 4) — the forensics multiplier

Classify the recent trajectory of each anomalous series into one of:

| Shape | Test | Points to |
|---|---|---|
| **cliff** | step change: drop ≥ K·σ within ≤2 samples (CUSUM step detector fires) | physical break — fibre cut, sudden isolation |
| **decay** | monotonic slope over M samples, no step; half-life estimable | battery/generator rundown — power |
| **swell** | gradual rise then plateau, availability intact | congestion / event load |
| **spike** | single-sample excursion returning to baseline | transient / measurement noise — usually *suppress* |
| **flap** | oscillation crossing threshold ≥3× in window | instability / intermittent fault |

Implementation: a lightweight CUSUM change-point detector per series gives the step/no-step signal; a robust (Theil–Sen) slope over the last M samples gives decay vs swell; excursion counting gives flap. Shape + polarity + domain is what the forensics agent's signature table consumes — so shape must be in the `SignalEvidence.summary` ("cliff: cell_availability 99→71 in 2 min").

## 5. Emit evidence (step 5)

Every anomalous series emits a `SignalEvidence` (canonical schema) carrying: kpi, current vs baseline, delta_pct, z, anomaly_score, **shape**, affected dimension ids, a human `summary`, and a stable `evidence_id`. This is the *only* thing layer 4 agents are allowed to cite. Non-anomalous series emit nothing (keep the evidence store signal-dense).

## 6. Correlation & entity resolution (step 6)

The hard part, and the difference between a real detector and a demo. Group individual anomalies into one candidate incident:

- **Correlation key** = same `lga_id` + spatial adjacency (same cluster, or sites on the same transport corridor / power feeder from `get_topology`) + temporal overlap (anomaly onsets within a window W≈10–15 min).
- Anomalies sharing a correlation key are one candidate incident. A fibre cut's availability cliffs + neighboring congestion swells + lagged complaint spikes collapse into a single object.
- **Lag awareness**: complaints and device-session failures are expected to *follow* network KPIs by 10–20 min; the correlator treats a lagged complaint spike as corroborating, not a new incident.
- **De-dup**: while a candidate is live, new correlated anomalies attach to it (they extend blast radius / evidence) rather than opening new incidents.

## 7. Spatial aggregation (step 7)

Resolve blast radius from the correlated anomaly set: distinct affected sites, clusters, LGAs; whether the affected set matches a corridor (transport), a feeder (power), a single site (equipment), or is diffuse (congestion/cyber/platform). This computed geometry feeds both the risk score (breadth) and the forensics agent.

## 8. Risk scoring (step 8)

Aggregate a candidate incident into a `RiskScore` (0–100) for its LGA:

```
score = 100 · w_sev·S + w_breadth·B + w_persist·P + w_corr·C   (weights sum to 1)
  S = severity: peak harmful anomaly score across the candidate's KPIs
  B = breadth:  affected_sites / lga_total_sites (capped), + enterprise-weighting
  P = persistence: fraction of recent windows the anomaly has held (anti-flap)
  C = corroboration: # independent domains anomalous (network+bts+complaints…)/domains_present
severity band: green <40, amber 40–70, red >70   (configurable, per-tenant)
confidence: rises with P and C, falls with data gaps in the window
```

Every term is a number the agents/audit can see and the compliance pack can cite. No opaque model output in the score. (Optional ML — an isolation-forest or forecaster — may later contribute an *additional* input term `w_ml·M`, but only as a bounded, logged, overridable signal; it never becomes the sole decider, because we must always be able to explain a red score to a regulator.)

## 9. Time-to-breach (step 9)

For a rising score (or a KPI approaching an SLA/rulepack threshold): robust linear fit (Theil–Sen) over the recent trajectory → project intersection with the breach line → minutes-to-breach, with a confidence from fit residuals. Report `None` when flat/falling or when the fit is poor. Always labeled a projection, never a fact — the agents and the pack must preserve that hedge.

## 10. Incident lifecycle (step 10)

State machine per candidate incident, with **hysteresis** to prevent flapping:

```
     (score>red for ≥T_open consecutive windows, candidate not already open)
none ─────────────────────────────────────────────────────────────► ACTIVE  ──emit IncidentOpened──►
ACTIVE  ── approved mitigation in audit ──► MITIGATING
MITIGATING / ACTIVE ── score<amber for ≥T_rec windows ──► RECOVERY
RECOVERY ── score<green for ≥T_res windows ──► RESOLVED
any ── score re-crosses red ──► ACTIVE (re-open, same incident id, logged)
```

- `T_open` (e.g., 3 windows) stops single-spike false opens; `spike`-shaped anomalies are suppressed from opening entirely.
- Maintenance windows (planned-outage calendar) suppress opening and are noted (the rulepack requires 1-week advance consumer notice for *planned* outages — a planned window is a compliance state, not an incident).
- One incident per correlated cluster until RESOLVED. Re-crossings re-open the same id (audited) rather than spawning duplicates.

## 11. Calibration & validation (how it becomes trustworthy)

Detection is only "real" once tuned against labeled reality:

- **Golden replay set**: the scenarios in `AGENT_PRODUCT_PLAN.md` §9 (fibre cut, power, congestion, DDoS, theft, billing-only, ambiguous, self-recovering, missing-data) as telemetry fixtures with known ground truth.
- **Metrics to publish** (these become pilot sales assets): detection **lead time** (detect-before-human), **precision/recall** on incident opens, **false-positive rate** per day, shape-classification accuracy, blast-radius accuracy vs ground truth.
- **Robustness tests**: inject noise, drop 10–20% of samples, add clock skew, remove a whole domain — the detector must degrade sensibly (lower confidence, stated gaps), not fail or hallucinate an incident.
- **Threshold tuning** is per-tenant config, calibrated on the customer's own replayed history in the pilot's first week. Ship sane defaults; expect to tune.

## 12. Boundaries

- **Deterministic and explainable end to end.** No LLM anywhere in this layer. Every score decomposes into named, citable terms.
- **Writes only through the existing repo interfaces** (`RiskScoreRepository`, `IncidentRepository`, evidence store). No FastAPI in the engine (`app/engine/`), per the module boundary.
- **Does not decide meaning.** "Availability cliff on a corridor" is detection's job; "probable fibre cut, confidence 0.82" is the forensics agent's. Keep the line clean — it's what lets the same detector serve a power DisCo with only a config/rulepack change.
