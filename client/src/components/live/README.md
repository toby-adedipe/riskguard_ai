# Dormant investigation prototype

`LiveInvestigation.tsx` and `../../lib/live.ts` preserve the streamed
multi-agent frontend work as a design reference. They are intentionally not
imported by the active application because their event, session, and report
contracts belonged to the retired deterministic runtime.

Do not mount this screen by reconnecting the deleted `/simulation/events`
endpoint. Reuse its presentational pieces only after the real runtime defines a
new versioned event contract and tests the complete stream lifecycle.
