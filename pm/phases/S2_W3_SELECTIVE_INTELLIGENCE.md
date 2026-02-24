---
phase_id: S2.W3
stage: Stage 2
depends_on:
  - S2.W2
owners:
  - Product
  - Engineering
status: ACTIVE
entry_gate: S2.W2 exit gate passed
exit_gate: Phase S2.W3 gate passes
---

# Phase S2.W3 - Selective Intelligence

## Context Capsule

This wave adds search and optional trigger automation under strict benchmark and explainability controls.

## Entry Criteria

1. S2.W2 tenancy and security controls are stable.
2. Stage 1 baseline and W1/W2 regressions are green.
3. Search relevance benchmark methodology is defined.

## Decisions Locked for This Phase

1. Text search ships first.
2. Hybrid retrieval is benchmark-gated.
3. Trigger actions require explainable logs.
4. Trigger outcomes must be reversible.

## Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W3-REQ-001 | REQ | Implement text search over object corpus with rank ordering. | - |
| S2.W3-REQ-002 | REQ | Benchmark text-only vs hybrid retrieval and gate rollout on precision gains. | - |
| S2.W3-REQ-003 | REQ | Implement trigger rule CRUD with threshold-based actions. | - |
| S2.W3-REQ-004 | REQ | Evaluate triggers on score updates and execute pipeline actions. | - |
| S2.W3-REQ-005 | REQ | Persist trigger execution logs with full decision context. | - |
| S2.W3-REQ-006 | REQ | Support manual reversal/opt-out for auto-placed trigger cards. | - |

## Non-Functional Requirements

| id | type | text | maps_to |
|---|---|---|---|
| S2.W3-NFR-001 | NFR | Search p95 must meet documented latency target at representative scale. | S2.W3-REQ-001,S2.W3-REQ-002 |
| S2.W3-NFR-002 | NFR | Hybrid rollout is prohibited unless benchmark threshold is met. | S2.W3-REQ-002 |
| S2.W3-NFR-003 | NFR | Trigger actions must remain observable and auditable. | S2.W3-REQ-004,S2.W3-REQ-005 |
| S2.W3-NFR-004 | NFR | Trigger automation must be reversible and non-destructive. | S2.W3-REQ-006 |
| S2.W3-NFR-005 | NFR | New intelligence paths must not degrade Stage 1 workflow reliability. | S2.W3-REQ-001,S2.W3-REQ-004 |

## Public Interfaces and Data Contracts

1. Search API contract and ranking metadata fields.
2. Trigger rule schema (`dimension`, `operator`, `threshold`, destination).
3. Trigger execution log schema with reason/context payload.
4. Auto-placement card metadata contract for reversibility.

## Out of Scope

1. Chat interface and unstructured agentic query surfaces.
2. Plugin lifecycle and enterprise admin modules.
3. Non-benchmarked advanced retrieval experiments.

## Implementation Constraints

1. Elegant: separate retrieval, ranking, and trigger evaluator modules.
2. Minimalist: no hybrid path in production without benchmark evidence.
3. Flexible: trigger model supports future actions without breaking current contracts.
4. Maintainable: benchmark methodology and logs are versioned artifacts.
5. Secure: trigger actions honor role and workspace constraints.
6. Performant: search and trigger checks run within bounded latency budgets.

## Acceptance Criteria

| id | type | text | maps_to |
|---|---|---|---|
| S2.W3-AC-001 | AC | Text search returns relevant results within latency target. | S2.W3-REQ-001,S2.W3-NFR-001 |
| S2.W3-AC-002 | AC | Hybrid rollout decision is backed by benchmark report and threshold outcome. | S2.W3-REQ-002,S2.W3-NFR-002 |
| S2.W3-AC-003 | AC | Trigger rules execute correct pipeline actions on threshold match. | S2.W3-REQ-003,S2.W3-REQ-004 |
| S2.W3-AC-004 | AC | Trigger logs capture full execution context and outcomes. | S2.W3-REQ-005,S2.W3-NFR-003 |
| S2.W3-AC-005 | AC | Auto-placed cards can be reversed and are not force-readded. | S2.W3-REQ-006,S2.W3-NFR-004 |

## Test Plan

1. Unit: ranking combiner and trigger evaluator logic.
2. Integration: search path, trigger pipeline actions, and execution logs.
3. E2E: threshold-triggered auto-placement and manual reversal flow.
4. Performance: search p95 and trigger evaluation latency checks.
5. Security: tenant isolation and permission checks on trigger actions.

## Exit Gate

`npm run gate:phase -- --phase=S2.W3` must pass.

## Deliverables

1. Benchmark-governed search capability.
2. Observable and reversible trigger automation.
3. Regression-safe Stage 1 + W1/W2 compatibility evidence.
