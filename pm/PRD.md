# PaperScraper Next Product Requirements Document

Version: 3.0
Date: February 24, 2026
Owner: Product + Engineering
Status: Active contract

## 1. Product Contract

PaperScraper Next is an analytical CRM for research intelligence.

The product loop is fixed:

**Subscribe -> Ingest -> Score -> Review -> Act**

This repository uses a phase-first delivery model. `pm/phases/*.md` are decision-complete phase packets and are mandatory for implementation.

## 2. Goals

### Product goals

1. Keep the core loop as the primary product surface.
2. Let users define scoring dimensions and workflow stages without code changes.
3. Prioritize speed, clarity, and reliability over feature volume.
4. Prove value in local MVP conditions before platform expansion.

### Stage 1 success criteria

1. Time to first scored result after manual trigger is less than 60 seconds.
2. Feed query p95 DB time with filter/sort remains below 200ms.
3. Scoring success rate remains above 95% excluding provider outages.
4. Empty workspace to first actionable card works with no manual DB intervention.

### Stage 2 success criteria

1. No regression on Stage 1 baseline metrics.
2. Multi-tenant data isolation passes all cross-tenant denial tests.
3. Every accepted feature proves faster, clearer, or more reliable workflow outcomes.

## 3. Global Constraints

1. Stage 1 includes exactly 4 top-level screens:
   - Feed
   - Object Detail
   - Entity Detail
   - Pipeline Board
2. Stage 1 excludes auth/RBAC/multi-tenancy, plugins/webhooks, trigger automation, chat, and hybrid semantic search.
3. Stage 2 executes in strict wave order:
   - S2.W1 UX hardening
   - S2.W2 platform foundations
   - S2.W3 selective intelligence
   - S2.W4 extensibility/admin
4. No phase starts before prior phase exit gate passes.

## 4. Phase Index

| Phase ID | Name | Packet |
|---|---|---|
| S1.1 | Foundation | `pm/phases/S1_1_FOUNDATION.md` |
| S1.2 | Streams + Ingestion | `pm/phases/S1_2_STREAMS_INGESTION.md` |
| S1.3 | Graph + Scoring | `pm/phases/S1_3_GRAPH_SCORING.md` |
| S1.4 | Pipeline + 4-Screen Frontend | `pm/phases/S1_4_PIPELINE_FRONTEND.md` |
| S1.EXIT | Stage 1 Acceptance Gate | `pm/phases/S1_EXIT_ACCEPTANCE_GATE.md` |
| S2.W1 | UX Hardening + IA Polish | `pm/phases/S2_W1_UX_HARDENING.md` |
| S2.W2 | Platform Foundations | `pm/phases/S2_W2_PLATFORM_FOUNDATIONS.md` |
| S2.W3 | Selective Intelligence | `pm/phases/S2_W3_SELECTIVE_INTELLIGENCE.md` |
| S2.W4 | Extensibility + Enterprise Admin | `pm/phases/S2_W4_EXTENSIBILITY_ADMIN.md` |

## 5. Canonical Interfaces

The canonical public interfaces and data contracts are maintained in phase packets and engineering docs:

1. tRPC procedure set and phase-scoped expansions in `pm/phases/*`.
2. Engine contracts in `engineering/ENGINES.md`.
3. Schema contracts in `engineering/DATA_MODEL.md`.
4. Security and isolation controls in `engineering/ARCHITECTURE.md` and `engineering/PLUGIN_SYSTEM.md`.

## 6. Governance and Quality

### Hard gates

1. `npm run lint:agents`
2. `npm run lint:docs`
3. `npm run lint:phase -- --phase=<PHASE_ID>`
4. `npm run gate:phase -- --phase=<PHASE_ID>`

### Merge-blocking rule set

`PSN001` through `PSN016` are mandatory and maintained in:

- `AGENTS.md`
- `config/agent-lint-rules.yaml`

### Exception policy

Allowlist file:

- `/Users/bastianburger/Repos/PaperScraperNext/.agent-lint-allowlist.yaml`

Required fields per entry:

- `rule_id`
- `path`
- `match`
- `reason`
- `owner`
- `expires_on`

Expired or incomplete entries block completion.

## 7. Required Phase Packet Standard

Every phase packet in `pm/phases/*` must include, in this exact order:

1. Context Capsule
2. Entry Criteria
3. Decisions Locked for This Phase
4. Functional Requirements
5. Non-Functional Requirements
6. Public Interfaces and Data Contracts
7. Out of Scope
8. Implementation Constraints
9. Acceptance Criteria
10. Test Plan
11. Exit Gate
12. Deliverables

## 8. Stage Exit Rules

### Stage 1 exit rule

S1.EXIT passes only when all Stage 1 E2E, performance, and reliability criteria pass.

### Stage 2 exit rule

Each wave must preserve Stage 1 baseline while satisfying its own acceptance criteria.

## 9. Source-of-Truth Clarification

1. Legacy phase drafts in `claude-code/PHASE_*.md` are archived stubs only.
2. Stage-level summaries in `claude-code/STAGE_*.md` are execution overlays and do not override `pm/phases/*`.
3. Product and engineering decisions must reference phase requirement IDs.
