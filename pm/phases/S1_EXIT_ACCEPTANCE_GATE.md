---
phase_id: S1.EXIT
stage: Stage 1
depends_on:
  - S1.4
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S1.4 exit gate passed
exit_gate: Stage 1 acceptance gate passes
---

# Phase S1.EXIT - Stage 1 Acceptance Gate

## Context Capsule

This phase does not add product features. It verifies Stage 1 end-to-end behavior, reliability, and performance before any Stage 2 work.

## Entry Criteria

1. S1.1 through S1.4 exit gates passed.
2. All Stage 1 contracts are implemented.
3. Golden-path environment is reproducible.

## Decisions Locked for This Phase

1. No new features while executing this gate.
2. Every required Stage 1 test class must pass.
3. Stage 2 is blocked until this gate is green.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.EXIT-REQ-001 | REQ | Run full Stage 1 golden-path E2E from empty workspace. | - |
| S1.EXIT-REQ-002 | REQ | Validate feed/object/entity/pipeline workflow continuity. | - |
| S1.EXIT-REQ-003 | REQ | Validate scoring and fold-up reliability under representative load. | - |
| S1.EXIT-REQ-004 | REQ | Validate ingestion idempotency and run-state correctness. | - |
| S1.EXIT-REQ-005 | REQ | Validate Stage 1 performance baselines and regression thresholds. | - |
| S1.EXIT-REQ-006 | REQ | Produce acceptance evidence artifacts and runbook outputs. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.EXIT-NFR-001 | NFR | Acceptance evidence must be reproducible by another engineer. | S1.EXIT-REQ-006 |
| S1.EXIT-NFR-002 | NFR | No unresolved critical defects in core loop pathways. | S1.EXIT-REQ-001,S1.EXIT-REQ-002 |
| S1.EXIT-NFR-003 | NFR | Performance checks must be measured and documented with method. | S1.EXIT-REQ-005 |
| S1.EXIT-NFR-004 | NFR | Reliability checks must include transient failure scenarios. | S1.EXIT-REQ-003,S1.EXIT-REQ-004 |
| S1.EXIT-NFR-005 | NFR | Acceptance package must map to prior phase requirement IDs. | S1.EXIT-REQ-006 |

## Public Interfaces and Data Contracts

1. Stage 1 tRPC contract set remains unchanged.
2. Stage 1 telemetry metric definitions for latency/success rate.
3. Evidence contract for gate reports and logs.

## Out of Scope

1. Stage 2 feature work.
2. New data model additions.
3. New navigation surfaces.

## Implementation Constraints

1. Elegant: isolate verification scripts from product runtime code.
2. Minimalist: only evidence and fixes required for gate success.
3. Flexible: acceptance artifacts should support future regression runs.
4. Maintainable: deterministic test command set and outputs.
5. Secure: no test harness shortcuts that weaken baseline security.
6. Performant: benchmark method must be stable and repeatable.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S1.EXIT-AC-001 | AC | Golden-path E2E passes from empty workspace to actionable card. | S1.EXIT-REQ-001,S1.EXIT-NFR-002 |
| S1.EXIT-AC-002 | AC | Ingestion idempotency and run-status checks pass. | S1.EXIT-REQ-004,S1.EXIT-NFR-004 |
| S1.EXIT-AC-003 | AC | Scoring and fold-up reliability checks pass under load sample. | S1.EXIT-REQ-003,S1.EXIT-NFR-004 |
| S1.EXIT-AC-004 | AC | Feed latency and first-score timing remain within Stage 1 targets. | S1.EXIT-REQ-005,S1.EXIT-NFR-003 |
| S1.EXIT-AC-005 | AC | Acceptance evidence bundle is complete and reproducible. | S1.EXIT-REQ-006,S1.EXIT-NFR-001,S1.EXIT-NFR-005 |

## Test Plan

1. Unit: targeted defect guard tests from Stage 1 implementation.
2. Integration: ingestion -> graph -> scoring -> pipeline chain.
3. E2E: full golden path and recovery path runs.
4. Performance: feed p95 and first-score latency measurements.
5. Security: regression smoke across Stage 1 boundary controls.

## Exit Gate

`npm run gate:phase -- --phase=S1.EXIT` and `npm run gate:stage1` must pass.

## Deliverables

1. Stage 1 acceptance report.
2. Reproducible command transcript for all required checks.
3. Stage 2 readiness decision log.
