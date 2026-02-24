# Phase Runbook Template

## Phase

- `phase_id`: <ID>
- `packet`: <path>

## Entry Checks

1. Verify prior dependency gates.
2. Verify active scope against packet.
3. Verify no out-of-phase requirements are included.

## Command Sequence

1. `npm run lint:agents`
2. `npm run lint:docs`
3. `npm run lint:phase -- --phase=<ID>`
4. `npm run gate:phase -- --phase=<ID>`

## Expected Evidence

1. Requirement IDs covered.
2. Test/gate command outcomes.
3. Performance/security artifacts required by packet.

## Fail-Fast Checks

1. Entry criteria mismatch.
2. Unresolved lint/gate blocker.
3. Scope creep beyond packet out-of-scope list.

## Handoff Checklist

1. Requirement-to-change mapping complete.
2. Residual risk list complete.
3. Evidence paths included.
