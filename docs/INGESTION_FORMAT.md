# Replay ingestion format

Status: **implemented for local CSV/JSONL replay**. This adapter normalizes
recorded telemetry into the canonical `SignalEvent` contract. The Phase 0A
application service sends those events through the robust feature engine,
persists anomalous `SignalEvidence`, and publishes derived `RiskScore` values.
It is not a live feed connector, incident detector, or agent runtime.

## Source contract

`ReplaySource` accepts in-memory content and yields validated events in source
order:

```python
from app.modules.ingestion import ReplaySource

events = ReplaySource(
    content=csv_text,
    format="csv",  # or "jsonl"
    source_name="ikeja-pilot-replay",
).stream()
```

The parser does not sort records. Replay files should therefore be ordered by
`timestamp`; preserving file order makes timing mistakes visible instead of
silently rewriting the source.

## Canonical fields

Every record must contain these fields:

| Field | Meaning |
|---|---|
| `timestamp` | ISO 8601 observation time; an explicit UTC offset is recommended |
| `lga_id` | Stable lowercase LGA identifier |
| `domain` | A `SignalDomain` value from `app.core.schemas` |
| `kpi` | A `SignalKpi` value from `app.core.schemas` |
| `value` | Numeric KPI observation |

The remaining `SignalEvent` fields are optional. `source_system` defaults to
the `ReplaySource.source_name`. Blank CSV cells become null before schema
validation.

`event_id` and `evidence_id` may be supplied. When either is absent, the
adapter derives a stable SHA-256-based ID from the normalized event content.
Re-reading the same canonical record with the same source name therefore
produces the same IDs. This is deterministic identity; the ingestion
application persists anomalous observations through a separate evidence
repository boundary.

## HTTP replay boundary

`POST /ingestion/replay` accepts:

```json
{
  "format": "csv",
  "content": "timestamp,lga_id,domain,kpi,value\\n...",
  "column_mapping": {"area": "lga_id"},
  "source_name": "operator-export"
}
```

The response includes the run id, processed-event and persisted-evidence
counts, stable evidence ids, derived LGA scores, explicit limitations, and a
completion timestamp. `GET /ingestion/status` returns the latest run or a run
selected with `?run_id=...`.

Phase 0A buffers inline content and does not impose a request-size limit. Rows
are processed in supplied order; gap, clock-skew, and late-event handling are
deferred to the hardened detector. Deployments must add body limits before
exposing this endpoint beyond a trusted pilot environment.

## Dimensions

CSV files may use dimension names as flat columns:

```csv
timestamp,lga_id,domain,kpi,value,cluster_id,service_type
2026-06-01T09:00:00Z,ikeja,network,cell_availability_pct,99.62,ikeja-west,mobile_data
```

JSONL files may use either those flat fields or a nested `dimensions` object:

```json
{
  "timestamp": "2026-06-01T09:00:00Z",
  "lga_id": "ikeja",
  "domain": "network",
  "kpi": "cell_availability_pct",
  "value": 99.62,
  "dimensions": {"cluster_id": "ikeja-west"}
}
```

Allowed dimension names are the fields on `SignalDimensions`; unknown event
and dimension fields fail closed.

## Source-column mapping

Mappings are source-name to canonical-name. Unlisted fields use identity
mapping. Dimension targets may be written as `site_id` or
`dimensions.site_id`:

```python
source = ReplaySource(
    content=vendor_csv,
    format="csv",
    column_mapping={
        "observed_at": "timestamp",
        "area": "lga_id",
        "metric_name": "kpi",
        "metric_value": "value",
        "site": "dimensions.site_id",
    },
    source_name="vendor-export",
)
```

Mappings cannot invent canonical fields or map multiple populated source
columns to one canonical target.

## Validation failures

Malformed JSON, invalid CSV shape, missing required fields, unknown fields,
mapping collisions, and Pydantic schema failures raise
`ReplayValidationError`. The exception exposes `source_name` and
`row_number`; CSV data rows start at row 2 because row 1 is the header.

Example: `vendor-export row 18: unknown field 'market'...`

## Included replay fixtures

- `ikeja_fibre_cliff.csv`: twelve stable availability observations followed
  by a sharp four-step availability cliff.
- `surulere_congestion.jsonl`: twelve stable congestion observations followed
  by sustained congestion growth.
- `normal_noisy_control.csv`: sixteen small availability variations without a
  material degradation.

These are deterministic engineering fixtures, not claims about live operator
telemetry.
