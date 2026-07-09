# RiskGuard frontend

Vite, React, and TypeScript presentation layer for the RiskGuard demo. The map,
incident, mitigation, and compliance views remain available. The interactive
agent investigation is intentionally disconnected while the W0 runtime is being
rebuilt; the active UI says so explicitly.

## Run Locally

**Prerequisites:** Node.js and the FastAPI service in `../api`.


1. Install dependencies:
   `npm install`
2. Start the FastAPI service from `../api` so Vite can proxy `/api` requests.
3. Run the app:
   `npm run dev`
