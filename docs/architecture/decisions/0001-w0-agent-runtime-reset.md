# ADR 0001: Reset the dev agent runtime to the W0 foundation

- **Status:** accepted
- **Date:** 2026-07-09

## Context

The `dev` branch contained a polished frontend and a large Semantic Kernel
backend, but its investigation harness executed a fixed role playbook over
scripted Ikeja trajectories. That behavior conflicted with the north-star
requirements: detection must be deterministic and data-derived, agents must
choose tools dynamically, and an `IncidentOpened` event must wake the runtime.

The W0 work on `main` validates a smaller set of facts: prompt composition,
strict provider output, response extraction, grounded-fact validation, and
transcript persistence. Its observations are fixture-supplied. It is not an
interactive agent runtime or a model-to-tool loop.

## Decision

1. Use `dev` as the continuing integration branch and retain its React/Vite
   presentation work.
2. Remove the fixed Semantic Kernel harness, role plugins, scripted live
   trigger, agent report compiler, old harness evals, and duplicate standalone
   `data-engine`.
3. Keep W0 as an explicitly labelled provider-conformance spike. Preserve the
   `/copilot/query` seam, but return `503` until a real runtime is connected.
4. Keep `api/app/engine/` as the single future engine boundary. The next slice
   creates replay ingestion, evidence storage, and a domain-event seam before
   implementing the hardened detector.
5. Retain the old live-investigation frontend source as dormant north-star UI;
   do not feed it synthetic multi-agent events.

## `feat/copilot` assessment

No code is ported from local commit `36b5fb95` during this reset. Its
`EngineRunner` is useful only as pipeline-order vocabulary, and
`modules/signals/db.py` is useful as a checklist for a future evidence
repository. The implementation itself embeds fixed z-scores and trajectories,
uses flat mean/stddev baselines, owns hidden threads, and directly imports the
Copilot service. The new dependency direction must be:

```text
ingestion -> engine -> repositories -> core events <- agent runtime
```

## Consequences

- The dashboard, incident, mitigation, compliance, and PDF presentation shells
  remain available against explicit demo fixtures.
- Streamed multi-agent investigation, report compilation, and interactive
  copilot answers are temporarily unavailable and must be shown honestly.
- Git history remains the archive for removed prototypes.
- The next implementation is smaller and testable against the layer specs,
  without compatibility pressure from a theatrical runtime.

## Revisit triggers

Revisit this decision when W1 provides real tool adapters and an evidence store,
or when W2 provides a budgeted model-to-tool loop that passes the scenario evals
in `docs/AGENT_PRODUCT_PLAN.md`.
