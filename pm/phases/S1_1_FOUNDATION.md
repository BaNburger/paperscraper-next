---
phase_id: S1.1
stage: Stage 1
depends_on:
  - none
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: Repository bootstrap complete
exit_gate: Phase S1.1 gate passes
---

# Phase S1.1 - Foundation

## Context Capsule

This phase establishes the execution substrate for all later phases. Product features are not shipped here. Only stack bootstrap, contracts, and reliability baselines are in scope.

## Entry Criteria

1. Phase packet standard and governance docs exist.
2. No Stage 2 scope is being implemented.
3. Runtime/tooling choices are frozen for Stage 1.

## Decisions Locked for This Phase

1. Bun runtime for API and jobs.
2. TanStack Start for web app shell.
3. tRPC as internal API protocol.
4. PostgreSQL 16 + Redis + BullMQ.
5. Minimal monorepo package boundaries (`api`, `web`, `jobs`, `shared`, `db`).

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.1-REQ-001 | REQ | Initialize monorepo workspace and install dependency graph cleanly. | - |
| S1.1-REQ-002 | REQ | Provision API runtime with health endpoint and typed tRPC bootstrap. | - |
| S1.1-REQ-003 | REQ | Provision web runtime with route shell and compile-safe startup path. | - |
| S1.1-REQ-004 | REQ | Provision jobs runtime with BullMQ worker connectivity checks. | - |
| S1.1-REQ-005 | REQ | Define Stage 1 base schema and migration scaffold in db package. | - |
| S1.1-REQ-006 | REQ | Enable local infra orchestration for PostgreSQL and Redis. | - |
| S1.1-REQ-007 | REQ | Publish shared type contracts importable by API, jobs, and web. | - |
| S1.1-REQ-008 | REQ | Add baseline lint/typecheck commands for all workspaces. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.1-NFR-001 | NFR | Startup path must be deterministic from clean clone. | S1.1-REQ-001,S1.1-REQ-006 |
| S1.1-NFR-002 | NFR | Service boundaries must avoid cyclic dependencies. | S1.1-REQ-007 |
| S1.1-NFR-003 | NFR | Foundational modules must remain compact and reviewable. | S1.1-REQ-002,S1.1-REQ-004 |
| S1.1-NFR-004 | NFR | No insecure defaults in local runtime bootstrapping. | S1.1-REQ-002,S1.1-REQ-006 |
| S1.1-NFR-005 | NFR | Health diagnostics must expose actionable readiness states. | S1.1-REQ-002,S1.1-REQ-004 |
| S1.1-NFR-006 | NFR | Phase must preserve clean upgrade path for later wave controls. | S1.1-REQ-005,S1.1-REQ-007 |

## Public Interfaces and Data Contracts

1. `GET /health` API contract.
2. Worker readiness/log contract (`ready`, `degraded`, `failed`).
3. Shared package export contract for DTOs and error envelopes.
4. Base Prisma schema contract for Stage 1 tables.

## Out of Scope

1. Stream ingestion logic.
2. Entity resolution and scoring.
3. Pipeline operations.
4. Stage 2 tenancy and plugin features.

## Implementation Constraints

1. Elegant: explicit package boundaries and imports only from public entrypoints.
2. Minimalist: create only modules required for this phase.
3. Flexible: avoid speculative abstractions not demanded by S1.2+.
4. Maintainable: keep files small, single-responsibility, and testable.
5. Secure: no unsafe execution primitives or plaintext secret handling.
6. Performant: baseline startup and health checks must complete quickly.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S1.1-AC-001 | AC | Clean install and bootstrap complete without manual patching. | S1.1-REQ-001,S1.1-NFR-001 |
| S1.1-AC-002 | AC | API health endpoint returns success while dependencies are available. | S1.1-REQ-002,S1.1-NFR-005 |
| S1.1-AC-003 | AC | Worker process connects to Redis and reports ready state. | S1.1-REQ-004,S1.1-NFR-005 |
| S1.1-AC-004 | AC | Base schema migration applies on empty database. | S1.1-REQ-005,S1.1-NFR-006 |
| S1.1-AC-005 | AC | Shared contracts import from all runtime packages without cycles. | S1.1-REQ-007,S1.1-NFR-002 |
| S1.1-AC-006 | AC | Lint/typecheck command suite passes. | S1.1-REQ-008,S1.1-NFR-003 |

## Test Plan

1. Unit: package export and config parser tests.
2. Integration: API + worker startup against local infra.
3. E2E: clean-clone bootstrap script execution.
4. Performance: startup latency sample under local baseline.
5. Security: secret handling smoke checks and unsafe primitive scans.

## Exit Gate

`npm run gate:phase -- --phase=S1.1` must pass.

## Deliverables

1. Bootstrap-ready workspace with documented run commands.
2. Base schema and migration foundation.
3. Passing S1.1 runbook evidence.
