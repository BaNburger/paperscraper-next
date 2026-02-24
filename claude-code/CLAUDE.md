# Claude Runtime Overlay

This file is a runtime overlay only. Product requirements remain in `pm/PRD.md` and `pm/phases/*`.

## Source of Truth Order

1. `../pm/PRD.md`
2. `../pm/phases/*.md`
3. `../engineering/*.md`
4. `../agents/WORKFLOW.md`
5. This overlay

## Required Execution Sequence

1. Read active phase packet.
2. Read matching runbook in `../agents/phases/<PHASE_ID>.md`.
3. Run:
   - `npm run lint:agents`
   - `npm run lint:docs`
   - `npm run lint:phase -- --phase=<PHASE_ID>`
   - `npm run gate:phase -- --phase=<PHASE_ID>`

## Stage Rules

1. Stage 1: four top-level screens only.
2. Stage 1 excludes trigger automation, plugins, chat, hybrid search.
3. Stage 2 executes strictly W1 -> W2 -> W3 -> W4.

## Handoff Requirements

1. Include implemented requirement IDs.
2. Include gate/lint outcomes.
3. Include unresolved blockers and risks.
