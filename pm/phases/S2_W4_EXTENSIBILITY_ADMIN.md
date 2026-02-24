---
phase_id: S2.W4
stage: Stage 2
depends_on:
  - S2.W3
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S2.W3 exit gate passed
exit_gate: Phase S2.W4 gate passes
---

# Phase S2.W4 - Extensibility and Enterprise Admin

## Context Capsule

This wave introduces plugins and enterprise administration as modular capabilities without disrupting the core loop surface.

## Entry Criteria

1. S2.W3 search/trigger behaviors are stable.
2. Tenancy, RBAC, and audit controls from S2.W2 are operational.
3. Plugin threat model and security requirements are approved.

## Decisions Locked for This Phase

1. Plugin types: source, processor, action.
2. Plugin security: SSRF protection, HMAC signing, timeout/retry controls.
3. Plugin failures are isolated from core workflow.
4. Admin capabilities stay outside core loop navigation.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W4-REQ-001 | REQ | Implement plugin registration/update/deregistration with schema-validated configs. | - |
| S2.W4-REQ-002 | REQ | Implement source plugin invocation path for ingestion extension. | - |
| S2.W4-REQ-003 | REQ | Implement processor plugin invocation path for enrichment/scoring context. | - |
| S2.W4-REQ-004 | REQ | Implement action plugin invocation path for outbound automation events. | - |
| S2.W4-REQ-005 | REQ | Enforce plugin boundary security controls (SSRF, HMAC, timeout, validation). | - |
| S2.W4-REQ-006 | REQ | Implement plugin run logging, health tracking, and failure isolation. | - |
| S2.W4-REQ-007 | REQ | Implement enterprise admin section for audit, plugin, and system health operations. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W4-NFR-001 | NFR | Plugin failures must not block ingestion/scoring/pipeline core paths. | S2.W4-REQ-002,S2.W4-REQ-003,S2.W4-REQ-004,S2.W4-REQ-006 |
| S2.W4-NFR-002 | NFR | External plugin calls must satisfy strict request/response validation. | S2.W4-REQ-005 |
| S2.W4-NFR-003 | NFR | Admin operations must be role-restricted and audit-complete. | S2.W4-REQ-007 |
| S2.W4-NFR-004 | NFR | Plugin invocation observability must support rapid incident analysis. | S2.W4-REQ-006 |
| S2.W4-NFR-005 | NFR | Core four-screen workflow performance and UX must remain unaffected. | S2.W4-REQ-007 |

## Public Interfaces and Data Contracts

1. Plugin registration schema and lifecycle API.
2. Plugin invocation payload and response schema by plugin type.
3. Plugin run log schema and health state model.
4. Admin section access and role policy contract.

## Out of Scope

1. Plugin marketplace and billing systems.
2. Broad compliance suite expansion beyond required audit/admin controls.
3. Additional top-level workflow navigation surfaces.

## Implementation Constraints

1. Elegant: plugin boundaries are explicit adapter interfaces.
2. Minimalist: implement only required plugin types and admin surfaces.
3. Flexible: plugin contracts remain versioned and forward-compatible.
4. Maintainable: isolate plugin runtime from core domain services.
5. Secure: mandatory SSRF/HMAC/timeout validation controls.
6. Performant: plugin overhead must not degrade core loop SLOs.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S2.W4-AC-001 | AC | Plugin lifecycle operations (register/update/remove) are functional and validated. | S2.W4-REQ-001,S2.W4-NFR-002 |
| S2.W4-AC-002 | AC | Source/processor/action plugins execute with typed contracts. | S2.W4-REQ-002,S2.W4-REQ-003,S2.W4-REQ-004 |
| S2.W4-AC-003 | AC | Plugin security controls block invalid or unsafe endpoints and payloads. | S2.W4-REQ-005,S2.W4-NFR-002 |
| S2.W4-AC-004 | AC | Plugin errors are logged and isolated without core workflow interruption. | S2.W4-REQ-006,S2.W4-NFR-001,S2.W4-NFR-004 |
| S2.W4-AC-005 | AC | Admin section is available to authorized roles and denied to others. | S2.W4-REQ-007,S2.W4-NFR-003 |

## Test Plan

1. Unit: plugin config validation, signature, and policy checks.
2. Integration: plugin invocation lifecycle and failure isolation paths.
3. E2E: admin access control and plugin management workflows.
4. Performance: plugin overhead and core loop regression checks.
5. Security: SSRF/hmac/timeout enforcement and authz audits.

## Exit Gate

`npm run gate:phase -- --phase=S2.W4` and `npm run gate:stage2` must pass.

## Deliverables

1. Secure extensibility runtime.
2. Enterprise admin operational surfaces.
3. Stage 2 completion evidence package.
