---
phase_id: S2.W1
stage: Stage 2
depends_on:
  - S1.EXIT
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S1.EXIT gate passed
exit_gate: Phase S2.W1 gate passes
---

# Phase S2.W1 - UX Hardening and IA Polish

## Context Capsule

This wave improves speed-of-use and workflow clarity while preserving the Stage 1 mental model and top-level navigation boundaries.

## Entry Criteria

1. Stage 1 acceptance gate is green.
2. Four-screen IA is stable and documented.
3. Baseline interaction metrics are available for comparison.

## Decisions Locked for This Phase

1. No new top-level navigation items.
2. Saved views are secondary surfaces.
3. Keyboard workflow and batch actions optimize existing flows.
4. Core loop behavior remains unchanged.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W1-REQ-001 | REQ | Add saved views with persisted feed filter/sort/layout state. | - |
| S2.W1-REQ-002 | REQ | Add keyboard-first triage actions for feed and detail transitions. | - |
| S2.W1-REQ-003 | REQ | Add batch add-to-pipeline actions from feed selection. | - |
| S2.W1-REQ-004 | REQ | Add quick pipeline assignment flow from feed context. | - |
| S2.W1-REQ-005 | REQ | Add feed column configuration persistence. | - |
| S2.W1-REQ-006 | REQ | Migrate Stage 1 UI surface to shared design-system primitives with light/dark themes. | - |
| S2.W1-REQ-007 | REQ | Add workspace-persisted Object Detail notes using inline BlockNote editor. | - |
| S2.W1-REQ-008 | REQ | Add adaptable density controls and resizable pane layouts for feed and pipeline screens. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W1-NFR-001 | NFR | Interaction cost must decrease versus Stage 1 baseline tasks. | S2.W1-REQ-002,S2.W1-REQ-004 |
| S2.W1-NFR-002 | NFR | UX improvements must not increase cognitive load or IA sprawl. | S2.W1-REQ-001,S2.W1-REQ-005 |
| S2.W1-NFR-003 | NFR | Keyboard features must remain accessible and conflict-safe. | S2.W1-REQ-002 |
| S2.W1-NFR-004 | NFR | Batch actions must be deterministic and reversible. | S2.W1-REQ-003 |
| S2.W1-NFR-005 | NFR | Existing Stage 1 performance targets must remain stable. | S2.W1-REQ-001,S2.W1-REQ-004 |
| S2.W1-NFR-006 | NFR | Theme, density, and pane adaptations must preserve four-screen IA and mobile usability. | S2.W1-REQ-006,S2.W1-REQ-008 |
| S2.W1-NFR-007 | NFR | Notes writes must be concurrency-safe and never silently drop edits. | S2.W1-REQ-007 |

## Public Interfaces and Data Contracts

1. Saved view CRUD contracts.
2. Feed preference persistence contract.
3. Batch pipeline operation contract.
4. Workspace object-note read/write contract with optimistic revision semantics.

## Out of Scope

1. Auth and tenancy foundations.
2. Text/hybrid search.
3. Trigger automation and plugin systems.

## Implementation Constraints

1. Elegant: map shortcuts and actions to explicit command handlers.
2. Minimalist: use drawers/panels/modals before new page surfaces.
3. Flexible: preferences must support future role/tenant scoping.
4. Maintainable: keyboard and batch logic requires isolated testable modules.
5. Secure: preserve Stage 1 data and mutation protections.
6. Performant: no regressions in feed retrieval and render behavior.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S2.W1-AC-001 | AC | Saved views persist and restore feed state. | S2.W1-REQ-001,S2.W1-NFR-002 |
| S2.W1-AC-002 | AC | Keyboard-only triage flow works for core task chain. | S2.W1-REQ-002,S2.W1-NFR-001,S2.W1-NFR-003 |
| S2.W1-AC-003 | AC | Batch add-to-pipeline applies consistently to selected rows. | S2.W1-REQ-003,S2.W1-NFR-004 |
| S2.W1-AC-004 | AC | Quick pipeline action reduces interaction steps versus baseline. | S2.W1-REQ-004,S2.W1-NFR-001 |
| S2.W1-AC-005 | AC | No new top-level navigation introduced. | S2.W1-NFR-002 |
| S2.W1-AC-006 | AC | Shared design-system migration ships with light/dark themes and no blank primary states. | S2.W1-REQ-006,S2.W1-NFR-006 |
| S2.W1-AC-007 | AC | Object Detail notes persist per object and handle revision conflicts explicitly. | S2.W1-REQ-007,S2.W1-NFR-007 |
| S2.W1-AC-008 | AC | Density and resizable panes persist and restore across sessions. | S2.W1-REQ-008,S2.W1-NFR-006 |

## Test Plan

1. Unit: shortcut registry and saved-view serialization tests.
2. Unit: object-note revision conflict and autosave behavior tests.
3. Integration: feed state persistence and batch mutation flows.
4. Integration: theme/density/pane preference persistence and restore flows.
5. E2E: keyboard-only triage from feed to pipeline action.
6. E2E: object-note persistence and conflict recovery workflow.
7. Performance: interaction and feed query regression checks.
8. Security: mutation authorization and error handling smoke tests.

## Exit Gate

`npm run gate:phase -- --phase=S2.W1` must pass.

## Deliverables

1. Faster Stage 1-compatible UX workflows.
2. Saved view and keyboard/batch behavior documentation.
3. Regression evidence against Stage 1 baseline.
