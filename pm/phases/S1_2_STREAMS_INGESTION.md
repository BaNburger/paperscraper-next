---
phase_id: S1.2
stage: Stage 1
depends_on:
  - S1.1
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S1.1 exit gate passed
exit_gate: Phase S1.2 gate passes
---

# Phase S1.2 - Streams and Ingestion

## Context Capsule

This phase activates the Subscribe -> Ingest part of the loop using OpenAlex as the only source adapter and idempotent ingestion semantics.

## Entry Criteria

1. S1.1 infrastructure and schemas are operational.
2. Queue and DB connectivity are stable.
3. Stage 1 scope lock remains unchanged.

## Decisions Locked for This Phase

1. OpenAlex is the only source adapter.
2. Ingestion is manual trigger only.
3. Dedup key is `(externalId, source)`.
4. Each trigger creates a tracked `stream_run` lifecycle.
5. New objects emit graph-resolution jobs.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.2-REQ-001 | REQ | Implement `streams.list/create/update/delete/trigger` procedures. | - |
| S1.2-REQ-002 | REQ | Normalize OpenAlex payloads into `research_objects` schema. | - |
| S1.2-REQ-003 | REQ | Persist stream run lifecycle with status and statistics. | - |
| S1.2-REQ-004 | REQ | Enforce idempotent upsert semantics for ingested objects. | - |
| S1.2-REQ-005 | REQ | Emit `object.created` jobs for newly inserted objects. | - |
| S1.2-REQ-006 | REQ | Implement retry/backoff on transient adapter failures. | - |
| S1.2-REQ-007 | REQ | Persist permanent failure context without crashing worker process. | - |
| S1.2-REQ-008 | REQ | Expose run status for operator visibility. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.2-NFR-001 | NFR | Ingestion path must remain idempotent across repeat triggers. | S1.2-REQ-004 |
| S1.2-NFR-002 | NFR | Adapter access must respect provider rate limits and backoff policy. | S1.2-REQ-002,S1.2-REQ-006 |
| S1.2-NFR-003 | NFR | Failure in one run must not halt unrelated queue workloads. | S1.2-REQ-006,S1.2-REQ-007 |
| S1.2-NFR-004 | NFR | Run statistics must be sufficient for operational diagnosis. | S1.2-REQ-003,S1.2-REQ-008 |
| S1.2-NFR-005 | NFR | Module boundaries must preserve router -> engine -> adapter layering. | S1.2-REQ-001,S1.2-REQ-002 |
| S1.2-NFR-006 | NFR | Ingestion of 100 objects should complete under local target conditions. | S1.2-REQ-002,S1.2-REQ-004 |

## Public Interfaces and Data Contracts

1. `streams.*` tRPC procedures.
2. OpenAlex adapter input/output normalization contract.
3. `stream_runs` status model (`queued`, `running`, `succeeded`, `failed`).
4. Queue payload contract for `object.created`.

## Out of Scope

1. Entity resolution behavior.
2. Scoring and fold-up.
3. Pipeline APIs and UI.
4. Any additional ingestion source adapters.

## Implementation Constraints

1. Elegant: isolate provider mapping from domain logic.
2. Minimalist: no scheduling/cron subsystem in Stage 1.
3. Flexible: keep adapter contract extensible without adding plugin runtime.
4. Maintainable: use typed normalization helpers and explicit error classes.
5. Secure: no direct unvalidated payload writes.
6. Performant: enforce explicit projection and batched persistence.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S1.2-AC-001 | AC | Creating and triggering a stream stores run and starts ingestion. | S1.2-REQ-001,S1.2-REQ-003 |
| S1.2-AC-002 | AC | Ingested objects are normalized and persisted with dedup guarantees. | S1.2-REQ-002,S1.2-REQ-004,S1.2-NFR-001 |
| S1.2-AC-003 | AC | Repeat trigger does not create duplicate object rows. | S1.2-REQ-004,S1.2-NFR-001 |
| S1.2-AC-004 | AC | New object insertions emit graph jobs with valid payloads. | S1.2-REQ-005 |
| S1.2-AC-005 | AC | Retryable failures backoff and permanent failures end in failed run state. | S1.2-REQ-006,S1.2-REQ-007 |
| S1.2-AC-006 | AC | Operator can inspect run statuses and stats from API contract. | S1.2-REQ-008,S1.2-NFR-004 |

## Test Plan

1. Unit: normalization and dedup helper tests.
2. Integration: stream trigger -> ingestion -> run lifecycle transitions.
3. E2E: create stream, trigger twice, validate no duplicates.
4. Performance: ingestion batch throughput sampling.
5. Security: adapter payload validation and safe error envelope tests.

## Exit Gate

`npm run gate:phase -- --phase=S1.2` must pass.

## Deliverables

1. Working stream management and ingestion APIs.
2. Stable run lifecycle tracking.
3. Verified idempotent ingest path with job emission.
