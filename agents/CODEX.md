# Codex Runtime Overlay

This overlay is Codex-specific and supplements `agents/WORKFLOW.md`.

## Runtime Focus

1. Follow phase packet and runbook exactly.
2. Prefer direct, explicit edits over speculative abstractions.
3. Keep changes phase-scoped and requirement-mapped.

## Command Order

1. `npm run lint:agents`
2. `npm run lint:docs`
3. `npm run lint:phase -- --phase=<PHASE_ID>`
4. `npm run gate:phase -- --phase=<PHASE_ID>`

## Codex Handoff Requirements

1. Include phase requirement IDs in summary.
2. Include gate output summary.
3. Flag any exception-file changes explicitly.
4. Flag any unresolved blockers explicitly.
