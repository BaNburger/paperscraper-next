# Architecture Blueprint

This document defines stage-aware architecture contracts and layer boundaries for PaperScraper Next.

## Core Principle

Architecture exists to make the loop faster, clearer, and more reliable:

Subscribe -> Ingest -> Score -> Review -> Act

## Layer Model

1. UI layer (routes, view state, user interactions).
2. Router layer (tRPC procedures, authz, validation, orchestration).
3. Engine layer (domain workflows and policies).
4. Adapter/provider layer (OpenAlex, LLM provider, plugin endpoints).
5. Persistence/queue layer (PostgreSQL, Redis/BullMQ).

Hard boundary rules:

1. Routers call engines only (`PSN002`).
2. Engines do not import engines (`PSN003`).
3. Network calls only in adapter/provider boundaries (`PSN001`).
4. All external boundaries are schema validated (`PSN012`).

## Stage 1 Architecture

### Scope lock

1. Four top-level screens only.
2. Single source adapter: OpenAlex.
3. Manual-only pipeline behavior.
4. No auth/tenancy/trigger/plugin/chat/hybrid search.

### Runtime contract

1. Bun runtime for API and jobs.
2. TanStack Start for web routes.
3. tRPC for internal API.
4. BullMQ + Redis for async orchestration.
5. PostgreSQL 16 (+ pgvector provisioned, not required for Stage 1 behavior).

### Stage 1 phase mapping

1. S1.1: foundation and package/runtime setup.
2. S1.2: ingestion path and object creation events.
3. S1.3: graph resolution, scoring, and fold-up.
4. S1.4: four-screen frontend + manual pipeline operations.
5. S1.EXIT: verification and regression gate.

## Stage 2 Expansion Model

1. S2.W1: UX acceleration without IA expansion.
2. S2.W2: auth + RBAC + tenancy + RLS + audit.
3. S2.W3: benchmark-gated search and reversible triggers.
4. S2.W4: secure plugin/runtime extensibility and enterprise admin.

Each wave must preserve prior acceptance gates.

## Security and Reliability Baselines

1. Validate every ingress/egress contract.
2. Enforce retry/backoff/dead-letter for async jobs.
3. Require observability on queue depth, job duration, and failure reason.
4. Forbid insecure primitives and plaintext secret persistence.

## Performance Baselines

1. No `SELECT *`; explicit projection only (`PSN009`, `PSN014`).
2. Pagination required for feed/search-like endpoints.
3. Index-backed hot query paths are mandatory.
4. Worker concurrency and retry policy required for all async processors.

## Anti-Bloat Rules

1. New feature must map to a phase requirement ID.
2. New top-level navigation requires explicit replacement/merge rationale.
3. Stage 1 cannot absorb Stage 2 responsibilities.
4. Reuse-based abstractions only; speculative abstractions are rejected.
