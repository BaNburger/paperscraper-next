---
phase_id: S2.W2
stage: Stage 2
depends_on:
  - S2.W1
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S2.W1 exit gate passed
exit_gate: Phase S2.W2 gate passes
---

# Phase S2.W2 - Platform Foundations

## Context Capsule

This wave introduces production-grade security and tenancy controls without changing the core workflow mental model.

## Entry Criteria

1. S2.W1 UX hardening completed.
2. Stage 1 baseline tests remain green.
3. Security model and role policy are approved.

## Decisions Locked for This Phase

1. Better Auth with secure session cookies.
2. Three roles: admin, member, viewer.
3. Workspace-scoped tenancy with DB-level RLS.
4. Audit logging for all mutations.
5. Observability for API, queue, and job reliability.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W2-REQ-001 | REQ | Implement registration/login/session lifecycle with secure cookies. | - |
| S2.W2-REQ-002 | REQ | Implement workspace creation and membership model. | - |
| S2.W2-REQ-003 | REQ | Apply role-based permission checks for all mutable operations. | - |
| S2.W2-REQ-004 | REQ | Add `workspace_id` tenancy scoping to Stage 1 tables and queries. | - |
| S2.W2-REQ-005 | REQ | Enforce PostgreSQL RLS for cross-tenant denial guarantees. | - |
| S2.W2-REQ-006 | REQ | Implement append-only audit logs for all mutations. | - |
| S2.W2-REQ-007 | REQ | Expose operational telemetry for API latency, queue depth, and job failures. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W2-NFR-001 | NFR | Cross-tenant isolation must hold even on direct SQL paths. | S2.W2-REQ-004,S2.W2-REQ-005 |
| S2.W2-NFR-002 | NFR | Session security must forbid browser token persistence. | S2.W2-REQ-001 |
| S2.W2-NFR-003 | NFR | Permission model must be exhaustive and centrally enforced. | S2.W2-REQ-003 |
| S2.W2-NFR-004 | NFR | Audit records must be tamper-resistant and queryable. | S2.W2-REQ-006 |
| S2.W2-NFR-005 | NFR | Platform additions must not regress Stage 1 user flows. | S2.W2-REQ-001,S2.W2-REQ-003 |
| S2.W2-NFR-006 | NFR | Observability must support incident triage with bounded MTTD/MTTR. | S2.W2-REQ-007 |

## Public Interfaces and Data Contracts

1. Auth/session contract and role claims.
2. Workspace membership and permission evaluation contract.
3. Tenant-aware table schema and RLS policy contract.
4. Audit log record schema.

## Out of Scope

1. SSO/OAuth enterprise onboarding.
2. Search and triggers.
3. Plugin lifecycle and admin portal.

## Implementation Constraints

1. Elegant: centralized authz middleware and policy maps.
2. Minimalist: implement only required role/permission matrix.
3. Flexible: role model supports later expansion without branching core logic.
4. Maintainable: tenancy and auth code remain isolated from domain engines.
5. Secure: strict session, CSRF, RLS, and audit controls.
6. Performant: tenant filters and RLS policy indexes must keep hot paths within budgets.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S2.W2-AC-001 | AC | Auth flows establish secure sessions and expected role claims. | S2.W2-REQ-001,S2.W2-NFR-002 |
| S2.W2-AC-002 | AC | Role permissions enforce read/write boundaries across all operations. | S2.W2-REQ-003,S2.W2-NFR-003 |
| S2.W2-AC-003 | AC | Cross-tenant read/write attempts are denied at DB level. | S2.W2-REQ-004,S2.W2-REQ-005,S2.W2-NFR-001 |
| S2.W2-AC-004 | AC | All mutations create append-only audit records. | S2.W2-REQ-006,S2.W2-NFR-004 |
| S2.W2-AC-005 | AC | Stage 1 and W1 workflows pass with no functional regression. | S2.W2-NFR-005 |

## Test Plan

1. Unit: permission matrix and policy evaluation tests.
2. Integration: session lifecycle, workspace context propagation, audit writes.
3. E2E: role-based UI/API behavior and cross-tenant denial flows.
4. Performance: tenant-scoped query latency regression.
5. Security: RLS bypass attempts, CSRF/session checks, audit tamper checks.

## Exit Gate

`npm run gate:phase -- --phase=S2.W2` must pass.

## Deliverables

1. Secure multi-user multi-tenant platform baseline.
2. Audit and observability foundation.
3. Regression-safe compatibility with Stage 1 core loop.
