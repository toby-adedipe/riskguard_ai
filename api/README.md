# RiskGuard API

Modular FastAPI backend. Package management is via [Poetry](https://python-poetry.org/). `requirements.txt` is kept up to date as a fallback for pip-only environments.

The current copilot code is a W0 strict-output conformance spike: it validates
fixture-backed agent envelopes and provider response extraction. It is not an
interactive agent runtime. `GET /copilot/status` exposes that boundary and
`POST /copilot/query` returns `503` until a production runtime is implemented.

Phase 0A also provides synchronous CSV/JSONL replay ingestion. It derives
polarity-aware median/MAD evidence and risk scores, but deliberately does not
open incidents or invoke agents.

## Layout

```
api/
├── main.py                    # uvicorn entry: imports app from app/__init__.py
├── pyproject.toml             # Poetry-managed project + dependencies (source of truth)
├── poetry.lock                # locked dependency versions
├── requirements.txt           # pinned snapshot for pip-only installs
├── .env.example
└── app/
    ├── __init__.py            # create_app() — CORS + router registration
    ├── core/
    │   ├── config.py          # Settings via pydantic-settings
    │   └── schemas.py         # cross-domain Pydantic shapes
    ├── engine/                framework-free features + risk scoring
    └── modules/
        ├── simulation/        routes.py services.py db.py schemas.py
        ├── ingestion/         replay adapter + application/API boundary
        ├── evidence/          stable evidence repository
        ├── risk/              ...
        ├── incidents/         ...
        ├── copilot/           ...
        ├── actions/           ...
        ├── compliance/        ...
        └── audit/             services.py db.py schemas.py (no public router)
```

Each module owns its own `routes.py` (APIRouter), `services.py` (business logic), `db.py` (repository + dependency provider), `schemas.py` (request/response shapes). Shared shapes that cross domain boundaries live in `app/core/schemas.py`.

## Prerequisites

- Python ≥ 3.11
- [Poetry ≥ 2.0](https://python-poetry.org/docs/#installation) — `brew install poetry` on macOS

## First-time setup

```bash
cd api
cp .env.example .env
poetry install
```

Poetry creates a virtual environment in `.venv/` (configured via `poetry config --local virtualenvs.in-project true`) and installs everything listed in `pyproject.toml` at the versions in `poetry.lock`.

## Run the server

```bash
poetry run uvicorn main:app --reload
```

- Server: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

For a non-reload run (production-style):

```bash
poetry run uvicorn main:app --host 0.0.0.0 --port 8000
```

## Run the W0 conformance spike

From `api/`, run the fixture-backed path without provider credentials:

```bash
poetry run python -m scripts.w0_agent_spike
```

To test strict structured output against OpenRouter, set
`OPENROUTER_API_KEY` in `.env` and add `--live-openrouter-strict`. This still
tests provider and extraction conformance only; it is not a model-driven tool
loop or an interactive agent runtime.

## Run a telemetry replay

`POST /ingestion/replay` accepts a JSON body containing `format` (`csv` or
`jsonl`), the file `content`, an optional source-to-canonical
`column_mapping`, and a `source_name`. The synchronous response contains the
derived scores and stable evidence ids. `GET /ingestion/status` returns the
latest run, or accepts a `run_id` query parameter.

The exact field contract and mapping examples are in
[`docs/INGESTION_FORMAT.md`](../docs/INGESTION_FORMAT.md). This endpoint is a
local replay boundary, not a live feed or background job.

You can also drop into the venv shell first and run `uvicorn` directly:

```bash
poetry env activate          # prints an activation command — eval it, or copy/paste
uvicorn main:app --reload
```

## Managing packages

**Add a runtime dependency:**

```bash
poetry add <package>
# example: poetry add httpx
```

**Add a dev-only dependency** (tests, linters, etc.):

```bash
poetry add --group dev <package>
# example: poetry add --group dev pytest ruff
```

**Remove a package:**

```bash
poetry remove <package>
```

**Update all packages within their constraint ranges:**

```bash
poetry update
```

**Update a specific package:**

```bash
poetry update <package>
```

After any of the above, regenerate `requirements.txt` so pip-only consumers stay in sync:

```bash
poetry run pip freeze > requirements.txt
```

If you have the `poetry-plugin-export` plugin installed, the cleaner form is:

```bash
poetry export -f requirements.txt --output requirements.txt --without-hashes
```

Commit `pyproject.toml`, `poetry.lock`, and the regenerated `requirements.txt` together.

## Pip-only fallback

If a contributor cannot install Poetry:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

This works but should be the exception. Poetry is the source of truth.

## Adding a new module

1. Create `app/modules/<name>/` with `__init__.py`, `routes.py`, `services.py`, `db.py`, `schemas.py`.
2. Define the `APIRouter` in `routes.py` with a `prefix` and `tags`.
3. Register it in `app/__init__.py`:
   ```python
   from app.modules.<name>.routes import router as <name>_router
   app.include_router(<name>_router)
   ```
4. Add cross-module shapes (if any) to `app/core/schemas.py`. Keep request/response shapes local to the module.

## Branching, PRs, and team workflow

See the [root README](../README.md#branching-and-pull-requests) for the shared `main`/`dev` branching model and pull request process. It applies to both `api/` and `client/`.
