# Agent Workflow (Canonical)

This workflow is mandatory for all runtime overlays.

## Execution Sequence

1. Read `pm/PRD.md` and the active `pm/phases/<PHASE_FILE>.md` packet.
2. Read matching `agents/phases/<PHASE_ID>.md` runbook.
3. Confirm entry criteria from the phase packet.
4. Implement only requirement IDs in scope.
5. Run mandatory checks:
   - `npm run lint:agents`
   - `npm run lint:docs`
   - `npm run lint:phase -- --phase=<PHASE_ID>`
   - `npm run gate:phase -- --phase=<PHASE_ID>`
6. Capture evidence required by runbook.
7. Produce handoff with requirement-to-change mapping.

## Escalation Rules

Escalate when:

1. Requirement conflicts between packet and implementation constraints.
2. A gate cannot be satisfied without scope expansion.
3. A security/performance rule would need an exception.

Escalation message must include:

1. Blocking requirement ID.
2. Observed mismatch.
3. Minimal options and recommendation.

## Stop Conditions

Stop and report immediately when:

1. Active phase entry criteria are not met.
2. Mandatory lint/gate command fails and cannot be resolved in-scope.
3. Required allowlist exception is missing, invalid, or expired.

## Handoff Format

1. Phase and requirement IDs implemented.
2. Files changed and purpose.
3. Commands executed and result summary.
4. Residual risks or deferred items.
5. Evidence artifact locations.
