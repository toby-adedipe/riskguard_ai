# Layer 5 — regulator rulepacks

_Part of the demo→product bundle. A rulepack is the encoded regulatory regime for one sector/regulator, as **versioned data, not code**. It is what makes RiskGuard multi-sector: NCC (telecom) ships first; NERC (power) and CBN/NDPC (banking/data) are new YAML files behind the same schema, not new software._

## Why data, not code

Regulations change (thresholds get tightened, compensation formulas get published, deadlines move). If those live in code, every change is a deploy and a regression risk. If they live in versioned rulepack files, a compliance analyst can propose a change as a data diff, it gets legally reviewed, and it ships with a version bump. The `classify_against_rulepack` and `get_rulepack` tools (agent tool catalog) read these files; nothing about a threshold value is hardcoded in the engine or the agents.

## Files

| File | Regulator | Sector | Status |
|---|---|---|---|
| [`ncc.yaml`](ncc.yaml) | Nigerian Communications Commission | Telecom | drafted — **values require legal verification (see below)** |
| `nerc.yaml` | Nigerian Electricity Regulatory Commission | Power distribution | planned (Phase 3, proves the abstraction) |
| `cbn-ndpc.yaml` | Central Bank / Nigeria Data Protection Commission | Banking, data | planned |

## Schema (every rulepack has these sections)

```
meta:               regulator, sector, jurisdiction, version, effective_date, sources[]
classification:     ordered rules → each { id, description, predicate over incident facts,
                      severity_tier, citation, verification_status }
reporting:          obligations → each { id, trigger, audience, channel, deadline, content_required[], citation }
exposure:           formulas → each { id, applies_when, formula (named inputs), parameters, citation }
evidence_pack:      required sections[], per-section source mapping, format, signing
consumer_notice:    when_required, required_fields[], prohibited_content[], channel, deadline
verification:       list of every value/clause an operator's legal team must confirm before production use
```

The `predicate`/`formula` fields are written as structured expressions over the canonical incident facts (`affected_subscribers`, `affected_lgas`, `affected_sites`, `total_sites`, `duration_minutes`, `arpu_daily`, etc.) so the classifier evaluates them without bespoke code per rule.

## Honesty rule (important)

A rulepack encodes **law**. Getting a threshold wrong is worse than not having it. Therefore:

- Every value carries a `verification_status`: `confirmed` (traceable to a primary NCC/regulator document), `reported` (from credible secondary reporting — news/regulator press release — but not yet checked against the primary text), or `assumption` (a modeling placeholder we invented and that *must* be replaced).
- The demo may run on `reported`/`assumption` values, clearly labeled in the UI as "modeling values — pending legal verification."
- **Nothing filed to an actual regulator uses an unverified value.** The `verification:` section of each rulepack is the checklist the customer's compliance/legal team clears before go-live. This is a feature: it shows regulated buyers we understand that compliance software carries legal weight.
- `citation` fields name the source document/clause. Where we have only secondary reporting, the citation says so. We never invent a clause number to look authoritative.

## Versioning

Rulepacks are semver'd (`meta.version`) and immutable once referenced by a filed pack — a filed NCC pack records the rulepack version it was built against, so a later regulatory change never retroactively alters a historical filing. This is a compliance requirement, not a nicety.
