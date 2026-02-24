---
phase_id: S1.4
stage: Stage 1
depends_on:
  - S1.3
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S1.3 exit gate passed
exit_gate: Phase S1.4 gate passes
---

# Phase S1.4 - Pipeline and 4-Screen Frontend

## Context Capsule

This phase delivers the visible product surface for Stage 1 and connects all prior backend capabilities into the complete core workflow.

## Entry Criteria

1. S1.3 graph/scoring path is stable.
2. Required API contracts for objects, entities, dimensions, pipelines, and streams exist.
3. UI shell from S1.1 is ready for route-level implementation.

## Decisions Locked for This Phase

1. Exactly four top-level screens.
2. Pipeline behavior remains manual-only.
3. Stream and API-key management are secondary UI surfaces (drawer/modal), not top-level pages.
4. All async surfaces must show loading/empty/error states.
5. Responsive behavior is mandatory for mobile and desktop.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.4-REQ-001 | REQ | Implement pipeline API operations for list/create/update/delete/getBoard/addCard/moveCard/removeCard. | - |
| S1.4-REQ-002 | REQ | Build Feed screen with filter, sort, and cursor pagination. | - |
| S1.4-REQ-003 | REQ | Build Object Detail screen with metadata, scores, and linked entities. | - |
| S1.4-REQ-004 | REQ | Build Entity Detail screen with aggregate scores and related objects. | - |
| S1.4-REQ-005 | REQ | Build Pipeline Board screen with stage columns and drag/drop movement. | - |
| S1.4-REQ-006 | REQ | Expose stream create/trigger/status panel from Feed as secondary surface. | - |
| S1.4-REQ-007 | REQ | Expose API key setup modal as secondary surface. | - |
| S1.4-REQ-008 | REQ | Implement route-based code splitting for all four screens. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S1.4-NFR-001 | NFR | No blank primary screen states under loading or recoverable errors. | S1.4-REQ-002,S1.4-REQ-003,S1.4-REQ-004,S1.4-REQ-005 |
| S1.4-NFR-002 | NFR | Feed query path must preserve Stage 1 p95 latency target. | S1.4-REQ-002 |
| S1.4-NFR-003 | NFR | Drag/drop card movement must be atomic and position-consistent. | S1.4-REQ-001,S1.4-REQ-005 |
| S1.4-NFR-004 | NFR | UI architecture must preserve four-screen top-level IA without expansion. | S1.4-REQ-002,S1.4-REQ-003,S1.4-REQ-004,S1.4-REQ-005 |
| S1.4-NFR-005 | NFR | Screen implementations must be modular and avoid single-use shared abstractions. | S1.4-REQ-002,S1.4-REQ-005 |
| S1.4-NFR-006 | NFR | Mobile and desktop layouts must preserve full workflow accessibility. | S1.4-REQ-002,S1.4-REQ-005 |

## Public Interfaces and Data Contracts

1. `objects.feed/detail` and `entities.detail` query contracts.
2. Pipeline CRUD and board operation contracts.
3. Feed filter/sort/pagination query contract.
4. Stream panel run-status contract.

## Out of Scope

1. Saved views, keyboard workflows, and batch actions (S2.W1).
2. Auth/RBAC/tenancy controls (S2.W2).
3. Search and trigger automation (S2.W3).
4. Plugin/admin modules (S2.W4).

## Implementation Constraints

1. Elegant: screen logic remains explicit and local.
2. Minimalist: no new top-level navigation items.
3. Flexible: component composition must allow later W1 enhancements.
4. Maintainable: each screen keeps isolated query/state modules.
5. Secure: no insecure token/key handling in client storage.
6. Performant: lazy route loading and query caching must prevent heavy initial bundles.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S1.4-AC-001 | AC | Feed renders scored objects with functional filter/sort/pagination controls. | S1.4-REQ-002,S1.4-NFR-002 |
| S1.4-AC-002 | AC | Object detail shows metadata, scores, and entity links. | S1.4-REQ-003 |
| S1.4-AC-003 | AC | Entity detail shows aggregate scores and related object list. | S1.4-REQ-004 |
| S1.4-AC-004 | AC | Pipeline board supports card add/move/remove with ordered stage rendering. | S1.4-REQ-001,S1.4-REQ-005,S1.4-NFR-003 |
| S1.4-AC-005 | AC | Stream and API key secondary surfaces support golden path setup tasks. | S1.4-REQ-006,S1.4-REQ-007 |
| S1.4-AC-006 | AC | Four-screen navigation works on mobile and desktop with no blank states. | S1.4-REQ-008,S1.4-NFR-001,S1.4-NFR-006 |

## Test Plan

1. Unit: list/table/board UI behavior and mutation helper tests.
2. Integration: feed query + object/entity/pipeline route data wiring.
3. E2E: empty workspace to first card movement workflow.
4. Performance: feed query timing and bundle size checks.
5. Security: client-side storage and key handling checks.

## Exit Gate

`npm run gate:phase -- --phase=S1.4` must pass.

## Deliverables

1. Complete four-screen Stage 1 UI.
2. Manual pipeline workflow on real data.
3. Stable golden-path interaction flow.
