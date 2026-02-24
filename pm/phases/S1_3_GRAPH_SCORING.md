---
phase_id: S1.3
stage: Stage 1
depends_on:
  - S1.2
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S1.2 exit gate passed
exit_gate: Phase S1.3 gate passes
---

# Phase S1.3 - Graph and Scoring

## Context Capsule

This phase completes the analytical engine: resolve entities, score objects with user-defined dimensions, and fold scores to entity aggregates.

## Entry Criteria

1. Objects flow reliably from S1.2 ingestion.
2. Queue and DB operations are stable under local load.
3. BYOK provider key setup contract is available.

## Decisions Locked for This Phase

1. Entity resolution order: exact ID -> fuzzy match -> create.
2. Conservative merge strategy (favor false negatives).
3. Real provider scoring only (no mock scoring path).
4. Structured score output validation is mandatory.
5. Fold-up uses recency-weighted aggregation.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.3-REQ-001 | REQ | Resolve entities from object metadata using deterministic match order. | - |
| S1.3-REQ-002 | REQ | Persist object-to-entity links with role and position semantics. | - |
| S1.3-REQ-003 | REQ | Implement `dimensions.list/create/update/delete`. | - |
| S1.3-REQ-004 | REQ | Score objects per active dimension using BYOK LLM providers. | - |
| S1.3-REQ-005 | REQ | Validate and persist score payloads (`value`, `explanation`, metadata). | - |
| S1.3-REQ-006 | REQ | Implement `scores.backfillDimension` for unscored objects. | - |
| S1.3-REQ-007 | REQ | Recompute entity aggregates on score creation events. | - |
| S1.3-REQ-008 | REQ | Implement API key upsert/revoke/provider listing with encrypted-at-rest storage. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.3-NFR-001 | NFR | Entity merges must prioritize precision over recall in ambiguous cases. | S1.3-REQ-001 |
| S1.3-NFR-002 | NFR | Scoring failures must be isolated and retryable without pipeline-wide impact. | S1.3-REQ-004,S1.3-REQ-005 |
| S1.3-NFR-003 | NFR | Score persistence must reject malformed outputs deterministically. | S1.3-REQ-005 |
| S1.3-NFR-004 | NFR | Fold-up recomputation must be deterministic and auditable. | S1.3-REQ-007 |
| S1.3-NFR-005 | NFR | Provider secrets must never be stored in plaintext. | S1.3-REQ-008 |
| S1.3-NFR-006 | NFR | Backfill throughput must support full dimension rollout on existing corpus. | S1.3-REQ-006 |

## Public Interfaces and Data Contracts

1. `dimensions.*` and `scores.backfillDimension` tRPC procedures.
2. `apiKeys.upsert/revoke/listProviders` tRPC procedures.
3. Queue payload contracts for `object.ready`, `score.object`, `score.foldEntity`.
4. Score output schema contract (`value: float`, `explanation: string`, optional metadata).

## Out of Scope

1. Full frontend implementation.
2. Trigger automation and auto-pipeline placement.
3. Hybrid semantic search.
4. Plugins and enterprise admin modules.

## Implementation Constraints

1. Elegant: resolve, score, and fold as explicit job boundaries.
2. Minimalist: no dynamic model router until required by later phases.
3. Flexible: provider interface must support future adapters without leaking provider specifics.
4. Maintainable: deterministic matching and scoring helpers with typed contracts.
5. Secure: encrypted key storage and strict output validation at boundaries.
6. Performant: bounded retries and indexed score query paths.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S1.3-AC-001 | AC | Repeated author identity resolves to stable entity records. | S1.3-REQ-001,S1.3-REQ-002,S1.3-NFR-001 |
| S1.3-AC-002 | AC | Dimensions CRUD operations work and remain type-safe. | S1.3-REQ-003 |
| S1.3-AC-003 | AC | Object scoring persists valid values and explanations per dimension. | S1.3-REQ-004,S1.3-REQ-005,S1.3-NFR-003 |
| S1.3-AC-004 | AC | Backfill enqueues and processes missing scores for selected dimension. | S1.3-REQ-006,S1.3-NFR-006 |
| S1.3-AC-005 | AC | Entity fold-up updates after object score creation. | S1.3-REQ-007,S1.3-NFR-004 |
| S1.3-AC-006 | AC | API key storage remains encrypted and revocable. | S1.3-REQ-008,S1.3-NFR-005 |

## Test Plan

1. Unit: resolution thresholds and score schema validation.
2. Integration: ingestion output -> graph resolution -> scoring -> fold-up chain.
3. E2E: dimension create + backfill + entity update flow.
4. Performance: scoring job success and fold-up latency sampling.
5. Security: encrypted key assertions and provider boundary validation.

## Exit Gate

`npm run gate:phase -- --phase=S1.3` must pass.

## Deliverables

1. Operational graph and scoring engines.
2. Dimension and API key management interfaces.
3. Verified fold-up behavior with regression-safe tests.
